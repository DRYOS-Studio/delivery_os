# Feature: discord-notifications

**Issue:** [#90](https://github.com/rafaelemeth/delivery_os/issues/90)
**Status:** SPEC
**Created:** 2026-05-29

---

## Objetivo

Empurrar sinais críticos do DRYOS Studio (Frente parada, SLA estourado) pra um canal Discord do cliente — via n8n como camada de tradução/normalização. MVP com 2 eventos cobrindo 80% do valor.

## Por que

O app tem sinal forte (status acionável, SLA, atenção imediata) mas exige abrir pra ver. Sem notificação ativa, frentes ficam silenciosamente paradas e SLA estoura sem alerta. Empurrar pra Discord (onde o time já está) elimina o gap "abrir o app".

Decisão arquitetural pré-fechada (memory `dryos-webhooks-via-n8n`): **DRYOS não fala direto com Discord**. n8n é o hub que normaliza payload e roteia. Vantagens: troca-se canal sem mexer no app; cliente que prefere Slack/Telegram só troca o final do fluxo no n8n.

## Decisões fechadas

| ID | Decisão |
|---|---|
| **Config** | Coluna `operations.notification_webhook_url text NULL` — 1 URL n8n por Operação. Op sem URL = no-op silencioso. |
| **Disparo** | Misto: Vercel Cron diário 08:00 BRT pra eventos periódicos + síncrono em Server Action pra eventos de ação. |
| **Eventos MVP** | `frente_stale` + `sla_breach`. Os 3 outros do roadmap original (task overdue, decisão vencendo, status parado op-level) ficam pra próximas issues. |
| **Dedup** | Tabela `notifications_log` com índice por `(operation_id, event_type, subject_id, sent_at)` — checa "já enviei isso nas últimas 24h?". |
| **Payload v1** | Versionado via `v: 1` no shape JSON. Evolução futura sem quebrar n8n existente. |

## Personas

- **Admin** configura URL do n8n em `/operations/[id]/edit` (campo novo "Webhook de notificação"). Pode desligar removendo a URL.
- **Time interno (no Discord)** recebe os alertas formatados pelo n8n.
- **n8n integrador** (você mesmo, depois) consome o payload canônico e formata pro Discord.

## Casos de uso

### UC1 — Frente fica parada
Frente `actionable_status_since` ≥ 7 dias atrás, sem ter sido notificada nas últimas 24h. Cron diário detecta, POSTa pra n8n da Operação, registra em `notifications_log`. Discord recebe formatado.

### UC2 — SLA estoura
Incidente aberto sem `responded_at` há mais que `operations.response_hours` (ou sem `resolved_at` há mais que `resolution_hours`). Server Action que rola na transição (`updateIncidentAction` ao salvar mudança) dispara. Cron diário é safety net (caso ninguém tenha mexido no incidente).

### UC3 — Operação sem URL
Op sem `notification_webhook_url` é pulada silenciosamente. Sem erro, sem log.

### UC4 — Webhook do n8n cai (timeout/erro)
Tentativa POST com timeout de 10s. Falha registra em `notifications_log` com `response_status` (HTTP code ou 0). Não retenta no MVP — n8n já tem retry interno; se cair de vez, próximo cron tenta de novo (assumindo que a janela de 24h passou).

## Requisitos funcionais

### RF1 — Schema
- `ALTER TABLE operations ADD COLUMN notification_webhook_url text NULL` + `CHECK (notification_webhook_url IS NULL OR length(notification_webhook_url) > 0)`.
- `CREATE TABLE notifications_log`:
  - `id uuid PK default gen_random_uuid()`
  - `operation_id uuid NOT NULL → operations(id) ON DELETE CASCADE`
  - `event_type text NOT NULL` (`'frente_stale' | 'sla_breach'`)
  - `subject_kind text NOT NULL` (`'frente' | 'sla_incident'`)
  - `subject_id uuid NOT NULL`
  - `sent_at timestamptz NOT NULL DEFAULT now()`
  - `payload jsonb NOT NULL`
  - `response_status int NULL` (HTTP code, ou 0 pra timeout/network)
  - INDEX em `(operation_id, event_type, subject_id, sent_at DESC)`
  - RLS: admin lê tudo; member não vê (notificações são internas; member não precisa).

### RF2 — Payload canônico v1
```json
{
  "event": "frente_stale",
  "v": 1,
  "operation": { "id": "...", "name": "Studio | Sparks", "client_name": "Altis Lisboa" },
  "subject": { "kind": "frente", "id": "...", "name": "Implantação Core" },
  "context": { "actionable_status": "aguardando aprovação de ...", "stale_days": 9 },
  "url": "https://delivery-os-phi.vercel.app/operations/<op_id>/frentes/<frente_id>",
  "ts": "2026-05-29T11:00:00.000Z"
}
```

```json
{
  "event": "sla_breach",
  "v": 1,
  "operation": { "id": "...", "name": "...", "client_name": "..." },
  "subject": { "kind": "sla_incident", "id": "...", "name": "Servidor caiu" },
  "context": {
    "severity": "high",
    "breach_kind": "response" | "resolution",
    "hours_elapsed": 5,
    "hours_limit": 4
  },
  "url": "https://delivery-os-phi.vercel.app/operations/<op_id>",
  "ts": "..."
}
```

Documento separado `.specs/features/discord-notifications/payload-v1.md` com exemplos completos pro time do n8n.

### RF3 — Detector `frente_stale`
- Query: frentes `archived_at IS NULL` + `actionable_status_since < now() - interval '7 days'` + JOIN com `operations` (precisa `notification_webhook_url` NOT NULL) + LEFT JOIN com `notifications_log` filtrado por `sent_at > now() - interval '24h'` AND `event_type='frente_stale'` AND `subject_id=frente.id` → manda só as que ainda não foram notificadas hoje.
- Roda na rota `GET /api/cron/notifications/route.ts`.

### RF4 — Detector `sla_breach`
- Function helper `detectSlaBreach(incident, operation)` retorna `{ kind: 'response' | 'resolution' | null, hoursElapsed: number, hoursLimit: number }`.
- Server Action `updateSlaIncidentAction` (existente — confirmar nome) chama detector pós-update; se breach novo, dispara.
- Safety net: cron também roda o detector pra todos os incidentes abertos.

### RF5 — Dispatcher
- `lib/notifications/dispatcher.ts`: função `dispatch(operationId, event, subject, context)` que:
  1. Carrega `operation` (incl. `notification_webhook_url` + `client_name`).
  2. Se URL null → return early (no-op).
  3. Constrói payload v1.
  4. POSTa via `fetch` com `signal: AbortSignal.timeout(10000)`.
  5. Insere em `notifications_log` com `response_status` (ou 0 em falha).
  6. **Não lança exception** se falhar — só registra (notificação não pode quebrar o fluxo principal).

### RF6 — Cron
- `src/app/api/cron/notifications/route.ts` (Route Handler).
- `vercel.json` com cron config: `{ "path": "/api/cron/notifications", "schedule": "0 11 * * *" }` (08:00 BRT = 11:00 UTC).
- Auth: header `Authorization: Bearer <CRON_SECRET>` verificado contra env var. Vercel Cron injeta automático.
- Loga total de eventos detectados + sucessos/falhas.

### RF7 — UI
- `OperationForm` ganha campo "Webhook de notificação (n8n)" — URL opcional. Validação Zod: URL válida OU null.
- Em `/operations/[id]/edit` aparece pra admin (já gated).
- Tela `/operations/[id]/settings` ou aba — admin pode ver últimas N notificações via `notifications_log` (NICE-TO-HAVE; fica fora do MVP).

## Não-objetivos

- ❌ Os 3 eventos restantes (task overdue, decisão vencendo, status parado op-level)
- ❌ Per-event toggle (silenciar evento X mas não Y)
- ❌ UI de "histórico de notificações"
- ❌ Múltiplos webhook URLs por Op
- ❌ Notificação personalizada por usuário (push pessoal)
- ❌ Retry exponencial (n8n já faz)
- ❌ Bidirectional Discord → DRYOS

## Critérios de aceite

- [ ] Migration aplicada (column + table)
- [ ] Op com URL configurada e Frente parada há 7+ dias recebe payload via cron (validado em mock antes de wire n8n)
- [ ] SLA breach dispara sync no update do incidente
- [ ] Dedup: rodar cron 2× em sequência manda só 1 vez
- [ ] Op sem URL não tenta enviar
- [ ] Falha de webhook registra em `notifications_log` mas não quebra fluxo
- [ ] Build + typecheck verde
- [ ] `payload-v1.md` com exemplos pro time do n8n

## Decisões pra Design

- **D1:** Local da função `dispatch` — `src/lib/notifications/` (novo módulo) ou estendendo `src/lib/integrations/`?
- **D2:** Detector de breach SLA é puro (helper) ou função SQL? Helper TS é mais flexível (logging, observability), SQL é mais barato.
- **D3:** Cron endpoint precisa de auth? Vercel Cron injeta header próprio; usar `CRON_SECRET` env var ou checar `x-vercel-cron`?
- **D4:** Detector `frente_stale` faz query única (JOIN) ou loop em ops + por-op-query? Query única é mais performática.
- **D5:** Onde adicionar o campo no `OperationForm` — junto com SLA hours, ou nova seção "Integrações"?

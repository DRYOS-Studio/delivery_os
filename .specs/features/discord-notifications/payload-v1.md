# Payload v1 — discord-notifications

**Audiência:** time que vai implementar o fluxo do n8n.
**Contrato:** DRYOS Studio POSTa esse JSON em `operations.notification_webhook_url` (configurado por Operação). Vocês consomem e formatam pro Discord (ou outro destino).

## Comum a todos os eventos

```json
{
  "event": "...",
  "v": 1,
  "operation": {
    "id": "uuid",
    "name": "Studio | Sparks",
    "client": {
      "id": "uuid",
      "name": "Altis Lisboa"
    }
  },
  "subject": {
    "kind": "frente" | "sla_incident",
    "id": "uuid",
    "name": "..."
  },
  "context": { /* depende do event — ver abaixo */ },
  "url": "https://delivery-os-phi.vercel.app/operations/...",
  "ts": "2026-05-29T11:00:00.000Z"
}
```

- `v: 1` — versão do payload. Quando bumpar pra `2`, sinalizamos no commit. Antes disso, n8n pode tratar tudo como `v: 1`.
- `url` — link direto pro contexto no app. Use no embed do Discord como "Abrir no DRYOS".
- `ts` — timestamp do disparo (ISO-8601 UTC).
- HTTP method: **POST**.
- HTTP body: **JSON**.
- `Content-Type: application/json`.
- Sem autenticação no header — autenticação fica no path/secret da URL do n8n.

## Roteamento sugerido (n8n)

Cada cliente tem **1 servidor Discord** com N canais por tema. Use `operation.client.id` como chave de lookup numa n8n Data Table tipo `dryos_clients`:

| client_id | client_name | webhook_frentes | webhook_sla | webhook_sla_high | role_oncall_id |
|---|---|---|---|---|---|
| uuid-altis | Altis Lisboa | https://discord.com/... | https://discord.com/... | https://discord.com/... | 1234... |

Fluxo: `[Webhook DRYOS] → [Data Table: get row by client_id] → [Switch event] → [Discord webhook do canal correto]`.

`operation.id` e `operation.name` são úteis pra metadados no embed; **`operation.client.id` é a chave estável** (não renomeia).

---

## Evento 1: `frente_stale`

Frente parada há ≥ 7 dias (`actionable_status_since`). Disparado pelo cron diário às 08:00 BRT.

```json
{
  "event": "frente_stale",
  "v": 1,
  "operation": {
    "id": "2cdc981b-0548-4580-a2df-02ee7b9b0518",
    "name": "Studio | Sparks",
    "client": {
      "id": "f1234567-89ab-cdef-0123-456789abcdef",
      "name": "Altis Lisboa"
    }
  },
  "subject": {
    "kind": "frente",
    "id": "abc-123",
    "name": "Implantação Core"
  },
  "context": {
    "actionable_status": "aguardando aprovação do briefing pela Altis desde 18/05",
    "stale_days": 9
  },
  "url": "https://delivery-os-phi.vercel.app/operations/2cdc981b-.../frentes/abc-123",
  "ts": "2026-05-29T11:00:00.000Z"
}
```

**Campos do `context`:**
| Campo | Tipo | Notas |
|---|---|---|
| `actionable_status` | string | Status acionável atual da Frente (texto livre validado por CHECK no banco — sempre ≥ 15 chars) |
| `stale_days` | int | Dias inteiros desde `actionable_status_since` até `ts` (floor) |

**Sugestão de formatação Discord:**
- Cor do embed: warning/oak (#C9933E) se `stale_days` entre 7-13; critical/red (#B23A48) se ≥ 14.
- Title: `"🟡 Frente parada há {stale_days}d"` (ou `"🔴"` se ≥ 14)
- Description: o `actionable_status` literal
- Fields:
  - `Operação`: `{operation.client.name} · {operation.name}` linkado
  - `Frente`: `{subject.name}`
- Footer: `DRYOS Studio • {ts}`
- Button "Abrir Frente": `{url}`

---

## Evento 2: `sla_breach`

Incidente SLA ultrapassou o limite de resposta ou resolução da Operação. Disparado:
- **Síncrono** quando uma Server Action de incidente (criar/atualizar) deixa o incidente em breach.
- **Cron diário** como safety net (caso ninguém tenha mexido no incidente).

```json
{
  "event": "sla_breach",
  "v": 1,
  "operation": {
    "id": "2cdc981b-...",
    "name": "Studio | Sparks",
    "client": {
      "id": "f1234567-...",
      "name": "Altis Lisboa"
    }
  },
  "subject": {
    "kind": "sla_incident",
    "id": "inc-456",
    "name": "Servidor de produção fora do ar"
  },
  "context": {
    "severity": "high",
    "breach_kind": "response",
    "hours_elapsed": 5,
    "hours_limit": 2
  },
  "url": "https://delivery-os-phi.vercel.app/operations/2cdc981b-...",
  "ts": "2026-05-29T13:30:00.000Z"
}
```

**Campos do `context`:**
| Campo | Tipo | Valores |
|---|---|---|
| `severity` | string | `"low" \| "medium" \| "high"` |
| `breach_kind` | string | `"response"` (ainda não respondido + passou de `response_hours`) ou `"resolution"` (ainda não resolvido + passou de `resolution_hours`) |
| `hours_elapsed` | int | Horas inteiras (floor) desde `opened_at` até `ts` |
| `hours_limit` | int | Limite SLA da Operação (`response_hours` ou `resolution_hours`) |

**Sugestão de formatação Discord:**
- Cor: oak (#C9933E) pra `low`/`medium` + `response`; red (#B23A48) pra `high` ou `resolution`.
- Title: `"🚨 SLA estourado — {breach_kind}"`
- Description: `"{subject.name}"` (título do incidente)
- Fields:
  - `Operação`: `{operation.client.name} · {operation.name}`
  - `Severidade`: `{severity}`
  - `Tempo decorrido`: `{hours_elapsed}h (limite {hours_limit}h)`
- Button "Abrir Operação": `{url}`

---

## Dedup

DRYOS já garante que **o mesmo `(operation_id, event, subject_id)` não é disparado mais de 1× por 24h** — vocês podem assumir que cada POST é único nessa janela.

## Falhas

DRYOS não tem retry exponencial. Se o n8n cair, o evento se perde pra essa janela; o próximo cron (24h depois) tenta de novo. Configure retry interno no n8n se quiser cobrir blips.

Timeout do DRYOS: **10 segundos**. Se n8n não responder em 10s, DRYOS aborta e loga `response_status = 0`. Mantenha o handler do n8n leve (idealmente: aceitar + enfileirar + responder 200; processamento pesado em outro nó async).

## Resposta esperada

Qualquer 2xx = sucesso (DRYOS marca como ok).
Não-2xx = falha (DRYOS loga, próximo cron tenta de novo).
Corpo da resposta: irrelevante. DRYOS não consome.

## Evolução futura

Quando v2 do payload sair, será sinalizado via `"v": 2`. Tipicamente:
- Novos eventos (task overdue, decisão vencendo, status parado op-level) com seu próprio `event`.
- Campos novos no `context` (sempre opcionais em v1 pra retro-compat).

Não removeremos campos sem bump de versão.

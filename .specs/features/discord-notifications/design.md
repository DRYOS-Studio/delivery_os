# Design: discord-notifications

**Spec:** [spec.md](./spec.md) · **Issue:** [#90](https://github.com/rafaelemeth/delivery_os/issues/90)
**Status:** DESIGN

---

## Decisões resolvidas

| ID | Decisão |
|---|---|
| **D1** | Módulo novo `src/lib/notifications/` — domínio coeso (dispatcher + types + detectors). `integrations/` fica reservado pra SDKs externos (Bitwarden v2). |
| **D2** | Detector de breach SLA = helper TS puro (`detectSlaBreach`). Logging + observability + futura evolução superam o ganho de SQL. |
| **D3** | Auth do cron = `Authorization: Bearer ${CRON_SECRET}` + `x-vercel-cron: 1` validado pra defesa em profundidade. Vercel Cron injeta ambos automaticamente. |
| **D4** | Detector `frente_stale` = query única com JOIN com `operations` + LEFT JOIN com `notifications_log` (dedup window 24h). |
| **D5** | Campo no `OperationForm` = nova seção "Integrações". Abre espaço pra Bitwarden/Tally futuro sem refator. |

---

## Schema

### Migration `20260529150001_discord_notifications.sql`

```sql
-- 1. Webhook URL por Operação
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS notification_webhook_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_operations_notification_webhook_url'
  ) THEN
    ALTER TABLE public.operations
      ADD CONSTRAINT check_operations_notification_webhook_url
      CHECK (notification_webhook_url IS NULL OR length(notification_webhook_url) > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.operations.notification_webhook_url IS
  'URL do n8n pra outbound de notificações (frente_stale, sla_breach). NULL = não envia. Aplica gating de Operação no policy de SELECT.';

-- 2. Log de notificações (dedup + audit)
CREATE TABLE IF NOT EXISTS public.notifications_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id    uuid NOT NULL,
  event_type      text NOT NULL,
  subject_kind    text NOT NULL,
  subject_id      uuid NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  payload         jsonb NOT NULL,
  response_status int,
  CONSTRAINT fk_notifications_log_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT check_notifications_log_event_type
    CHECK (event_type IN ('frente_stale', 'sla_breach')),
  CONSTRAINT check_notifications_log_subject_kind
    CHECK (subject_kind IN ('frente', 'sla_incident'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_log_dedup
  ON public.notifications_log (operation_id, event_type, subject_id, sent_at DESC);

COMMENT ON TABLE public.notifications_log IS
  'notifications: audit + dedup window. Cada disparo (sucesso ou falha) registra aqui com response_status. Index permite checar "já enviei esse evento pra esse subject nas últimas 24h?" rápido.';

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

-- Admin lê tudo; member NÃO vê (notificação é interna)
CREATE POLICY notifications_log_admin_select ON public.notifications_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- INSERT só por server-role (cron + Server Actions usam createServer com user auth;
-- admin gating no código). Sem policy de INSERT pra authenticated geral —
-- as inserts vão de dentro do cron handler/action que já gateia.
CREATE POLICY notifications_log_admin_insert ON public.notifications_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
```

**Nota sobre INSERT:** o cron roda como service (não-authenticated do Supabase Auth). Vai precisar usar `createAdmin()` (service-role key) pra inserir — RLS bypass. Server Actions de SLA usam `createServer()` (com user auth) e o user vai ser admin (já gated por `requireAdminAction`).

Wait — preciso confirmar: o cron handler vai usar service-role ou auth? Decisão de design: **cron usa service-role** (createAdmin) porque não tem user logado. Server Actions usam auth normal (admin gating já feito).

Por isso a policy de INSERT é "admin only" — vale só pra Server Actions. Cron passa por baixo via service-role.

---

## Estrutura de arquivos

```
src/lib/notifications/
├── types.ts              # NotificationEvent, payload v1 types
├── payload.ts            # buildPayload(event, op, subject, context) → v1 JSON
├── dispatcher.ts         # dispatch(opts) → POSTa + loga
├── dedup.ts              # alreadySent(operation_id, event_type, subject_id, window) → bool
└── detectors/
    ├── frente-stale.ts   # detect + dispatch frentes paradas (cron + helper)
    └── sla-breach.ts     # detectSlaBreach(incident, operation) + dispatch (action + cron)

src/app/api/cron/notifications/route.ts   # Vercel Cron endpoint
vercel.json                                # cron schedule

.specs/features/discord-notifications/payload-v1.md   # contrato pro n8n
```

---

## Types

```ts
// src/lib/notifications/types.ts

export type NotificationEvent = "frente_stale" | "sla_breach";
export type SubjectKind = "frente" | "sla_incident";

export type FrenteStaleContext = {
  actionable_status: string;
  stale_days: number;
};

export type SlaBreachContext = {
  severity: "low" | "medium" | "high";
  breach_kind: "response" | "resolution";
  hours_elapsed: number;
  hours_limit: number;
};

export type NotificationContext = FrenteStaleContext | SlaBreachContext;

export type NotificationPayload = {
  event: NotificationEvent;
  v: 1;
  operation: { id: string; name: string; client_name: string };
  subject: { kind: SubjectKind; id: string; name: string };
  context: NotificationContext;
  url: string;
  ts: string;
};
```

---

## Dispatcher

```ts
// src/lib/notifications/dispatcher.ts
"use server";

import { createAdmin } from "@/lib/db/client";  // service-role pra cron; createServer pra Server Actions
import type { NotificationPayload } from "./types";

const TIMEOUT_MS = 10_000;

export type DispatchInput = {
  webhookUrl: string;
  operationId: string;
  subjectKind: "frente" | "sla_incident";
  subjectId: string;
  payload: NotificationPayload;
  /** Pass createAdmin() for cron, createServer() result for Server Actions */
  supabaseAdmin: Awaited<ReturnType<typeof createAdmin>>;
};

export type DispatchResult =
  | { ok: true; status: number }
  | { ok: false; error: string; status: number };

export async function dispatch(input: DispatchInput): Promise<DispatchResult> {
  let status = 0;
  let err: string | null = null;

  try {
    const res = await fetch(input.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
    if (!res.ok) err = `HTTP ${res.status}`;
  } catch (e) {
    err = e instanceof Error ? e.message : "unknown";
  }

  // Loga sempre — sucesso ou falha
  await input.supabaseAdmin.from("notifications_log").insert({
    operation_id: input.operationId,
    event_type: input.payload.event,
    subject_kind: input.subjectKind,
    subject_id: input.subjectId,
    payload: input.payload as unknown as Record<string, unknown>,
    response_status: status,
  });

  return err ? { ok: false, error: err, status } : { ok: true, status };
}
```

**Decisão importante:** dispatcher recebe `supabaseAdmin` como dep injection. Cron passa `createAdmin()` (service-role bypassa RLS pra escrever em `notifications_log` sem user). Server Actions também usam `createAdmin()` aqui (mesmo padrão, simplifica). RLS protege leitura — escrita controlada pelo código que invoca.

---

## Detectores

### Frente stale (`detectors/frente-stale.ts`)

```ts
export type StaleFrente = {
  frente_id: string;
  frente_name: string;
  actionable_status: string;
  stale_days: number;
  operation_id: string;
  operation_name: string;
  client_name: string;
  webhook_url: string;
};

export async function listStaleFrentesPendingNotification(
  supabaseAdmin: ...,
): Promise<StaleFrente[]> {
  const { data, error } = await supabaseAdmin.rpc("list_stale_frentes_pending_notification");
  if (error) throw error;
  return data ?? [];
}
```

Como RPC tem que ser uma function SQL. Alternativa: query JS direto via supabase-js, joining manualmente. Vou fazer **JS** pra evitar criar function SQL — mais transparente.

```ts
export async function listStaleFrentesPendingNotification(supabaseAdmin) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  // 1. Frentes stale
  const { data: frentes, error: e1 } = await supabaseAdmin
    .from("frentes")
    .select(`
      id, name, actionable_status, actionable_status_since,
      operation:operations!inner (
        id, name, notification_webhook_url, archived_at,
        client:clients (name)
      )
    `)
    .is("archived_at", null)
    .lt("actionable_status_since", sevenDaysAgo)
    .not("operation.notification_webhook_url", "is", null)
    .is("operation.archived_at", null);
  if (e1) throw e1;

  if (!frentes || frentes.length === 0) return [];

  // 2. Filter out the ones already notified in last 24h
  const ids = frentes.map((f) => f.id);
  const { data: recent, error: e2 } = await supabaseAdmin
    .from("notifications_log")
    .select("subject_id")
    .eq("event_type", "frente_stale")
    .in("subject_id", ids)
    .gt("sent_at", dayAgo);
  if (e2) throw e2;

  const blocked = new Set((recent ?? []).map((r) => r.subject_id));
  return frentes
    .filter((f) => !blocked.has(f.id))
    .map((f) => ({ /* transform */ }));
}
```

### SLA breach (`detectors/sla-breach.ts`)

```ts
export type SlaBreach = {
  kind: "response" | "resolution";
  hoursElapsed: number;
  hoursLimit: number;
};

export function detectSlaBreach(
  incident: { opened_at: string; responded_at: string | null; resolved_at: string | null; status: string },
  operation: { response_hours: number | null; resolution_hours: number | null },
): SlaBreach | null {
  const now = Date.now();
  const opened = new Date(incident.opened_at).getTime();
  const elapsedH = (now - opened) / 3_600_000;

  // resolução vence depois de resposta — checar resolução primeiro se aplicável
  if (incident.status !== "resolved" && operation.resolution_hours != null && elapsedH > operation.resolution_hours) {
    return { kind: "resolution", hoursElapsed: Math.floor(elapsedH), hoursLimit: operation.resolution_hours };
  }

  if (!incident.responded_at && operation.response_hours != null && elapsedH > operation.response_hours) {
    return { kind: "response", hoursElapsed: Math.floor(elapsedH), hoursLimit: operation.response_hours };
  }

  return null;
}
```

Function pura — sem DB. Usada em:
- Server Action de update do incidente (sync detection).
- Cron handler (safety net — itera todos abertos).

---

## Cron handler

```ts
// src/app/api/cron/notifications/route.ts

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/db/client";
import { listStaleFrentesPendingNotification } from "@/lib/notifications/detectors/frente-stale";
import { listOpenSlaIncidentsPendingNotification } from "@/lib/notifications/detectors/sla-breach";
import { dispatch } from "@/lib/notifications/dispatcher";
import { buildFrenteStalePayload, buildSlaBreachPayload } from "@/lib/notifications/payload";

export async function GET(req: Request) {
  // Auth defesa em profundidade
  const auth = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (auth !== expected && vercelCron !== "1") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createAdmin();

  // 1. Frentes stale
  const stale = await listStaleFrentesPendingNotification(supabase);
  let staleSuccess = 0, staleFail = 0;
  for (const f of stale) {
    const result = await dispatch({
      webhookUrl: f.webhook_url,
      operationId: f.operation_id,
      subjectKind: "frente",
      subjectId: f.frente_id,
      payload: buildFrenteStalePayload(f),
      supabaseAdmin: supabase,
    });
    if (result.ok) staleSuccess++;
    else staleFail++;
  }

  // 2. SLA incidents — safety net
  const breached = await listOpenSlaIncidentsPendingNotification(supabase);
  let slaSuccess = 0, slaFail = 0;
  for (const b of breached) {
    const result = await dispatch({ /* ... */ });
    if (result.ok) slaSuccess++; else slaFail++;
  }

  return NextResponse.json({
    stale: { detected: stale.length, success: staleSuccess, failed: staleFail },
    sla:   { detected: breached.length, success: slaSuccess, failed: slaFail },
  });
}
```

### `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/notifications", "schedule": "0 11 * * *" }
  ]
}
```

(`0 11 * * *` UTC = 08:00 BRT)

---

## Server Action — SLA sync

Identificar a action que atualiza `sla_incidents` (provavelmente `updateSlaIncidentAction` ou similar). Após mutation bem-sucedida:

```ts
// dentro da action, depois do .update(...).eq(...)
import { detectSlaBreach } from "@/lib/notifications/detectors/sla-breach";
import { dispatch } from "@/lib/notifications/dispatcher";
import { buildSlaBreachPayload } from "@/lib/notifications/payload";
import { alreadySent } from "@/lib/notifications/dedup";

const breach = detectSlaBreach(updatedIncident, operation);
if (breach && operation.notification_webhook_url) {
  const recent = await alreadySent(supabaseAdmin, {
    operation_id: operation.id,
    event_type: "sla_breach",
    subject_id: updatedIncident.id,
    windowMs: 24 * 3_600_000,
  });
  if (!recent) {
    // fire-and-forget — não bloqueia retorno da action
    void dispatch({ /* ... */ });
  }
}
```

`void` no fire-and-forget — não esperamos o POST terminar pra retornar a action (UX rápido). O log entra dentro do dispatch, sem bloquear UI.

---

## UI

### `OperationForm` — seção "Integrações"

Nova `<fieldset>` antes do submit:

```tsx
<fieldset className="border-t border-line pt-5 mt-5">
  <legend className="font-display text-sm font-semibold text-ink mb-3 px-0">
    Integrações
  </legend>
  <div className="space-y-1">
    <label htmlFor="notification_webhook_url" className="...">
      Webhook de notificação (n8n)
    </label>
    <input
      id="notification_webhook_url"
      name="notification_webhook_url"
      type="url"
      placeholder="https://n8n.exemplo.com/webhook/dryos-..."
      className="..."
    />
    <p className="font-mono text-[10px] text-mute mt-1">
      URL pra onde DRYOS posta eventos (Frente parada, SLA estourado).
      Deixe em branco pra desligar.
    </p>
  </div>
</fieldset>
```

### Validator `operation.ts`

Adicionar campo Zod:
```ts
notification_webhook_url: z
  .string()
  .url({ message: "URL inválida" })
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .default(null),
```

---

## Env vars

`.env.local.example` ganha:
```
# Cron auth — qualquer string forte, igual no Vercel project env
CRON_SECRET=
```

Vercel project precisa setar `CRON_SECRET`. Vercel Cron envia `Authorization: Bearer <CRON_SECRET>` automático se a env existir.

---

## Documento `payload-v1.md`

Arquivo separado pro time do n8n implementar o fluxo. Estrutura:
- O que é cada evento + quando dispara
- Shape JSON completo + exemplo populado
- Campos opcionais vs obrigatórios
- Como o n8n pode formatar pro Discord (sugestão de embed: cor por severidade, link clicável, etc.)

---

## Plano de fases

PR único `feat/discord-notifications-mvp`:
- Migration + types (schema)
- Module structure (`lib/notifications/`)
- Detectors + dispatcher + dedup helper
- Cron route + `vercel.json`
- Server Action SLA sync (identificar action existente; adicionar trigger)
- Form field + validator
- `payload-v1.md`
- DS SKILL nota curta em "Integrações"
- ROADMAP + STATE update

---

## Riscos

- **R1 — Cron não roda em preview branches:** Vercel Cron só roda em produção. Validar em prod (via deploy de teste com mock URL apontando pra `webhook.site`).
- **R2 — Service-role key exposto:** `createAdmin()` deve usar `SUPABASE_SERVICE_ROLE_KEY` (server-only env, sem `NEXT_PUBLIC_`). Confirmar que cliente já faz isso ou criar.
- **R3 — Fire-and-forget em Server Action:** `void dispatch(...)` em Vercel Edge — Promise pode ser cortada quando função termina. Usar `waitUntil()` de `next/server` se rolar drop. Pra MVP, aceitar drop ocasional (cron safety net cobre).
- **R4 — Webhook lento trava 10s:** `AbortSignal.timeout(10000)` corta. Não trava função além disso.
- **R5 — Loop infinito de stale:** Se Op não tem URL, frente fica eternamente stale mas nunca notifica → ok, é o comportamento esperado. Não cria carga.

---

## Validação manual

Pós-implementação, no Vercel preview (ou prod com URL de teste):
1. Configurar URL `webhook.site` no campo da Op de teste.
2. Forçar Frente com `actionable_status_since` há 8 dias (UPDATE manual via SQL).
3. Disparar cron manual via `curl -H "Authorization: Bearer <CRON_SECRET>" https://.../api/cron/notifications`.
4. Confirmar payload chegou no webhook.site.
5. Confirmar row em `notifications_log` com `response_status=200`.
6. Rodar cron de novo — não deve duplicar.
7. Forçar SLA breach: criar incidente com `opened_at` 5h atrás, Op com `response_hours=2`, salvar via UI → dispatch sync. Confirmar payload + log.
8. Tirar URL da Op, repetir 2-3 — não deve enviar.

---

## Decisões pra Tasks

- Detector frente-stale tem subqueries — fica em 1 arquivo ou parte vira helper?
- `vercel.json` é arquivo novo? Confirmar que não existe ainda.
- Identificar nome exato da Server Action de SLA incident antes de mexer (provavelmente `updateSlaIncidentAction` em `lib/actions/sla-incidents.ts`).

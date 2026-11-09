import type { ActivitySubjectType } from "@/lib/db/queries/activity";
import type { ActivityEventRow } from "@/lib/db/queries/activity";
import {
  statusLabel,
  type OperationStatus,
} from "@/lib/utils/operation-status";
import { formatMoneyBR } from "@/lib/utils/money";
import type { Database } from "@/lib/db/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];

export type ActivityFormatContext = {
  persons: Record<string, string>;
  frentes: Record<string, string>;
  operations: Record<string, string>;
  clients: Record<string, string>;
  areas: Record<string, string>;
  profileNames: Record<string, string>;
};

function mapGet(store: Record<string, string>, id: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(store, id)) {
    return store[id];
  }
  return undefined;
}

const REMOVED = "(item removido)";

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Concluída",
  blocked: "Bloqueada",
};

const FIELD_LABELS: Record<string, string> = {
  name: "nome",
  slug: "slug",
  notes: "notas",
  legal_name: "razão social",
  cnpj: "CNPJ",
  primary_contact_name: "contato",
  primary_contact_email: "e-mail do contato",
  archived_at: "arquivamento",
  journey_status: "jornada",
  status: "status",
  product_line: "linha de produto",
  recurrence: "recorrência",
  monthly_recurring_revenue: "MRR",
  monthly_fixed_cost: "custo fixo mensal",
  response_hours: "SLA de resposta (h)",
  resolution_hours: "SLA de resolução (h)",
  start_date: "data de início",
  end_date: "data de término",
  notification_webhook_url: "webhook de notificação",
  diagnostic_id: "diagnóstico",
  cycle_type: "tipo de ciclo",
  domain: "domínio",
  phase: "fase",
  actionable_status: "status acionável",
  responsible_person_id: "responsável",
  title: "título",
  description: "descrição",
  due_date: "prazo",
  frente_id: "frente",
  area_id: "área",
  assignees: "responsáveis",
  comment: "comentário",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidString(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function jsonScalar(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (
      (t.startsWith("{") && t.endsWith("}")) ||
      (t.startsWith("[") && t.endsWith("]"))
    ) {
      try {
        return JSON.parse(t) as unknown;
      } catch {
        return v;
      }
    }
    return v;
  }
  return v;
}

function formatPercent(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return `${v}%`;
  if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()))
    return `${v.trim()}%`;
  return null;
}

function formatDateValue(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? new Date(`${v}T12:00:00`)
    : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}

export function formatActivityActorLabel(
  event: ActivityEventRow,
  ctx: ActivityFormatContext,
): string {
  const stored = event.actorName?.trim();
  if (stored) return stored;

  const meta = event.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const rec = meta as Record<string, unknown>;
    if (rec["source"] === "mcp" || rec["mcp_agent"] === true) {
      return "Agente MCP";
    }
    const metaName = rec["actor_display_name"];
    if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  }

  const fromCtx = event.actorProfileId
    ? mapGet(ctx.profileNames, event.actorProfileId)?.trim()
    : undefined;
  if (fromCtx) return fromCtx;

  if (event.actorProfileId) {
    return "Colega";
  }

  return "Sistema";
}

function resolveEntityName(
  fieldKey: string | null,
  raw: unknown,
  ctx: ActivityFormatContext,
): string {
  const v = jsonScalar(raw);
  if (v === null || v === undefined || v === "") return "—";

  if (fieldKey === "status" && typeof v === "string") {
    const taskLabel = TASK_STATUS_LABEL[v as TaskStatus];
    if (taskLabel) return taskLabel;
    if (
      v === "em_construcao" ||
      v === "em_operacao" ||
      v === "janela_critica" ||
      v === "concluida" ||
      v === "cancelada" ||
      v === "arquivada"
    ) {
      return statusLabel(v as OperationStatus);
    }
    return v;
  }

  if (
    fieldKey === "monthly_recurring_revenue" ||
    fieldKey === "monthly_fixed_cost"
  ) {
    if (typeof v === "number") return formatMoneyBR(v);
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return formatMoneyBR(n);
    }
  }

  const pct = formatPercent(v);
  if (pct && (fieldKey?.includes("pct") || fieldKey?.includes("rate"))) {
    return pct;
  }

  const dateFmt = formatDateValue(v);
  if (
    dateFmt &&
    fieldKey &&
    (fieldKey.endsWith("_date") || fieldKey === "archived_at")
  ) {
    return v === null ? "—" : dateFmt;
  }

  if (isUuidString(v)) {
    if (fieldKey === "frente_id" || fieldKey === "responsible_person_id") {
      /* fall through */
    }
    const person = mapGet(ctx.persons, v);
    if (person) return person;
    const frente = mapGet(ctx.frentes, v);
    if (frente) return frente;
    const op = mapGet(ctx.operations, v);
    if (op) return op;
    const client = mapGet(ctx.clients, v);
    if (client) return client;
    const area = mapGet(ctx.areas, v);
    if (area) return area;
    return REMOVED;
  }

  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (typeof o["title"] === "string") return o["title"];
    if (typeof o["name"] === "string") return o["name"];
    if (typeof o["preview"] === "string") {
      return o["preview"].length > 120
        ? `${o["preview"].slice(0, 117)}…`
        : o["preview"];
    }
  }

  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }

  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function subjectTypeLabel(t: ActivitySubjectType): string {
  switch (t) {
    case "client":
      return "cliente";
    case "operation":
      return "operação";
    case "frente":
      return "frente";
    case "task":
      return "tarefa";
    case "profile":
      return "perfil";
    case "client_contract":
      return "contrato";
    case "meeting":
      return "reunião";
    case "decision":
      return "decisão";
    case "operation_risk_blocker":
      return "risco/bloqueio";
    default: {
      const _exhaustive: never = t;
      return _exhaustive;
    }
  }
}

function extractCreatedPayload(
  newValue: unknown,
): Record<string, unknown> | null {
  const v = jsonScalar(newValue);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function formatCreatedSentence(
  event: ActivityEventRow,
  actor: string,
  ctx: ActivityFormatContext,
): string {
  const payload = extractCreatedPayload(event.newValue);
  const subject = subjectTypeLabel(event.subjectType);

  if (event.subjectType === "task" && payload) {
    const title =
      typeof payload["title"] === "string" ? payload["title"] : "tarefa";
    const frenteId = payload["frente_id"];
  const frenteName =
      typeof frenteId === "string"
        ? (mapGet(ctx.frentes, frenteId) ?? REMOVED)
        : null;
    if (frenteName) {
      return `${actor} criou a tarefa “${title}” na frente ${frenteName}`;
    }
    return `${actor} criou a tarefa “${title}”`;
  }

  if (payload && typeof payload["name"] === "string") {
    return `${actor} criou ${subject} “${payload["name"]}”`;
  }

  return `${actor} criou ${subject}`;
}

function formatAssigneeSentence(
  event: ActivityEventRow,
  actor: string,
  ctx: ActivityFormatContext,
): string {
  const raw =
    event.action === "assignee_added" ? event.newValue : event.oldValue;
  const personId = jsonScalar(raw);
  const personName = isUuidString(personId)
    ? (mapGet(ctx.persons, personId) ?? REMOVED)
    : REMOVED;

  if (event.action === "assignee_added") {
    return `${actor} atribuiu a tarefa a ${personName}`;
  }
  return `${actor} removeu ${personName} da tarefa`;
}

function formatCommentSentence(event: ActivityEventRow, actor: string): string {
  const payload =
    event.action === "comment_deleted"
      ? extractCreatedPayload(event.oldValue)
      : extractCreatedPayload(event.newValue);
  const preview =
    payload && typeof payload["preview"] === "string"
      ? payload["preview"]
      : null;

  switch (event.action) {
    case "comment_created":
      return preview
        ? `${actor} comentou: “${preview}”`
        : `${actor} adicionou um comentário`;
    case "comment_updated":
      return preview
        ? `${actor} editou comentário: “${preview}”`
        : `${actor} editou um comentário`;
    case "comment_deleted":
      return preview
        ? `${actor} removeu comentário: “${preview}”`
        : `${actor} removeu um comentário`;
    default:
      return `${actor} alterou comentário`;
  }
}

function formatStatusChangeSentence(
  event: ActivityEventRow,
  actor: string,
  ctx: ActivityFormatContext,
): string {
  const before = resolveEntityName("status", event.oldValue, ctx);
  const after = resolveEntityName("status", event.newValue, ctx);

  if (event.subjectType === "task") {
    return `${actor} alterou o status da tarefa de ${before} para ${after}`;
  }
  if (event.subjectType === "operation") {
    return `${actor} alterou o status da operação de ${before} para ${after}`;
  }

  return `Status mudou de ${before} para ${after}`;
}

function formatFieldUpdateSentence(
  event: ActivityEventRow,
  actor: string,
  ctx: ActivityFormatContext,
): string {
  const field = event.fieldKey
    ? (FIELD_LABELS[event.fieldKey] ?? event.fieldKey)
    : "campo";
  const before = resolveEntityName(event.fieldKey, event.oldValue, ctx);
  const after = resolveEntityName(event.fieldKey, event.newValue, ctx);
  const subject = subjectTypeLabel(event.subjectType);

  return `${actor} alterou ${field} de ${subject}: ${before} → ${after}`;
}

/** Frase principal em modo legível. */
export function formatActivitySentence(
  event: ActivityEventRow,
  ctx: ActivityFormatContext,
): string {
  const actor = formatActivityActorLabel(event, ctx);

  if (event.action === "created") {
    return formatCreatedSentence(event, actor, ctx);
  }
  if (
    event.action === "assignee_added" ||
    event.action === "assignee_removed"
  ) {
    return formatAssigneeSentence(event, actor, ctx);
  }
  if (
    event.action === "comment_created" ||
    event.action === "comment_updated" ||
    event.action === "comment_deleted"
  ) {
    return formatCommentSentence(event, actor);
  }
  if (event.action === "updated" && event.fieldKey === "status") {
    return formatStatusChangeSentence(event, actor, ctx);
  }
  if (event.action === "updated" && event.fieldKey) {
    return formatFieldUpdateSentence(event, actor, ctx);
  }
  if (event.action === "updated") {
    return `${actor} atualizou ${subjectTypeLabel(event.subjectType)}`;
  }

  return `${actor} registrou ${event.action}${
    event.fieldKey ? ` (${event.fieldKey})` : ""
  }`;
}

/** Agrupa eventos no mesmo minuto com o mesmo ator e ação (leitura mais limpa). */
export function groupActivityEventsForDisplay(
  events: ActivityEventRow[],
): ActivityEventRow[] {
  const out: ActivityEventRow[] = [];
  let i = 0;
  while (i < events.length) {
    const current = events[i];
    if (!current) break;
    const bucket: ActivityEventRow[] = [current];
    const minuteKey = current.createdAt.slice(0, 16);
    let j = i + 1;
    while (j < events.length) {
      const next = events[j];
      if (!next) break;
      const sameMinute = next.createdAt.slice(0, 16) === minuteKey;
      const sameActor =
        (next.actorProfileId ?? "") === (current.actorProfileId ?? "") &&
        (next.actorName ?? "") === (current.actorName ?? "");
      if (
        sameMinute &&
        sameActor &&
        next.action === current.action &&
        next.action === "updated" &&
        current.action === "updated"
      ) {
        bucket.push(next);
        j++;
      } else {
        break;
      }
    }
    if (bucket.length === 1) {
      out.push(current);
    } else {
      out.push({
        ...current,
        id: bucket.map((b) => b.id).join("+"),
        fieldKey: bucket
          .map((b) => b.fieldKey)
          .filter(Boolean)
          .join(", "),
      });
    }
    i = j;
  }
  return out;
}

export function matchesActivityFilters(
  event: ActivityEventRow,
  category: import("@/lib/utils/activity-filters").ActivityFilterCategory,
): boolean {
  if (category === "all") return true;
  if (category === "created") return event.action === "created";
  if (category === "assignee")
    return (
      event.action === "assignee_added" || event.action === "assignee_removed"
    );
  if (category === "comments") return event.action.startsWith("comment_");
  if (category === "status")
    return event.action === "updated" && event.fieldKey === "status";
  if (category === "updated")
    return event.action === "updated" && event.fieldKey !== "status";
  return true;
}

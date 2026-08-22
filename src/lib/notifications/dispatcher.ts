import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { NotificationPayload, SubjectKind } from "./types";
import { checkWebhookUrl } from "./webhook-url";

const TIMEOUT_MS = 10_000;

export type DispatchInput = {
  webhookUrl: string;
  operationId: string;
  subjectKind: SubjectKind;
  subjectId: string;
  payload: NotificationPayload;
  /** Service-role client (createAdmin) — bypassa RLS pra escrever o log */
  supabaseAdmin: SupabaseClient<Database>;
};

export type DispatchResult =
  | { ok: true; status: number }
  | { ok: false; error: string; status: number };

/**
 * POSTa o payload pro webhook n8n + registra log (sucesso ou falha).
 * Nunca lança — notificação não pode quebrar o fluxo principal.
 */
export async function dispatch(
  input: DispatchInput,
): Promise<DispatchResult> {
  let status = 0;
  let errMsg: string | null = null;

  // Revalida no envio, não só na escrita: o validator é UX, este é o limite.
  // A URL pode ter entrado por outro caminho (SQL direto, migration, seed).
  const problem = checkWebhookUrl(input.webhookUrl);
  if (problem) {
    errMsg = `blocked destination (${problem})`;
  } else {
    try {
      const res = await fetch(input.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Sem seguir redirect: um webhook legítimo não redireciona, e seguir
        // deixaria um host público pivotar pra 169.254.169.254 depois de já
        // ter passado pelo checkWebhookUrl.
        redirect: "manual",
      });
      status = res.status;
      if (status >= 300 && status < 400) {
        errMsg = `HTTP ${status} (redirect não seguido)`;
      } else if (!res.ok) {
        errMsg = `HTTP ${res.status}`;
      }
    } catch (e) {
      errMsg = e instanceof Error ? e.message : "unknown error";
    }
  }

  // Loga sempre, mesmo em falha. Status 0 = timeout/rede.
  const { error: logErr } = await input.supabaseAdmin
    .from("notifications_log")
    .insert({
      operation_id: input.operationId,
      event_type: input.payload.event,
      subject_kind: input.subjectKind,
      subject_id: input.subjectId,
      payload: input.payload as unknown as Database["public"]["Tables"]["notifications_log"]["Insert"]["payload"],
      response_status: status,
    });

  if (logErr) {
    // Erro de log é grave (perdemos audit/dedup), mas ainda assim não jogamos
    // exception pra cima — só sinalizamos no return.
    return {
      ok: false,
      error: `dispatch logged failure (${errMsg ?? "ok"}) + log insert error: ${logErr.message}`,
      status,
    };
  }

  return errMsg ? { ok: false, error: errMsg, status } : { ok: true, status };
}

import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import type {
  ActionPlan,
  AnswersMap,
  ComputedScores,
  DiagnosticFlag,
  NaAnswersMap,
} from "@/lib/utils/management-diagnostic";
import type { ProfileData } from "@/lib/validators/management-diagnostic";

export type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];

export type DiagnosticDetail = DiagnosticRow & {
  profileData: ProfileData;
  answersMap: AnswersMap;
  naAnswersMap: NaAnswersMap;
  computedScores: ComputedScores | null;
  flagsList: DiagnosticFlag[];
  actionPlanData: ActionPlan | null;
};

export type DiagnosticOption = {
  id: string;
  clientId: string;
  label: string;
};

function mapRowToDetail(row: DiagnosticRow): DiagnosticDetail {
  return {
    ...row,
    profileData: (row.profile_data as ProfileData) || ({} as ProfileData),
    answersMap: (row.answers as AnswersMap) || {},
    naAnswersMap: (row.na_answers as NaAnswersMap) || {},
    computedScores: (row.computed_scores as ComputedScores) || null,
    flagsList: (row.flags as DiagnosticFlag[]) || [],
    actionPlanData: (row.action_plan as ActionPlan) || null,
  };
}

export async function getDiagnosticById(
  id: string,
): Promise<DiagnosticDetail | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("diagnostics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getDiagnosticById: ${error.message}`);
  if (!data) return null;
  return mapRowToDetail(data);
}

export async function getLatestDiagnosticByClient(
  clientId: string,
): Promise<DiagnosticDetail | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("diagnostics")
    .select("*")
    .eq("client_id", clientId)
    .order("conducted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestDiagnosticByClient: ${error.message}`);
  if (!data) return null;
  return mapRowToDetail(data);
}

// Backwards-compatible helper
export async function getDiagnosticByClient(
  clientId: string,
): Promise<DiagnosticDetail | null> {
  return getLatestDiagnosticByClient(clientId);
}

export async function listDiagnosticsByClient(
  clientId: string,
): Promise<DiagnosticDetail[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("diagnostics")
    .select("*")
    .eq("client_id", clientId)
    .order("conducted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listDiagnosticsByClient: ${error.message}`);
  if (!data) return [];
  return data.map(mapRowToDetail);
}

export async function listDiagnosticsForSelect(): Promise<DiagnosticOption[]> {
  const supabase = await createServer();
  const { data, error } = await supabase.from("diagnostics").select(
    `
      id, client_id, conducted_at,
      client:clients!fk_diagnostics_client_id (name)
      `,
  );
  if (error) throw new Error(`listDiagnosticsForSelect: ${error.message}`);
  if (!data) return [];
  return data.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    label: r.conducted_at
      ? `${r.client?.name ?? "—"} · ${r.conducted_at}`
      : (r.client?.name ?? "—"),
  }));
}

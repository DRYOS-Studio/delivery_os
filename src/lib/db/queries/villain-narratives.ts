import { createAdmin, createServer } from "@/lib/db/client";

export async function listVillainNarratives(
  operationId: string,
  periodYyyymm: string,
): Promise<Record<string, string>> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("operation_villain_narratives")
    .select("villain_id, narrative_text")
    .eq("operation_id", operationId)
    .eq("period_yyyymm", periodYyyymm);
  if (error) throw new Error(`listVillainNarratives: ${error.message}`);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.villain_id] = row.narrative_text;
  }
  return map;
}

export async function getVillainNarrativeForOperationVillain(
  operationVillainId: string,
  periodYyyymm: string,
): Promise<{ text: string } | null> {
  const supabase = await createServer();
  const { data: ov, error: ovErr } = await supabase
    .from("operation_villains")
    .select("operation_id, villain_id")
    .eq("id", operationVillainId)
    .maybeSingle();
  if (ovErr) throw new Error(`getVillainNarrative.ov: ${ovErr.message}`);
  if (!ov) return null;

  const { data, error } = await supabase
    .from("operation_villain_narratives")
    .select("narrative_text")
    .eq("operation_id", ov.operation_id)
    .eq("villain_id", ov.villain_id)
    .eq("period_yyyymm", periodYyyymm)
    .maybeSingle();
  if (error) throw new Error(`getVillainNarrative: ${error.message}`);
  if (!data) return null;
  return { text: data.narrative_text };
}

import { createAdmin, createServer } from "@/lib/db/client";

export type BriefingContent = {
  contexto: string | null;
  objetivos: string | null;
  escopo_incluido: string | null;
  escopo_excluido: string | null;
  premissas: string | null;
  riscos: string | null;
  stakeholders: string | null;
  observacoes: string | null;
};

export type BriefingVersionRow = BriefingContent & {
  id: string;
  briefing_id: string;
  author_id: string | null;
  created_at: string;
};

export type BriefingVersionWithAuthor = BriefingVersionRow & {
  authorEmail: string | null;
};

export type BriefingWithLatest = {
  id: string;
  operation_id: string;
  current_version_id: string | null;
  updated_at: string;
  latestVersion: BriefingVersionRow | null;
  authorEmail: string | null;
  versionsCount: number;
};

const VERSION_FIELDS =
  "id, briefing_id, contexto, objetivos, escopo_incluido, escopo_excluido, premissas, riscos, stakeholders, observacoes, author_id, created_at";

// Resolve emails for a set of user ids via admin API. Returns map id → email.
async function resolveAuthorEmails(
  ids: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const admin = createAdmin();
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data?.user?.email) return;
      map.set(id, data.user.email);
    }),
  );
  return map;
}

export async function getBriefingByOperation(
  operationId: string,
): Promise<BriefingWithLatest | null> {
  const supabase = await createServer();
  const { data: briefing, error } = await supabase
    .from("briefings")
    .select("id, operation_id, current_version_id, updated_at")
    .eq("operation_id", operationId)
    .maybeSingle();

  if (error) throw new Error(`getBriefingByOperation: ${error.message}`);
  if (!briefing) return null;

  // Latest version: by current_version_id, fallback to MAX(created_at)
  let latest: BriefingVersionRow | null = null;
  if (briefing.current_version_id) {
    const { data, error: vErr } = await supabase
      .from("briefing_versions")
      .select(VERSION_FIELDS)
      .eq("id", briefing.current_version_id)
      .maybeSingle();
    if (vErr) throw new Error(`getBriefingByOperation.latest: ${vErr.message}`);
    latest = data;
  }
  if (!latest) {
    const { data, error: vErr } = await supabase
      .from("briefing_versions")
      .select(VERSION_FIELDS)
      .eq("briefing_id", briefing.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vErr)
      throw new Error(`getBriefingByOperation.fallback: ${vErr.message}`);
    latest = data;
  }

  // Count versions
  const { count, error: cErr } = await supabase
    .from("briefing_versions")
    .select("id", { count: "exact", head: true })
    .eq("briefing_id", briefing.id);
  if (cErr) throw new Error(`getBriefingByOperation.count: ${cErr.message}`);

  // Resolve author email
  const authorEmails = latest?.author_id
    ? await resolveAuthorEmails([latest.author_id])
    : new Map();

  return {
    id: briefing.id,
    operation_id: briefing.operation_id,
    current_version_id: briefing.current_version_id,
    updated_at: briefing.updated_at,
    latestVersion: latest,
    authorEmail: latest?.author_id
      ? (authorEmails.get(latest.author_id) ?? null)
      : null,
    versionsCount: count ?? 0,
  };
}

export async function getBriefingVersion(
  versionId: string,
): Promise<BriefingVersionWithAuthor | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("briefing_versions")
    .select(VERSION_FIELDS)
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(`getBriefingVersion: ${error.message}`);
  if (!data) return null;

  const emails = data.author_id
    ? await resolveAuthorEmails([data.author_id])
    : new Map();

  return {
    ...data,
    authorEmail: data.author_id ? (emails.get(data.author_id) ?? null) : null,
  };
}

export async function listBriefingVersions(
  briefingId: string,
  limit = 50,
): Promise<BriefingVersionWithAuthor[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("briefing_versions")
    .select(VERSION_FIELDS)
    .eq("briefing_id", briefingId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listBriefingVersions: ${error.message}`);
  if (!data) return [];

  const ids = data
    .map((v) => v.author_id)
    .filter((id): id is string => id !== null);
  const emails = await resolveAuthorEmails(ids);

  return data.map((v) => ({
    ...v,
    authorEmail: v.author_id ? (emails.get(v.author_id) ?? null) : null,
  }));
}

export async function getBriefingFreshness(
  operationId: string,
): Promise<{ hasBriefing: boolean; updatedAt: string | null }> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("briefings")
    .select("updated_at")
    .eq("operation_id", operationId)
    .maybeSingle();
  if (error) throw new Error(`getBriefingFreshness: ${error.message}`);
  return {
    hasBriefing: !!data,
    updatedAt: data?.updated_at ?? null,
  };
}

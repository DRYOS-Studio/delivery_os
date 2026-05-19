import { createAdmin, createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type QuickWinRow = Database["public"]["Tables"]["quick_wins"]["Row"];

export type QuickWinImpactDetail = {
  id: string;
  impactPct: number;
  operationVillainId: string;
  villain: {
    id: string;
    name: string;
    slug: string;
    iconName: string;
    pillVariant: string;
  };
};

export type QuickWinListItem = {
  id: string;
  title: string;
  description: string | null;
  happenedAt: string;
  frenteId: string | null;
  frenteName: string | null;
  executorEmail: string | null;
  impacts: QuickWinImpactDetail[];
};

async function resolveEmails(
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

type RawQW = {
  id: string;
  title: string;
  description: string | null;
  happened_at: string;
  frente_id: string | null;
  executor_id: string | null;
  frente: { id: string; name: string } | null;
  quick_win_impacts:
    | Array<{
        id: string;
        impact_pct: number;
        operation_villain_id: string;
        operation_villain: {
          id: string;
          villain: {
            id: string;
            name: string;
            slug: string;
            icon_name: string;
            pill_variant: string;
          } | null;
        } | null;
      }>
    | null;
};

function mapRow(
  r: RawQW,
  emails: Map<string, string>,
): QuickWinListItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    happenedAt: r.happened_at,
    frenteId: r.frente_id,
    frenteName: r.frente?.name ?? null,
    executorEmail: r.executor_id
      ? (emails.get(r.executor_id) ?? null)
      : null,
    impacts: (r.quick_win_impacts ?? [])
      .filter((imp) => imp.operation_villain?.villain)
      .map((imp) => ({
        id: imp.id,
        impactPct: imp.impact_pct,
        operationVillainId: imp.operation_villain_id,
        villain: {
          id: imp.operation_villain!.villain!.id,
          name: imp.operation_villain!.villain!.name,
          slug: imp.operation_villain!.villain!.slug,
          iconName: imp.operation_villain!.villain!.icon_name,
          pillVariant: imp.operation_villain!.villain!.pill_variant,
        },
      })),
  };
}

const SELECT_FIELDS = `
  id, title, description, happened_at, frente_id, executor_id,
  frente:frentes!fk_quick_wins_frente_id (id, name),
  quick_win_impacts!fk_quick_win_impacts_quick_win_id (
    id, impact_pct, operation_villain_id,
    operation_villain:operation_villains!fk_quick_win_impacts_operation_villain_id (
      id,
      villain:villains!fk_operation_villains_villain_id (
        id, name, slug, icon_name, pill_variant
      )
    )
  )
`;

export async function listQuickWinsByOperation(
  operationId: string,
): Promise<QuickWinListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("quick_wins")
    .select(SELECT_FIELDS)
    .eq("operation_id", operationId)
    .order("happened_at", { ascending: false });
  if (error) throw new Error(`listQuickWinsByOperation: ${error.message}`);
  if (!data) return [];
  const ids = (data as RawQW[])
    .map((r) => r.executor_id)
    .filter((id): id is string => id !== null);
  const emails = await resolveEmails(ids);
  return (data as RawQW[]).map((r) => mapRow(r, emails));
}

export async function getQuickWin(id: string): Promise<QuickWinRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("quick_wins")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getQuickWin: ${error.message}`);
  return data;
}

export async function getQuickWinDetail(
  id: string,
): Promise<QuickWinListItem | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("quick_wins")
    .select(SELECT_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getQuickWinDetail: ${error.message}`);
  if (!data) return null;
  const r = data as RawQW;
  const emails = r.executor_id
    ? await resolveEmails([r.executor_id])
    : new Map<string, string>();
  return mapRow(r, emails);
}

export async function listPublicQuickWins(
  operationId: string,
  limit = 12,
): Promise<QuickWinListItem[]> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("quick_wins")
    .select(SELECT_FIELDS)
    .eq("operation_id", operationId)
    .order("happened_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPublicQuickWins: ${error.message}`);
  if (!data) return [];
  return (data as RawQW[]).map((r) => mapRow(r, new Map()));
}

function periodRange(yyyymm: string): { gte: string; lt: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yyyymm);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const gte = `${year}-${String(month).padStart(2, "0")}-01`;
  const lt = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { gte, lt };
}

export async function listPublicQuickWinsByPeriod(
  operationId: string,
  yyyymm: string,
): Promise<QuickWinListItem[]> {
  const range = periodRange(yyyymm);
  if (!range) return [];
  const admin = createAdmin();
  const { data, error } = await admin
    .from("quick_wins")
    .select(SELECT_FIELDS)
    .eq("operation_id", operationId)
    .gte("happened_at", range.gte)
    .lt("happened_at", range.lt)
    .order("happened_at", { ascending: false });
  if (error) throw new Error(`listPublicQuickWinsByPeriod: ${error.message}`);
  if (!data) return [];
  return (data as RawQW[]).map((r) => mapRow(r, new Map()));
}

export async function countQuickWinsByPeriod(
  operationId: string,
  yyyymm: string,
): Promise<number> {
  const range = periodRange(yyyymm);
  if (!range) return 0;
  const admin = createAdmin();
  const { count, error } = await admin
    .from("quick_wins")
    .select("id", { count: "exact", head: true })
    .eq("operation_id", operationId)
    .gte("happened_at", range.gte)
    .lt("happened_at", range.lt);
  if (error) throw new Error(`countQuickWinsByPeriod: ${error.message}`);
  return count ?? 0;
}

import { createAdmin } from "@/lib/db/client";
import {
  listPublicVillains,
  type OperationVillainListItem,
} from "@/lib/db/queries/operation-villains";
import {
  countQuickWinsByPeriod,
  listPublicQuickWinsByPeriod,
  type QuickWinListItem,
} from "@/lib/db/queries/quick-wins";
import { listVillainNarratives } from "@/lib/db/queries/villain-narratives";
import { formatEtaLabel } from "@/lib/utils/eta";
import {
  getCurrentPeriod,
  operationMonthIndex,
  type Period,
} from "@/lib/utils/period";

export type NextMoveItem = {
  id: string;
  kind: "task" | "meeting";
  title: string;
  date: string;
  etaLabel: string;
};

export type TeamPerson = {
  personId: string;
  name: string;
  roleLabel: string;
  kind: "internal" | "external";
};

export type ReportHeroData = {
  monthLabel: string;
  monthIndex: number;
  activeVillainsCount: number;
  topVillain: { name: string; progressPct: number } | null;
  qwCountCurrent: number;
  qwCountDelta: number | null;
  prevMonthLabel: string;
};

export type ReportContext = {
  period: Period;
  heroData: ReportHeroData;
  villains: OperationVillainListItem[];
  narrativesByVillainId: Record<string, string>;
  quickWins: QuickWinListItem[];
  quickWinsHeaderMeta: string;
  nextMoves: NextMoveItem[];
  team: TeamPerson[];
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchOperationTiming(operationId: string): Promise<{
  startDate: string | null;
  createdAt: string;
} | null> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("operations")
    .select("start_date, created_at")
    .eq("id", operationId)
    .maybeSingle();
  if (error) throw new Error(`fetchOperationTiming: ${error.message}`);
  if (!data) return null;
  return { startDate: data.start_date, createdAt: data.created_at };
}

async function fetchUpcomingTasks(
  operationId: string,
): Promise<NextMoveItem[]> {
  const admin = createAdmin();
  const today = todayISO();
  const { data, error } = await admin
    .from("tasks")
    .select(
      `
      id, title, due_date, status,
      frente:frentes!fk_tasks_frente_id (operation_id, archived_at)
      `,
    )
    // Tarefa de área é interna — NUNCA vaza em link público (invariante 15).
    .is("area_id", null)
    .neq("status", "done")
    .gte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(20);
  if (error) throw new Error(`fetchUpcomingTasks: ${error.message}`);
  type Row = {
    id: string;
    title: string;
    due_date: string | null;
    frente:
      | { operation_id: string; archived_at: string | null }
      | Array<{ operation_id: string; archived_at: string | null }>
      | null;
  };
  const rows = (data ?? []) as Row[];
  return rows
    .filter((r) => {
      const f = Array.isArray(r.frente) ? r.frente[0] : r.frente;
      return (
        f !== null &&
        f !== undefined &&
        f.operation_id === operationId &&
        f.archived_at === null &&
        r.due_date !== null
      );
    })
    .map((r) => ({
      id: r.id,
      kind: "task" as const,
      title: r.title,
      date: r.due_date as string,
      etaLabel: formatEtaLabel(r.due_date as string),
    }));
}

async function fetchUpcomingMeetings(
  operationId: string,
): Promise<NextMoveItem[]> {
  const admin = createAdmin();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("meetings")
    .select("id, title, scheduled_at, visibility")
    .eq("operation_id", operationId)
    .eq("visibility", "cliente")
    .gte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(`fetchUpcomingMeetings: ${error.message}`);
  return (data ?? []).map((m) => ({
    id: m.id,
    kind: "meeting" as const,
    title: m.title,
    date: m.scheduled_at,
    etaLabel: formatEtaLabel(m.scheduled_at),
  }));
}

export async function listPublicNextMoves(
  operationId: string,
  limit = 4,
): Promise<NextMoveItem[]> {
  const [tasks, meetings] = await Promise.all([
    fetchUpcomingTasks(operationId),
    fetchUpcomingMeetings(operationId),
  ]);
  return [...tasks, ...meetings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

export async function listPublicTeam(
  operationId: string,
): Promise<TeamPerson[]> {
  const admin = createAdmin();
  const today = todayISO();
  const { data, error } = await admin
    .from("allocations")
    .select(
      `
      person_id, start_date, end_date,
      frente:frentes!fk_allocations_frente_id (operation_id, archived_at),
      person:persons!fk_allocations_person_id (
        id, name, kind, specialty, external_role, archived_at
      )
      `,
    )
    .lte("start_date", today);
  if (error) throw new Error(`listPublicTeam: ${error.message}`);

  type Row = {
    person_id: string;
    start_date: string;
    end_date: string | null;
    frente:
      | { operation_id: string; archived_at: string | null }
      | Array<{ operation_id: string; archived_at: string | null }>
      | null;
    person:
      | {
          id: string;
          name: string;
          kind: "internal" | "external";
          specialty: string | null;
          external_role: string | null;
          archived_at: string | null;
        }
      | Array<{
          id: string;
          name: string;
          kind: "internal" | "external";
          specialty: string | null;
          external_role: string | null;
          archived_at: string | null;
        }>
      | null;
  };

  const rows = (data ?? []) as Row[];
  const seen = new Map<string, TeamPerson>();
  for (const r of rows) {
    if (r.end_date !== null && r.end_date <= today) continue;
    const frente = Array.isArray(r.frente) ? r.frente[0] : r.frente;
    if (!frente || frente.operation_id !== operationId) continue;
    if (frente.archived_at !== null) continue;
    const person = Array.isArray(r.person) ? r.person[0] : r.person;
    if (!person || person.archived_at !== null) continue;
    if (seen.has(person.id)) continue;
    const roleLabel =
      person.kind === "internal"
        ? person.specialty ?? "Time DRYOS"
        : person.external_role ?? "Time do cliente";
    seen.set(person.id, {
      personId: person.id,
      name: person.name,
      roleLabel,
      kind: person.kind,
    });
  }
  return Array.from(seen.values());
}

function pickTopVillain(
  villains: OperationVillainListItem[],
): { name: string; progressPct: number } | null {
  const candidates = villains.filter(
    (v) => v.villain.archivedAt === null && v.progressPct > 0,
  );
  if (candidates.length === 0) return null;
  const top = candidates[0];
  if (!top) return null;
  return { name: top.villain.name, progressPct: top.progressPct };
}

export async function getReportContext(
  operationId: string,
  period: Period = getCurrentPeriod(),
): Promise<ReportContext | null> {
  const timing = await fetchOperationTiming(operationId);
  if (!timing) return null;

  const [
    villains,
    narrativesByVillainId,
    quickWins,
    qwCountCurrent,
    qwCountPrev,
    nextMoves,
    team,
  ] = await Promise.all([
    listPublicVillains(operationId),
    listVillainNarratives(operationId, period.yyyymm),
    listPublicQuickWinsByPeriod(operationId, period.yyyymm),
    countQuickWinsByPeriod(operationId, period.yyyymm),
    countQuickWinsByPeriod(operationId, period.prevYyyymm),
    listPublicNextMoves(operationId, 4),
    listPublicTeam(operationId),
  ]);

  const activeVillainsCount = villains.filter(
    (v) => v.villain.archivedAt === null,
  ).length;

  const heroData: ReportHeroData = {
    monthLabel: period.monthLabel,
    monthIndex: operationMonthIndex(timing.startDate, timing.createdAt),
    activeVillainsCount,
    topVillain: pickTopVillain(villains),
    qwCountCurrent,
    qwCountDelta: qwCountPrev === 0 ? null : qwCountCurrent - qwCountPrev,
    prevMonthLabel: period.prevMonthLabel,
  };

  const quickWinsHeaderMeta = `${period.monthLabel} · ${qwCountCurrent} quick win${qwCountCurrent === 1 ? "" : "s"}`;

  return {
    period,
    heroData,
    villains,
    narrativesByVillainId,
    quickWins,
    quickWinsHeaderMeta,
    nextMoves,
    team,
  };
}

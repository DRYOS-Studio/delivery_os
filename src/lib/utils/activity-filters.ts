/** Categorias de filtro expostas na UI (mapeiam para ações SQL). */
export const ACTIVITY_FILTER_CATEGORIES = [
  "all",
  "created",
  "updated",
  "status",
  "assignee",
  "comments",
] as const;

export type ActivityFilterCategory = (typeof ACTIVITY_FILTER_CATEGORIES)[number];

export const ACTIVITY_FILTER_CATEGORY_LABELS: Record<
  ActivityFilterCategory,
  string
> = {
  all: "Tudo",
  created: "Criação",
  updated: "Alterações",
  status: "Status",
  assignee: "Responsáveis",
  comments: "Comentários",
};

const CREATED_ACTIONS = ["created"] as const;
const UPDATED_ACTIONS = ["updated"] as const;
const ASSIGNEE_ACTIONS = ["assignee_added", "assignee_removed"] as const;
const COMMENT_ACTIONS = [
  "comment_created",
  "comment_updated",
  "comment_deleted",
] as const;

/** Ações conhecidas no audit trail (triggers + RPC). */
export const KNOWN_ACTIVITY_ACTIONS = [
  ...CREATED_ACTIONS,
  ...UPDATED_ACTIONS,
  ...ASSIGNEE_ACTIONS,
  ...COMMENT_ACTIONS,
] as const;

export type KnownActivityAction = (typeof KNOWN_ACTIVITY_ACTIONS)[number];

export function actionsForCategory(
  category: ActivityFilterCategory,
): readonly string[] | null {
  switch (category) {
    case "all":
      return null;
    case "created":
      return CREATED_ACTIONS;
    case "updated":
      return UPDATED_ACTIONS;
    case "status":
      return UPDATED_ACTIONS;
    case "assignee":
      return ASSIGNEE_ACTIONS;
    case "comments":
      return COMMENT_ACTIONS;
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

/** No filtro “status”, restringe field_key = status no pós-filtro ou via query. */
export function isStatusOnlyCategory(category: ActivityFilterCategory): boolean {
  return category === "status";
}

export const ACTIVITY_DATE_PRESETS = [
  "all",
  "today",
  "7d",
  "30d",
] as const;

export type ActivityDatePreset = (typeof ACTIVITY_DATE_PRESETS)[number];

export const ACTIVITY_DATE_PRESET_LABELS: Record<ActivityDatePreset, string> = {
  all: "Qualquer data",
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
};

export type ActivityDateRange = {
  createdAfter?: string;
  createdBefore?: string;
};

/** Intervalo inclusivo em ISO (timestamptz) para queries Supabase. */
export function dateRangeForPreset(
  preset: ActivityDatePreset,
  now: Date = new Date(),
): ActivityDateRange {
  if (preset === "all") return {};

  const end = new Date(now);
  const start = new Date(now);

  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (preset === "7d") {
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else {
    const _exhaustive: never = preset;
    return _exhaustive;
  }

  return {
    createdAfter: start.toISOString(),
    createdBefore: end.toISOString(),
  };
}

export type ActivityListFilters = {
  category?: ActivityFilterCategory;
  datePreset?: ActivityDatePreset;
  limit?: number;
  offset?: number;
};

export function resolveActivityListFilters(
  filters: ActivityListFilters,
): {
  actions: readonly string[] | null;
  statusFieldOnly: boolean;
  dateRange: ActivityDateRange;
  limit: number;
  offset: number;
} {
  const category = filters.category ?? "all";
  const datePreset = filters.datePreset ?? "all";
  return {
    actions: actionsForCategory(category),
    statusFieldOnly: isStatusOnlyCategory(category),
    dateRange: dateRangeForPreset(datePreset),
    limit: Math.min(Math.max(filters.limit ?? 50, 1), 100),
    offset: Math.max(filters.offset ?? 0, 0),
  };
}

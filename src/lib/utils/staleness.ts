import type { PillVariant } from "@/components/ui/Pill";

export const STALENESS_THRESHOLDS = {
  warm: 7,
  hot: 14,
  critical: 21,
} as const;

export type StalenessLevel = "fresh" | "warm" | "hot" | "critical";

export function daysSince(since: string | null | undefined): number {
  if (!since) return 0;
  const d = new Date(since);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

export function stalenessLevel(
  since: string | null | undefined,
): StalenessLevel {
  const days = daysSince(since);
  if (days < STALENESS_THRESHOLDS.warm) return "fresh";
  if (days < STALENESS_THRESHOLDS.hot) return "warm";
  if (days < STALENESS_THRESHOLDS.critical) return "hot";
  return "critical";
}

export type StalenessLabel = {
  text: string;
  variant: PillVariant;
};

export function stalenessLabel(
  since: string | null | undefined,
): StalenessLabel | null {
  const level = stalenessLevel(since);
  const days = daysSince(since);
  if (level === "fresh") return null;
  if (level === "warm") return { text: `Há ${days}d`, variant: "oak" };
  if (level === "hot")
    return { text: `Há ${days}d · revisitar`, variant: "warning" };
  return { text: `Há ${days}d · atenção`, variant: "critical" };
}

export function isHotOrCritical(level: StalenessLevel): boolean {
  return level === "hot" || level === "critical";
}

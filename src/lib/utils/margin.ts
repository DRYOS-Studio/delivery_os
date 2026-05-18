import type { PillVariant } from "@/components/ui/Pill";

export type MarginLevel = "positive" | "low" | "negative";

export type MarginResult = {
  value: number;
  pct: number | null;
  level: MarginLevel;
};

export function computeMargin(
  mrr: number | null | undefined,
  monthlyCost: number,
): MarginResult {
  const m = mrr ?? 0;
  const value = m - monthlyCost;
  const pct = m > 0 ? (value / m) * 100 : null;
  let level: MarginLevel;
  if (value < 0) {
    level = "negative";
  } else if (pct !== null && pct <= 10) {
    level = "low";
  } else {
    level = "positive";
  }
  return { value, pct, level };
}

export function marginVariant(level: MarginLevel): PillVariant {
  return level === "positive"
    ? "sage"
    : level === "low"
      ? "warning"
      : "critical";
}

export function formatMarginPct(pct: number | null): string {
  if (pct === null) return "—";
  return `${pct.toFixed(0)}%`;
}

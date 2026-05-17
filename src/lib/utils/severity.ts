import type { PillVariant } from "@/components/ui/Pill";

export type SeverityLevel = "low" | "medium" | "high" | "critical";

export const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const SEVERITY_VARIANT: Record<SeverityLevel, PillVariant> = {
  low: "neutral",
  medium: "oak",
  high: "warning",
  critical: "critical",
};

export function progressVariant(pct: number): PillVariant {
  if (pct >= 75) return "sage";
  if (pct >= 50) return "ok";
  if (pct >= 25) return "oak";
  return "warning";
}

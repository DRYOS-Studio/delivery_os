import type { Database } from "@/lib/db/types";

export type CycleType = Database["public"]["Enums"]["frente_cycle_type"];

const SHORT_LABELS: Record<CycleType, string> = {
  a: "Tipo A · Finito",
  b: "Tipo B · Finito→recorrente",
  c: "Tipo C · Contínuo",
  d: "Tipo D · Episódico",
  e: "Tipo E · Manutenção",
};

const LONG_LABELS: Record<CycleType, string> = {
  a: "Tipo A — Finito puro (Studio Custom)",
  b: "Tipo B — Finito → recorrente (Studio com cláusula)",
  c: "Tipo C — Contínuo (Core/Sparks)",
  d: "Tipo D — Episódico recorrente (Studio Launch)",
  e: "Tipo E — Manutenção contínua (Evergreen)",
};

/**
 * Compact label for pills/badges — "Tipo C · Contínuo". Fits in tight spaces
 * but still tells the reader what the letter means.
 */
export function formatCycleTypeShort(t: CycleType): string {
  return SHORT_LABELS[t];
}

/**
 * Full label for selects and detail views — "Tipo C — Contínuo (Core/Sparks)".
 * Always include the modality so the reader doesn't need the PRD memorized.
 */
export function formatCycleTypeLong(t: CycleType): string {
  return LONG_LABELS[t];
}

export const CYCLE_TYPE_VALUES: ReadonlyArray<CycleType> = [
  "a",
  "b",
  "c",
  "d",
  "e",
];

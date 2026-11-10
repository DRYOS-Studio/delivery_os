import type { Database } from "@/lib/db/types";

export type SlaSeverity = Database["public"]["Enums"]["sla_severity"];

/**
 * Mapa padrão ntfy priority (1–5, 1=min) → severidade SLA.
 * Sobrescritível por `operation_ntfy_topics.priority_severity_map` (chaves "1".."5").
 */
export const DEFAULT_NTFY_PRIORITY_SEVERITY_MAP: Record<string, SlaSeverity> = {
  "1": "low",
  "2": "low",
  "3": "medium",
  "4": "high",
  "5": "high",
};

export function parseNtfyPriority(raw: number | string | undefined): number | null {
  if (raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

export function mapNtfyPriorityToSeverity(
  raw: number | string | undefined,
  customMap: Record<string, string> | null | undefined,
): SlaSeverity {
  const map: Record<string, SlaSeverity> = {
    ...DEFAULT_NTFY_PRIORITY_SEVERITY_MAP,
  };
  if (customMap) {
    for (const [k, v] of Object.entries(customMap)) {
      if (v === "low" || v === "medium" || v === "high") {
        map[k] = v;
      }
    }
  }
  const p = parseNtfyPriority(raw) ?? 3;
  return map[String(p)] ?? "medium";
}

export function problemOriginExcludesSlaBreach(
  origin: "dryos" | "client" | "vendor" | "unclassified",
): boolean {
  return origin === "vendor";
}

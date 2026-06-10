import type { Database } from "@/lib/db/types";

// Constantes puras de área (CS/Financeiro/Jurídico). Módulo SEM import de
// servidor (next/headers) — pode ser importado por client components.
// As queries de servidor ficam em @/lib/db/queries/profile-areas.

export type TaskArea = Database["public"]["Enums"]["task_area"];

export const ALL_AREAS: readonly TaskArea[] = ["cs", "financeiro", "juridico"];

export const AREA_LABELS: Record<TaskArea, string> = {
  cs: "CS",
  financeiro: "Financeiro",
  juridico: "Jurídico",
};

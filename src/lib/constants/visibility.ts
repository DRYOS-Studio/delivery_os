import type { PillVariant } from "@/components/ui/Pill";

export const VISIBILITY_LABEL = {
  interno: "Interno",
  cliente: "Cliente",
} as const;

export const VISIBILITY_VARIANT: Record<
  "interno" | "cliente",
  PillVariant
> = {
  interno: "warning",
  cliente: "sage",
};

export type VisibilityValue = "interno" | "cliente";

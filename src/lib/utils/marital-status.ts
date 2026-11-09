/** Opções canônicas de estado civil (PF e representante legal PJ). */

export const MARITAL_STATUS_OPTIONS = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
  "Separado(a) judicialmente",
] as const;

export type MaritalStatusOption = (typeof MARITAL_STATUS_OPTIONS)[number];

export type StatusFilter =
  | "todas"
  | "em_construcao"
  | "em_operacao"
  | "janela_critica";

const VALID: ReadonlyArray<StatusFilter> = [
  "todas",
  "em_construcao",
  "em_operacao",
  "janela_critica",
];

export function normalizeStatusFilter(raw: string | undefined): StatusFilter {
  return VALID.includes(raw as StatusFilter) ? (raw as StatusFilter) : "todas";
}

import type { PillVariant } from "@/components/ui/Pill";
import type { Database } from "@/lib/db/types";

/**
 * Fonte única do ciclo de vida da Operação.
 *
 * `OperationStatus` é ancorado no enum GERADO — nunca uma união escrita à mão. É o que
 * faz `OPERATION_STATUS` ser exaustivo de verdade: adicionar valor ao enum no banco e
 * rodar `gen:types` quebra o build **neste arquivo** até alguém classificar o status.
 * União à mão compila e fica cega ao valor novo.
 *
 * Dois eixos, deliberadamente distintos:
 * - `active`  → entra em agregados, contagens, pickers e guards de criação.
 * - `archived_at` (coluna, não daqui) → visibilidade nas listas.
 * Status terminal sai dos agregados mas CONTINUA listado, senão encerrar faria a
 * Operação sumir antes de poder ser arquivada.
 */
export type OperationStatus = Database["public"]["Enums"]["operation_status"];

/** Onde o status pode ser escolhido no formulário. `[]` = nunca (legado). */
type SelectableOn = ReadonlyArray<"create" | "edit">;

type StatusMeta = {
  label: string;
  variant: PillVariant;
  active: boolean;
  selectableOn: SelectableOn;
};

const OPERATION_STATUS: Record<OperationStatus, StatusMeta> = {
  em_construcao: {
    label: "Em construção",
    variant: "neutral",
    active: true,
    selectableOn: ["create", "edit"],
  },
  em_operacao: {
    label: "Em operação",
    variant: "sage",
    active: true,
    selectableOn: ["create", "edit"],
  },
  janela_critica: {
    label: "Janela crítica",
    variant: "warning",
    active: true,
    selectableOn: ["edit"],
  },
  concluida: {
    label: "Concluída",
    variant: "ok",
    active: false,
    selectableOn: ["edit"],
  },
  cancelada: {
    label: "Cancelada",
    variant: "critical",
    active: false,
    selectableOn: ["edit"],
  },
  // Legado: 0 linhas em produção. Nunca alvo de escrita nova — arquivar grava
  // `archived_at`, não este status.
  arquivada: {
    label: "Arquivada",
    variant: "neutral",
    active: false,
    selectableOn: [],
  },
};

const ALL_STATUSES = Object.keys(OPERATION_STATUS) as OperationStatus[];

/** Statuses que contam como Operação viva — usar em `.in("status", …)`. */
export const ACTIVE_STATUSES: OperationStatus[] = ALL_STATUSES.filter(
  (s) => OPERATION_STATUS[s].active,
);

/** Complemento de `ACTIVE_STATUSES`. Derivado, nunca escrito à mão. */
export const TERMINAL_STATUSES: OperationStatus[] = ALL_STATUSES.filter(
  (s) => !OPERATION_STATUS[s].active,
);

/**
 * Statuses que o formulário pode gravar — derivado de `selectableOn`, não de
 * `Object.keys`: um `Object.keys` ingênuo aceitaria `arquivada` na escrita, contra a
 * regra de que arquivar grava `archived_at` e nunca este status.
 * A distinção create × edit NÃO vive aqui: o schema Zod é compartilhado pelas duas
 * actions, então ela vive só em `selectableStatuses(mode)`, no form.
 */
export const WRITABLE_STATUSES = ALL_STATUSES.filter(
  (s) => OPERATION_STATUS[s].selectableOn.length > 0,
) as [OperationStatus, ...OperationStatus[]];

export function isActiveStatus(status: OperationStatus): boolean {
  return OPERATION_STATUS[status].active;
}

export function statusLabel(status: OperationStatus): string {
  return OPERATION_STATUS[status].label;
}

export function statusPillVariant(status: OperationStatus): PillVariant {
  return OPERATION_STATUS[status].variant;
}

/**
 * Opções do `<select>` por modo. `selectableOn` é lista, não string: `em_construcao` e
 * `em_operacao` valem nos DOIS modos, e uma string única não expressa isso — a leitura
 * simétrica removeria os dois da edição.
 */
export function selectableStatuses(
  mode: "create" | "edit",
): { value: OperationStatus; label: string }[] {
  return ALL_STATUSES.filter((s) =>
    OPERATION_STATUS[s].selectableOn.includes(mode),
  ).map((s) => ({ value: s, label: OPERATION_STATUS[s].label }));
}

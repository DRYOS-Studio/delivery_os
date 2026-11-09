"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { OperationMonthlyCostItemRow } from "@/lib/db/queries/operation-monthly-cost-items";
import { formatMoneyBR, parseMoneyBR } from "@/lib/utils/money";
import {
  OPERATION_MONTHLY_COST_CATEGORIES_UI,
  operationMonthlyCostCategoryLabel,
  sumMonthlyCostItems,
  categorySubtotals,
  type OperationMonthlyCostCategory,
} from "@/lib/utils/operation-monthly-cost-category";
import type { OperationMonthlyCostItemFormRow } from "@/lib/validators/operation-monthly-cost-item";

const inputCn =
  "w-full font-body text-sm text-ink bg-white border border-line rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-oak disabled:opacity-60";
const selectCn = `${inputCn} cursor-pointer`;

type Props = {
  items: OperationMonthlyCostItemFormRow[];
  onChange: (items: OperationMonthlyCostItemFormRow[]) => void;
  disabled?: boolean;
  error?: string | undefined;
};

function emptyRow(): OperationMonthlyCostItemFormRow {
  return {
    category: "time",
    amount: 0,
    description: null,
  };
}

function categoriesForSelect(
  current: OperationMonthlyCostCategory,
): OperationMonthlyCostCategory[] {
  if (current === "a_classificar") {
    return [...OPERATION_MONTHLY_COST_CATEGORIES_UI, "a_classificar"];
  }
  return [...OPERATION_MONTHLY_COST_CATEGORIES_UI];
}

function fromDb(rows: OperationMonthlyCostItemRow[]): OperationMonthlyCostItemFormRow[] {
  return rows.map((r) => ({
    id: r.id,
    category:
      r.category === "a_classificar"
        ? "a_classificar"
        : OPERATION_MONTHLY_COST_CATEGORIES_UI.includes(
              r.category as (typeof OPERATION_MONTHLY_COST_CATEGORIES_UI)[number],
            )
          ? (r.category as (typeof OPERATION_MONTHLY_COST_CATEGORIES_UI)[number])
          : "time",
    amount: r.amount,
    description: r.description,
  }));
}

export function initialMonthlyCostFormRows(
  rows: OperationMonthlyCostItemRow[],
): OperationMonthlyCostItemFormRow[] {
  return fromDb(rows);
}

export function OperationMonthlyCostItemsField({
  items,
  onChange,
  disabled = false,
  error,
}: Props): React.JSX.Element {
  const subtotals = categorySubtotals(
    items.map((i) => ({
      category: i.category as OperationMonthlyCostCategory,
      amount: i.amount,
    })),
  );
  const total = sumMonthlyCostItems(items);

  function updateAt(
    index: number,
    patch: Partial<OperationMonthlyCostItemFormRow>,
  ): void {
    const next = items.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    );
    onChange(next);
  }

  function removeAt(index: number): void {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="font-display text-base text-ink font-semibold">
            Custos mensais
          </p>
          <p className="font-body text-xs text-mute mt-0.5">
            Itens categorizados que entram no cálculo da margem (além de
            alocações, ad-hoc e impostos).
          </p>
        </div>
        <Button
          type="button"
          variant="sage"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...items, emptyRow()])}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
          Novo custo
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-critical font-body" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="border border-dashed border-line rounded p-6 text-center text-sm text-mute">
          Nenhum item. Use &quot;+ Novo custo&quot; para adicionar.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((row, index) => (
            <li
              key={row.id ?? `new-${index}`}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 border border-line rounded p-4 bg-card"
            >
              <div className="md:col-span-3">
                <label className="font-mono text-[10px] uppercase text-mute block mb-1">
                  Categoria
                </label>
                <select
                  className={selectCn}
                  disabled={disabled}
                  value={row.category}
                  onChange={(e) =>
                    updateAt(index, {
                      category: e.target
                        .value as OperationMonthlyCostItemFormRow["category"],
                    })
                  }
                >
                  {categoriesForSelect(row.category as OperationMonthlyCostCategory).map(
                    (c) => (
                      <option key={c} value={c}>
                        {operationMonthlyCostCategoryLabel(c)}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="font-mono text-[10px] uppercase text-mute block mb-1">
                  Valor mensal (BRL)
                </label>
                <input
                  id={`cost-amt-${index}`}
                  type="text"
                  inputMode="decimal"
                  className={inputCn}
                  disabled={disabled}
                  value={row.amount > 0 ? formatMoneyBR(row.amount) : ""}
                  placeholder="R$ 0,00"
                  onChange={(e) => {
                    const parsed = parseMoneyBR(e.target.value);
                    updateAt(index, { amount: parsed ?? 0 });
                  }}
                />
              </div>
              <div className="md:col-span-5">
                <label className="font-mono text-[10px] uppercase text-mute block mb-1">
                  Descrição (opcional)
                </label>
                <input
                  id={`cost-desc-${index}`}
                  type="text"
                  className={inputCn}
                  disabled={disabled}
                  value={row.description ?? ""}
                  onChange={(e) =>
                    updateAt(index, {
                      description: e.target.value.trim() || null,
                    })
                  }
                  maxLength={500}
                />
              </div>
              <div className="md:col-span-1 flex items-end justify-end">
                <button
                  type="button"
                  className="p-2 text-mute hover:text-critical rounded"
                  disabled={disabled}
                  aria-label="Remover item"
                  onClick={() => removeAt(index)}
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(items.length > 0 || total > 0) && (
        <div className="bg-card border border-line rounded p-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
            Resumo
          </p>
          <ul className="space-y-1 text-sm text-ink">
            {(
              Object.entries(subtotals) as Array<
                [OperationMonthlyCostCategory, number]
              >
            ).map(([cat, val]) => (
              <li key={cat} className="flex justify-between gap-4">
                <span>{operationMonthlyCostCategoryLabel(cat)}</span>
                <span className="font-mono">{formatMoneyBR(val)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between gap-4 pt-2 border-t border-line font-semibold">
            <span>Total mensal (itens)</span>
            <span className="font-display text-lg">{formatMoneyBR(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

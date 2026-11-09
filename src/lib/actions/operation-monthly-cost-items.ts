"use server";

import {
  type ActionResult,
  dbErr,
  err,
  ok,
} from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { listOperationMonthlyCostItems } from "@/lib/db/queries/operation-monthly-cost-items";
import { OPERATION_MONTHLY_COST_CATEGORIES_UI } from "@/lib/utils/operation-monthly-cost-category";
import {
  operationMonthlyCostItemFormRowSchema,
  type OperationMonthlyCostItemFormRow,
} from "@/lib/validators/operation-monthly-cost-item";
import { z } from "zod";

const syncSchema = z
  .object({
    items: z.array(operationMonthlyCostItemFormRowSchema),
  })
  .superRefine((data, ctx) => {
    data.items.forEach((row, index) => {
      if (
        !row.id &&
        row.category === "a_classificar"
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Escolha uma categoria válida para novos itens.",
          path: ["items", index, "category"],
        });
      }
      if (
        !row.id &&
        !OPERATION_MONTHLY_COST_CATEGORIES_UI.includes(
          row.category as (typeof OPERATION_MONTHLY_COST_CATEGORIES_UI)[number],
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Categoria inválida.",
          path: ["items", index, "category"],
        });
      }
    });
  });

export async function syncOperationMonthlyCostItemsAction(
  operationId: string,
  items: OperationMonthlyCostItemFormRow[],
): Promise<ActionResult<{ count: number }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const parsed = syncSchema.safeParse({ items });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Itens de custo inválidos.", "validation");
  }

  const supabase = await createServer();
  const existing = await listOperationMonthlyCostItems(operationId, supabase);
  const existingIds = new Set(existing.map((e) => e.id));
  const desiredIds = new Set(
    parsed.data.items
      .map((i) => i.id)
      .filter((id): id is string => typeof id === "string"),
  );

  for (const row of parsed.data.items) {
    if (row.id && existingIds.has(row.id)) {
      const { error } = await supabase
        .from("operation_monthly_cost_items")
        .update({
          category: row.category,
          amount: row.amount,
          description: row.description?.trim() || null,
        })
        .eq("id", row.id)
        .eq("operation_id", operationId);
      if (error) return dbErr(error, "syncOperationMonthlyCostItems.update");
    } else {
      const { error } = await supabase.from("operation_monthly_cost_items").insert({
        operation_id: operationId,
        category: row.category,
        amount: row.amount,
        description: row.description?.trim() || null,
      });
      if (error) return dbErr(error, "syncOperationMonthlyCostItems.insert");
    }
  }

  for (const ex of existing) {
    if (!desiredIds.has(ex.id)) {
      const { error } = await supabase
        .from("operation_monthly_cost_items")
        .delete()
        .eq("id", ex.id)
        .eq("operation_id", operationId);
      if (error) return dbErr(error, "syncOperationMonthlyCostItems.delete");
    }
  }

  return ok({ count: parsed.data.items.length });
}

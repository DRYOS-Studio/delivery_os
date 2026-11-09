import { z } from "zod";
import { OPERATION_MONTHLY_COST_CATEGORIES_UI } from "@/lib/utils/operation-monthly-cost-category";

const categoryEnum = z.enum([
  "comissoes",
  "servicos_terceiros",
  "time",
  "infra",
  "a_classificar",
]);

export const operationMonthlyCostItemCategoryCreate = z.enum(
  OPERATION_MONTHLY_COST_CATEGORIES_UI,
);

const amountInput = z
  .number({ message: "Valor obrigatório." })
  .nonnegative("Valor não pode ser negativo.");

export const operationMonthlyCostItemSchema = z.object({
  category: categoryEnum,
  amount: amountInput,
  description: z
    .string()
    .trim()
    .max(500, "Descrição muito longa.")
    .optional()
    .nullable(),
});

export const operationMonthlyCostItemCreateSchema =
  operationMonthlyCostItemSchema.extend({
    category: operationMonthlyCostItemCategoryCreate,
  });

export type OperationMonthlyCostItemInput = z.infer<
  typeof operationMonthlyCostItemSchema
>;

/** Item no formulário (id vazio = novo; removidos omitidos do payload). */
export const operationMonthlyCostItemFormRowSchema = z.object({
  id: z.string().uuid().optional(),
  category: categoryEnum,
  amount: amountInput,
  description: z.string().trim().max(500).optional().nullable(),
});

export type OperationMonthlyCostItemFormRow = z.infer<
  typeof operationMonthlyCostItemFormRowSchema
>;

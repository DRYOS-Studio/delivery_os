import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export type OperationFinancialRow =
  Database["public"]["Tables"]["operation_financials"]["Row"];

export async function upsertOperationFinancials(
  supabase: SupabaseClient<Database>,
  operationId: string,
  patch: Database["public"]["Tables"]["operation_financials"]["Insert"],
): Promise<void> {
  const { error } = await supabase.from("operation_financials").upsert(
    {
      operation_id: operationId,
      recurrence: patch.recurrence ?? null,
      monthly_recurring_revenue: patch.monthly_recurring_revenue ?? null,
      monthly_fixed_cost: patch.monthly_fixed_cost ?? null,
      tax_rate_pct: patch.tax_rate_pct ?? null,
      notification_webhook_url: patch.notification_webhook_url ?? null,
    },
    { onConflict: "operation_id" },
  );
  if (error) throw new Error(`upsertOperationFinancials: ${error.message}`);
}

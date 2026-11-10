import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type OperationNtfyTopicRow =
  Database["public"]["Tables"]["operation_ntfy_topics"]["Row"];

export async function listNtfyTopicsByOperation(
  operationId: string,
): Promise<OperationNtfyTopicRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_ntfy_topics")
    .select("*")
    .eq("operation_id", operationId)
    .order("topic", { ascending: true });
  if (error) throw new Error(`listNtfyTopicsByOperation: ${error.message}`);
  return data ?? [];
}

import { createServer } from "@/lib/db/client";
import { normalizeEmbedOne } from "@/lib/db/normalize-embed";
import type { Database } from "@/lib/db/types";

type Op = Database["public"]["Tables"]["operations"]["Row"];

/** Select mínimo para `/operations/[id]/meetings/new` — sem financeiro nem frentes aninhadas. */
export const OPERATION_MEETING_NEW_SELECT = `
  id, name, product_line, status,
  client:clients!fk_operations_client_id!inner(id, name, slug, archived_at)
`;

export type OperationMeetingContext = {
  id: string;
  name: string;
  productLine: Op["product_line"];
  status: Op["status"];
  client: { id: string; name: string; slug: string };
};

type ClientEmbed = {
  id: string;
  name: string;
  slug: string;
  archived_at: string | null;
};

/**
 * Contexto da Operação para criar reunião (onboarding ou geral).
 * Evita o detalhe completo (`getOperation`), que embute financeiro admin e
 * frentes/tarefas — falha em produção se `operation_financials` atrasar no
 * schema PostgREST e é desnecessário para o formulário.
 */
export async function getOperationMeetingContext(
  operationId: string,
): Promise<OperationMeetingContext | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operations")
    .select(OPERATION_MEETING_NEW_SELECT)
    .eq("id", operationId)
    .is("archived_at", null)
    .is("client.archived_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`getOperationMeetingContext: ${error.message}`);
  }
  if (!data) return null;

  const row = data as {
    id: string;
    name: string;
    product_line: Op["product_line"];
    status: Op["status"];
    client: ClientEmbed | ClientEmbed[] | null;
  };

  const clientEmbed = normalizeEmbedOne(row.client);
  if (!clientEmbed) return null;

  return {
    id: row.id,
    name: row.name,
    productLine: row.product_line,
    status: row.status,
    client: {
      id: clientEmbed.id,
      name: clientEmbed.name,
      slug: clientEmbed.slug,
    },
  };
}
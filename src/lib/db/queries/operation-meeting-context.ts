import { operationCatalogLineLabel } from "@/lib/catalog/operation-catalog-group";
import { createServer } from "@/lib/db/client";
import { withCatalogGroupSelectFallback } from "@/lib/db/queries/operation-catalog-fallback";
import { normalizeEmbedOne } from "@/lib/db/normalize-embed";
import type { Database } from "@/lib/db/types";
import { isUuid } from "@/lib/utils/uuid";

type Op = Database["public"]["Tables"]["operations"]["Row"];

/** Select mínimo para `/operations/[id]/meetings/new` — sem financeiro nem frentes aninhadas. */
export const OPERATION_MEETING_NEW_SELECT = `
  id, name, catalog_group, product_line, status,
  client:clients!fk_operations_client_id!inner(id, name, slug, archived_at)
`;

export type OperationMeetingContext = {
  id: string;
  name: string;
  catalogLineLabel: string;
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
  const { data, error } = await withCatalogGroupSelectFallback(
    OPERATION_MEETING_NEW_SELECT,
    async (select) =>
      await supabase
        .from("operations")
        .select(select)
        .eq("id", operationId)
        .is("archived_at", null)
        .maybeSingle(),
  );

  if (error) {
    throw new Error(`getOperationMeetingContext: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    name: string;
    catalog_group?: Op["catalog_group"] | null;
    product_line: Op["product_line"];
    status: Op["status"];
    client: ClientEmbed | ClientEmbed[] | null;
  };

  const clientEmbed = normalizeEmbedOne(row.client);
  if (!clientEmbed || clientEmbed.archived_at !== null) return null;
  if (!isUuid(clientEmbed.id)) {
    throw new Error(
      "getOperationMeetingContext: embed client sem id válido",
    );
  }

  return {
    id: row.id,
    name: row.name,
    catalogLineLabel: operationCatalogLineLabel(
      row.catalog_group,
      row.product_line,
    ),
    status: row.status,
    client: {
      id: clientEmbed.id,
      name: clientEmbed.name,
      slug: clientEmbed.slug,
    },
  };
}
import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

type Op = Database["public"]["Tables"]["operations"]["Row"];
type Frente = Database["public"]["Tables"]["frentes"]["Row"];

type FrenteForCard = Pick<
  Frente,
  | "id"
  | "name"
  | "cycle_type"
  | "actionable_status"
  | "actionable_status_since"
  | "created_at"
>;

export type OperationCardData = {
  id: string;
  clientName: string;
  operationName: string;
  productLine: Op["product_line"];
  status: Op["status"];
  firstFrente: FrenteForCard | null;
  teamSize: number;
};

export async function getActiveOperations(): Promise<OperationCardData[]> {
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("operations")
    .select(
      `
      id,
      name,
      status,
      product_line,
      client:clients(name, slug),
      frentes(
        id,
        name,
        cycle_type,
        actionable_status,
        actionable_status_since,
        created_at,
        allocations(id)
      )
      `,
    )
    .is("archived_at", null)
    .neq("status", "arquivada")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getActiveOperations: ${error.message}`);
  }

  if (!data) return [];

  return data.map((op): OperationCardData => {
    const frentes = (op.frentes ?? []).slice().sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return aTime - bTime;
    });

    const firstFrenteRow = frentes[0] ?? null;

    const teamSize = (op.frentes ?? []).reduce(
      (sum, f) => sum + (f.allocations?.length ?? 0),
      0,
    );

    return {
      id: op.id,
      clientName: op.client?.name ?? "—",
      operationName: op.name,
      productLine: op.product_line,
      status: op.status,
      firstFrente: firstFrenteRow
        ? {
            id: firstFrenteRow.id,
            name: firstFrenteRow.name,
            cycle_type: firstFrenteRow.cycle_type,
            actionable_status: firstFrenteRow.actionable_status,
            actionable_status_since: firstFrenteRow.actionable_status_since,
            created_at: firstFrenteRow.created_at,
          }
        : null,
      teamSize,
    };
  });
}

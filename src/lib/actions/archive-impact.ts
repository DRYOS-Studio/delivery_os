"use server";

import { type ActionResult, ok, rpcErr } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

export type OperationArchiveImpact = { frentes: number; alocacoes: number };
export type ClientArchiveImpact = {
  operacoes: number;
  frentes: number;
  alocacoes: number;
};

/**
 * O conjunto contado vive no SQL, colado na cascata — não aqui.
 *
 * Reimplementar o `WHERE` em supabase-js criaria dois donos da mesma regra em
 * linguagens diferentes, sem guarda de compilação e sem test runner: editar o `WHERE`
 * da cascata e esquecer o daqui não quebraria nada, o diálogo só passaria a mentir.
 * Também evita a armadilha do `!inner` (sem ele o filtro do embed é descartado em
 * silêncio e a contagem vira a do banco inteiro).
 *
 * `createServer()` e não `createAdmin()`: a RLS continua valendo.
 */
export async function getOperationArchiveImpact(
  operationId: string,
): Promise<ActionResult<OperationArchiveImpact>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const supabase = await createServer();
  const { data, error } = await supabase.rpc("archive_operation_impact", {
    p_operation_id: operationId,
  });
  if (error) return rpcErr(error, "getOperationArchiveImpact");

  const row = data?.[0];
  return ok({
    frentes: row?.frentes ?? 0,
    alocacoes: row?.alocacoes ?? 0,
  });
}

export async function getClientArchiveImpact(
  clientId: string,
): Promise<ActionResult<ClientArchiveImpact>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const supabase = await createServer();
  const { data, error } = await supabase.rpc("archive_client_impact", {
    p_client_id: clientId,
  });
  if (error) return rpcErr(error, "getClientArchiveImpact");

  const row = data?.[0];
  return ok({
    operacoes: row?.operacoes ?? 0,
    frentes: row?.frentes ?? 0,
    alocacoes: row?.alocacoes ?? 0,
  });
}

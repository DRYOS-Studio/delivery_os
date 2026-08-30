export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err(error: string, code?: string): ActionResult<never> {
  return code === undefined ? { ok: false, error } : { ok: false, error, code };
}

export function dbErr(
  error: { message: string },
  context: string,
): ActionResult<never> {
  return { ok: false, error: `${context}: ${error.message}`, code: "db_error" };
}

/**
 * Traduz erro de RPC das funções de arquivamento/restore para `ActionResult`.
 *
 * Existe porque `dbErr` mandaria a string crua do Postgres para o toast. Cada código
 * é levantado deliberadamente pelas funções em
 * `supabase/migrations/*_archive_cascade_functions.sql`:
 *
 * - `42501` guard `is_admin()` interno (a RLS de UPDATE não é admin-only)
 * - `23514` status não-terminal — "encerre antes de arquivar"
 * - `P0003` pai arquivado (restore) — mensagem distinta de propósito: reusar `23514`
 *           faria uma falha de restore falar sobre arquivar
 * - `P0002` alvo inexistente ou já no estado pedido
 * - `P0004` tripwire de `ROW_COUNT` — concorrência/no-op
 * - `PGRST202` função ausente no schema cache: migration não aplicada neste ambiente
 * - `22P02` valor de enum inválido: idem (o `<select>` tem status que o banco não tem)
 *
 * O ramo default é obrigatório: sem ele, um erro não previsto vira toast vazio.
 */
export function rpcErr(
  error: { code?: string; message: string },
  context: string,
): ActionResult<never> {
  switch (error.code) {
    case "42501":
      return err("Só admin pode fazer isso.", "forbidden");
    case "23514":
      return err(
        "Encerre a Operação (Concluída ou Cancelada) antes de arquivar.",
        "state_conflict",
      );
    case "P0003":
      return err(
        "Restaure o registro pai antes: ele está arquivado.",
        "state_conflict",
      );
    case "P0002":
      return err("Registro não encontrado ou já neste estado.", "not_found");
    case "P0004":
      return err(
        "A operação não foi concluída. Recarregue e tente de novo.",
        "state_conflict",
      );
    case "PGRST202":
    case "22P02":
      return err(
        "Migration pendente neste ambiente — avise o time.",
        "schema_stale",
      );
    default:
      return err(`Falha inesperada em ${context}.`, "db_error");
  }
}

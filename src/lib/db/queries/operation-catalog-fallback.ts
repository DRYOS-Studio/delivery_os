/**
 * PR #223 passou a selecionar `operations.catalog_group`. Se a migration
 * 20261126130000 falhou (typo `plplpgsql` no trigger), a coluna pode não existir
 * ou o PostgREST ainda não ter recarregado o schema — o select falha em RSC.
 */

export function isMissingCatalogGroupColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("catalog_group") &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

/** Remove `catalog_group,` dos fragments de select PostgREST (legado pré-#223). */
export function selectWithoutCatalogGroup(select: string): string {
  return select.replace(/\bcatalog_group,\s*/g, "");
}

export async function withCatalogGroupSelectFallback<
  R extends { error: { message: string } | null },
>(selectWithCatalog: string, run: (select: string) => Promise<R>): Promise<R> {
  let result = await run(selectWithCatalog);
  if (
    result.error &&
    isMissingCatalogGroupColumnError(result.error.message)
  ) {
    result = await run(selectWithoutCatalogGroup(selectWithCatalog));
  }
  return result;
}
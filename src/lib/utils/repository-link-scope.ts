export type RepositoryLinkScope = "client" | "operation" | "frente";

export type RepositoryLinkLike = {
  operationId: string | null;
  frenteId: string | null;
};

export function repositoryLinkScope(row: RepositoryLinkLike): RepositoryLinkScope {
  if (row.frenteId) return "frente";
  if (row.operationId) return "operation";
  return "client";
}

export const REPOSITORY_SCOPE_LABEL: Record<RepositoryLinkScope, string> = {
  client: "Cliente",
  operation: "Operação",
  frente: "Frente",
};

export type GitRepositoryScope = "frente" | "operation" | "client";

export type ResolvedGitRepository = {
  url: string;
  scope: GitRepositoryScope;
};

export function resolveGitRepositoryUrl(levels: {
  frente?: string | null | undefined;
  operation?: string | null | undefined;
  client?: string | null | undefined;
}): ResolvedGitRepository | null {
  const frente = levels.frente?.trim();
  if (frente) return { url: frente, scope: "frente" };
  const operation = levels.operation?.trim();
  if (operation) return { url: operation, scope: "operation" };
  const client = levels.client?.trim();
  if (client) return { url: client, scope: "client" };
  return null;
}

export const GIT_REPOSITORY_SCOPE_LABEL: Record<GitRepositoryScope, string> = {
  frente: "Frente",
  operation: "Operação",
  client: "Cliente",
};

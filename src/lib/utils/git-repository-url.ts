import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export type GitRepositoryUrlProblem =
  | "invalid_url"
  | "scheme"
  | "credentials"
  | "fragment_credentials";

export const GIT_REPOSITORY_URL_PROBLEM_MESSAGE: Record<
  GitRepositoryUrlProblem,
  string
> = {
  invalid_url: "URL inválida.",
  scheme: "O repositório precisa ser https (link seguro para o navegador).",
  credentials:
    "Remova usuário e senha da URL. Use o link público do repositório.",
  fragment_credentials:
    "A URL não pode conter credenciais no fragmento.",
};

/**
 * Valida URL de repositório Git para uso como link em `<a href>` (não para fetch server-side).
 * Aceita qualquer host https público ou interno; rejeita http/ssh e credenciais embutidas.
 */
export function checkGitRepositoryUrl(raw: string): GitRepositoryUrlProblem | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "invalid_url";
  }

  if (url.protocol !== "https:") return "scheme";

  if (url.username !== "" || url.password !== "") return "credentials";

  // `https://github.com/org/repo#token=...` — credencial no hash
  const frag = url.hash.toLowerCase();
  if (
    frag.includes("token=") ||
    frag.includes("access_token") ||
    frag.includes("password")
  ) {
    return "fragment_credentials";
  }

  if (url.hostname.length === 0) return "invalid_url";

  return null;
}

export function isSafeGitRepositoryUrl(raw: string): boolean {
  return checkGitRepositoryUrl(raw) === null;
}

/** Rótulo curto para exibição (hostname + path, sem query). */
export function formatGitRepositoryLinkLabel(raw: string): string {
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/$/, "") || "/";
    return `${url.hostname}${path}`;
  } catch {
    return raw;
  }
}

export const optionalGitRepositoryUrlSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(500, "URL muito longa (máx 500 caracteres).")
    .superRefine((v, ctx) => {
      const problem = checkGitRepositoryUrl(v);
      if (problem) {
        ctx.addIssue({
          code: "custom",
          message: GIT_REPOSITORY_URL_PROBLEM_MESSAGE[problem],
        });
      }
    })
    .optional(),
);

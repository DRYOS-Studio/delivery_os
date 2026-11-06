import type { AuthError } from "@supabase/supabase-js";

/** Heurística para erro de e-mail já existente no Admin Auth API. */
export function isDuplicateUserError(error: AuthError | null): boolean {
  if (!error) return false;
  const m = `${error.message} ${error.code ?? ""}`.toLowerCase();
  return (
    m.includes("already") ||
    m.includes("registered") ||
    m.includes("exists") ||
    m.includes("duplicate") ||
    error.code === "user_already_exists"
  );
}

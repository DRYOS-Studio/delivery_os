/** Detecta coluna ausente / schema cache do PostgREST após deploy sem migration. */
export function isPostgrestMissingColumnError(error: {
  code?: string;
  message: string;
}): boolean {
  const code = error.code ?? "";
  if (code === "PGRST204" || code === "42703") return true;
  const msg = error.message.toLowerCase();
  if (msg.includes("schema cache") && msg.includes("could not find")) return true;
  if (msg.includes("column") && msg.includes("does not exist")) return true;
  return false;
}

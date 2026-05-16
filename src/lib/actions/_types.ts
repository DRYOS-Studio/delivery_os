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

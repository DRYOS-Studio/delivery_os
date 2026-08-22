/**
 * Base sentinela só pra resolver o caminho. O host é `.invalid` (RFC 2606),
 * que nunca resolve de verdade — se o input escapar da origem, o `origin`
 * deixa de bater e a gente descarta.
 */
const SENTINEL = "https://redirect-guard.invalid";

/** Caracteres que o parser de URL do WHATWG remove antes de interpretar. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Normaliza um destino de redirect vindo do usuário (query string, campo de
 * form) para um caminho garantidamente da mesma origem. Qualquer coisa que
 * escape vira `fallback`.
 *
 * Checar `startsWith("/")` não basta, e checar `//` também não:
 * - `//evil.com` e `/\evil.com` viram `https://evil.com/` — o WHATWG trata
 *   `\` como `/`;
 * - `/<TAB>/evil.com`, `/<LF>/evil.com` e `/<CR>/evil.com` furam qualquer
 *   teste de prefixo, porque `new URL` remove esses caracteres ANTES de
 *   parsear — o que sobra é `//evil.com`.
 *
 * Por isso a validação delega ao mesmo parser que vai consumir o valor, em
 * vez de tentar adivinhar por string quais formas são perigosas.
 */
export function safeRedirectPath(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;

  const stripped = raw.replace(CONTROL_CHARS, "");
  if (!stripped.startsWith("/")) return fallback;

  try {
    const url = new URL(stripped, SENTINEL);
    if (url.origin !== SENTINEL) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Guarda de destino do webhook de notificação.
 *
 * O destino é deliberadamente arbitrário — a URL é por Operação e aponta pro
 * n8n **do cliente**, então não existe allowlist de host possível. O que dá
 * pra fazer é fechar as classes de destino que nunca são um webhook legítimo:
 * esquema não-https, porta não-443, e host que resolve pra rede interna.
 *
 * Limite conhecido e NÃO coberto: DNS rebinding. Um host público que troca de
 * IP entre a validação e o connect passa por aqui. Fechar isso exige validar
 * o endereço no momento do connect (dispatcher undici custom ou `node:https`
 * com `servername` fixado) — ver issue de follow-up.
 */

export type WebhookUrlProblem =
  | "invalid_url"
  | "scheme"
  | "port"
  | "private_host"
  | "opaque_host";

export const WEBHOOK_URL_PROBLEM_MESSAGE: Record<WebhookUrlProblem, string> = {
  invalid_url: "URL inválida.",
  scheme: "O webhook precisa ser https.",
  port: "O webhook precisa usar a porta padrão (443).",
  private_host: "Endereço interno não é destino válido de webhook.",
  opaque_host: "Informe um domínio completo (com ponto).",
};

/** Sufixos de nome que só resolvem em rede interna. */
const INTERNAL_SUFFIXES = [
  ".localhost",
  ".internal",
  ".local",
  ".home.arpa",
];

/** Prefixos IPv6 reservados/internos, já em forma comprimida do `URL`. */
function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  // fc00::/7 (ULA) — primeiro byte 0xfc ou 0xfd
  if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true;
  // fe80::/10 (link-local)
  if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;
  return false;
}

/**
 * `::ffff:7f00:1` → `127.0.0.1`. O `URL` comprime IPv4-mapeado pra hex, então
 * sem desembrulhar, `https://[::ffff:127.0.0.1]` passaria batido.
 */
function unwrapIpv4Mapped(host: string): string | null {
  const m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (!m || m[1] === undefined || m[2] === undefined) return null;
  const hi = Number.parseInt(m[1], 16);
  const lo = Number.parseInt(m[2], 16);
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const o = parts.map((p) => Number(p));
  if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const a = o[0] ?? -1;
  const b = o[1] ?? -1;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // privada
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (metadata de cloud)
  if (a === 172 && b >= 16 && b <= 31) return true; // privada
  if (a === 192 && b === 168) return true; // privada
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark 198.18/15
  if (a >= 224) return true; // multicast 224/4 + reservado 240/4
  return false;
}

const IPV4_SHAPE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Devolve `null` quando a URL é destino aceitável, ou o problema encontrado.
 */
export function checkWebhookUrl(raw: string): WebhookUrlProblem | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "invalid_url";
  }

  if (url.protocol !== "https:") return "scheme";
  if (url.port !== "" && url.port !== "443") return "port";

  // IPv6 chega entre colchetes em `hostname`.
  const bare = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (bare.length === 0) return "invalid_url";

  const mapped = unwrapIpv4Mapped(bare);
  if (mapped) return isPrivateIpv4(mapped) ? "private_host" : null;

  if (bare.includes(":")) return isPrivateIpv6(bare) ? "private_host" : null;

  if (IPV4_SHAPE.test(bare)) return isPrivateIpv4(bare) ? "private_host" : null;

  if (bare === "localhost") return "private_host";
  if (INTERNAL_SUFFIXES.some((s) => bare.endsWith(s))) return "private_host";

  // Host de um único label (`intranet`, `n8n`) resolve por search domain da
  // rede — nunca é um webhook público legítimo.
  if (!bare.includes(".")) return "opaque_host";

  return null;
}

export function isSafeWebhookUrl(raw: string): boolean {
  return checkWebhookUrl(raw) === null;
}

import type { NextConfig } from "next";

/**
 * Origem do Supabase, pra liberar em `connect-src`. O browser fala direto com
 * o Supabase (`createBrowserClient` em src/lib/db/client.ts + onAuthStateChange),
 * então sem isso a sessão quebra no browser.
 *
 * Ausente = avisa alto e omite a origem, em vez de derrubar o build. Omitir
 * aperta a CSP (falha restritiva e visível: auth para no browser), enquanto
 * exigir a env pra buildar tornaria `npm run build` impossível sem `.env.local`
 * — e o build é a única rede deste repo (não há teste nem linter, e `tsc` não
 * pega violação de fronteira client/server). Na Vercel a env existe, então
 * preview e produção montam a CSP completa.
 */
function supabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) {
    console.warn(
      "[csp] NEXT_PUBLIC_SUPABASE_URL ausente — connect-src sai sem a origem do Supabase. " +
        "Build local segue; num deploy real isso quebraria a sessão no browser.",
    );
    return null;
  }
  return new URL(raw).origin;
}

/**
 * `'unsafe-inline'` em script-src e style-src é deliberado, não descuido:
 * o Next injeta 2-3 <script> inline de bootstrap/flight por página, e o Recharts
 * escreve `style=` em elementos SVG (17 ocorrências medidas no /public).
 * Trocar por nonce exige plumbing no src/proxy.ts e é o próximo passo, não este.
 * O que a CSP já entrega aqui: nenhuma origem externa consegue servir script,
 * e connect-src limita exfiltração a self + Supabase.
 */
function csp(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ["connect-src 'self'", supabaseOrigin()].filter(Boolean).join(" "),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function baseHeaders(referrerPolicy: string) {
  return [
    { key: "Content-Security-Policy", value: csp() },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: referrerPolicy },
  ];
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      // /public/[token] carrega o token na URL. `no-referrer` impede que ele
      // vaze no header Referer quando o cliente clica num link de saída.
      {
        source: "/public/:path*",
        headers: baseHeaders("no-referrer"),
      },
      // Todo o resto. Source mutuamente exclusivo do de cima de propósito:
      // duas regras casando a mesma rota emitiriam dois Referrer-Policy.
      {
        source: "/((?!public/).*)",
        headers: baseHeaders("strict-origin-when-cross-origin"),
      },
    ];
  },
};

export default nextConfig;

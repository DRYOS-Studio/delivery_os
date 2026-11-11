"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createMcpAgentTokenAction,
  revokeMcpAgentTokenAction,
} from "@/lib/actions/mcp-agent-tokens";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { McpAgentTokenAdminRow } from "@/lib/db/queries/mcp-agent-tokens";
import { mcpTokenStatus } from "@/lib/db/queries/mcp-agent-tokens";
import {
  buildClaudeMcpAddCommand,
  buildMcpRemoteClaudeDesktopConfig,
} from "@/lib/mcp/mcp-connect-snippets";
import type { ProfileListItem } from "@/lib/db/queries/profiles";
import { formatDateTimeBR } from "@/lib/utils/date";

type Props = {
  appUrl: string;
  profiles: ProfileListItem[];
  initialTokens: McpAgentTokenAdminRow[];
};

function statusVariant(
  status: ReturnType<typeof mcpTokenStatus>,
): "sage" | "neutral" | "critical" {
  if (status === "active") return "sage";
  if (status === "expired") return "neutral";
  return "critical";
}

function statusLabel(status: ReturnType<typeof mcpTokenStatus>): string {
  if (status === "active") return "Ativo";
  if (status === "expired") return "Expirado";
  return "Revogado";
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AdminMcpTokensSection({
  appUrl,
  profiles,
  initialTokens,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [tokens, setTokens] = useState(initialTokens);
  const [busy, setBusy] = useState(false);
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [name, setName] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [days, setDays] = useState(365);
  const [scopeRead, setScopeRead] = useState(true);
  const [scopeWrite, setScopeWrite] = useState(true);
  const [shownOnce, setShownOnce] = useState<string | null>(null);

  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);

  const snippetToken = shownOnce ?? "<SEU_TOKEN_mcp_agt_…>";
  const desktopJson = useMemo(
    () => buildMcpRemoteClaudeDesktopConfig(appUrl, snippetToken),
    [appUrl, snippetToken],
  );
  const claudeCli = useMemo(
    () => buildClaudeMcpAddCommand(appUrl, snippetToken),
    [appUrl, snippetToken],
  );

  async function createToken() {
    if (!profileId) {
      window.alert("Selecione o usuário dono do token.");
      return;
    }
    if (!scopeRead && !scopeWrite) {
      window.alert("Marque ao menos read ou write.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("profile_id", profileId);
    fd.set("name", name.trim() || "Claude Desktop");
    if (noExpiry) fd.set("no_expiry", "1");
    else fd.set("expires_in_days", String(days));
    if (scopeRead) fd.append("scopes", "read");
    if (scopeWrite) fd.append("scopes", "write");
    const res = await createMcpAgentTokenAction(fd);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    setShownOnce(res.data.token);
    setName("");
    router.refresh();
  }

  async function revoke(id: string) {
    if (!window.confirm("Revogar este token? Clientes MCP deixam de funcionar.")) return;
    setBusy(true);
    const res = await revokeMcpAgentTokenAction(id);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    setTokens((t) =>
      t.map((x) =>
        x.id === id ? { ...x, revokedAt: new Date().toISOString() } : x,
      ),
    );
    router.refresh();
  }

  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-display text-lg text-ink font-semibold">
          Tokens de MCP
        </h2>
        <Pill variant="neutral">{tokens.length}</Pill>
      </div>
      <Card className="p-4 space-y-4">
        <p className="text-sm text-mute">
          Tokens <span className="font-mono">mcp_agt_…</span> para Claude Desktop, Claude
          Code e outros clientes HTTP. O servidor troca por JWT Supabase;{" "}
          <strong className="font-medium text-ink-soft">RLS do usuário vinculado</strong>.
        </p>

        {shownOnce && (
          <div className="rounded border border-warning bg-warning-bg p-3 space-y-2 text-sm">
            <p className="font-medium text-ink">
              Copie o token agora — não será exibido de novo.
            </p>
            <code className="block font-mono text-xs break-all bg-card border border-line rounded p-2">
              {shownOnce}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="sage"
                onClick={() => void copyText(shownOnce).then((ok) => ok && window.alert("Token copiado."))}
              >
                Copiar token
              </Button>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-oak font-medium">
                Claude Desktop (mcp-remote)
              </summary>
              <pre className="mt-2 p-2 bg-surface border border-line rounded overflow-x-auto font-mono text-[10px]">
                {desktopJson}
              </pre>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-1"
                onClick={() => void copyText(desktopJson)}
              >
                Copiar JSON
              </Button>
            </details>
            <details className="text-xs">
              <summary className="cursor-pointer text-oak font-medium">
                Claude Code CLI
              </summary>
              <pre className="mt-2 p-2 bg-surface border border-line rounded overflow-x-auto font-mono text-[10px] whitespace-pre-wrap">
                {claudeCli}
              </pre>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-1"
                onClick={() => void copyText(claudeCli)}
              >
                Copiar comando
              </Button>
            </details>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-end border-t border-line pt-3">
          <label className="text-xs block">
            Usuário (RLS)
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              disabled={busy}
              className="block mt-1 min-w-[14rem] rounded border border-line px-2 py-1.5 text-sm"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayLabel ?? p.email ?? p.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs block">
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude do Rafael"
              disabled={busy}
              className="block mt-1 w-48 rounded border border-line px-2 py-1.5 text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-1 text-xs self-center">
            <input
              type="checkbox"
              checked={noExpiry}
              onChange={(e) => setNoExpiry(e.target.checked)}
              disabled={busy}
            />
            Sem validade
          </label>
          {!noExpiry && (
            <label className="text-xs block">
              Dias
              <input
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                disabled={busy}
                className="block mt-1 w-20 rounded border border-line px-2 py-1.5 text-sm"
              />
            </label>
          )}
          <label className="inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={scopeRead}
              onChange={(e) => setScopeRead(e.target.checked)}
              disabled={busy}
            />
            read
          </label>
          <label className="inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={scopeWrite}
              onChange={(e) => setScopeWrite(e.target.checked)}
              disabled={busy}
            />
            write
          </label>
          <Button type="button" size="sm" disabled={busy} onClick={() => void createToken()}>
            Criar token
          </Button>
        </div>

        {tokens.length === 0 ? (
          <p className="text-sm text-mute">Nenhum token cadastrado.</p>
        ) : (
          <div className="overflow-x-auto border border-line rounded">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line bg-surface text-mute text-left">
                  <th className="px-2 py-2">Nome</th>
                  <th className="px-2 py-2">Usuário</th>
                  <th className="px-2 py-2">Prefixo</th>
                  <th className="px-2 py-2">Escopos</th>
                  <th className="px-2 py-2">Criado</th>
                  <th className="px-2 py-2">Último uso</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => {
                  const status = mcpTokenStatus(t);
                  return (
                    <tr key={t.id} className="border-b border-line last:border-0">
                      <td className="px-2 py-2 font-medium">{t.name}</td>
                      <td className="px-2 py-2 text-mute">
                        {t.profileLabel ?? t.profileEmail ?? t.profileId.slice(0, 8)}
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px]">
                        {t.tokenPrefix ?? `${t.tokenFingerprint.slice(0, 8)}…`}
                      </td>
                      <td className="px-2 py-2">{t.scopes.join(", ")}</td>
                      <td className="px-2 py-2">{formatDateTimeBR(t.createdAt)}</td>
                      <td className="px-2 py-2">
                        {t.lastUsedAt ? formatDateTimeBR(t.lastUsedAt) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <Pill variant={statusVariant(status)}>{statusLabel(status)}</Pill>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {status === "active" && (
                          <button
                            type="button"
                            className="text-critical font-mono"
                            disabled={busy}
                            onClick={() => void revoke(t.id)}
                          >
                            Revogar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

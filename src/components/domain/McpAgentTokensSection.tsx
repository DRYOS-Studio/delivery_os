"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createMcpAgentTokenAction,
  revokeMcpAgentTokenAction,
} from "@/lib/actions/mcp-agent-tokens";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { McpAgentTokenRow } from "@/lib/db/queries/mcp-agent-tokens";
import { formatDateTimeBR } from "@/lib/utils/date";

type Props = {
  profileId: string;
  profileEmail: string | null;
  initialTokens: McpAgentTokenRow[];
};

export function McpAgentTokensSection({
  profileId,
  profileEmail,
  initialTokens,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [tokens, setTokens] = useState(initialTokens);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState(90);
  const [scopeRead, setScopeRead] = useState(true);
  const [scopeWrite, setScopeWrite] = useState(true);
  const [shownOnce, setShownOnce] = useState<string | null>(null);

  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);

  async function createToken() {
    if (!scopeRead && !scopeWrite) {
      window.alert("Marque ao menos read ou write.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("profile_id", profileId);
    fd.set("name", name.trim() || "Cursor / agente");
    fd.set("expires_in_days", String(days));
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
    if (!window.confirm("Revogar este token? Conectores que usam deixam de funcionar.")) return;
    setBusy(true);
    const res = await revokeMcpAgentTokenAction(id);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    setTokens((t) =>
      t.map((x) => (x.id === id ? { ...x, revokedAt: new Date().toISOString() } : x)),
    );
    router.refresh();
  }

  const active = tokens.filter((t) => !t.revokedAt);

  return (
    <Card className="mt-3 p-3 border-line border-dashed">
      <h4 className="text-xs font-mono text-mute-soft mb-2">Tokens MCP (agente)</h4>
      <p className="text-[10px] text-mute mb-2">
        Authorization estático no Cursor (Bearer). Prefixo <code>mcp_agt_</code>. O servidor troca
        por JWT curto; o papel é o de {profileEmail ?? "este usuário"} (RLS).
      </p>
      {shownOnce && (
        <div className="mb-3 p-2 rounded bg-warning-bg border border-warning text-xs font-mono break-all">
          Copie agora (não será mostrado de novo):
          <br />
          {shownOnce}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-end mb-3">
        <label className="text-[10px]">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-40 mt-0.5 rounded border border-line px-2 py-1 text-xs"
            placeholder="Jon laptop"
            disabled={busy}
          />
        </label>
        <label className="text-[10px]">
          Dias válidos
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="block w-16 mt-0.5 rounded border border-line px-2 py-1 text-xs"
            disabled={busy}
          />
        </label>
        <label className="inline-flex items-center gap-1 text-[10px]">
          <input
            type="checkbox"
            checked={scopeRead}
            onChange={(e) => setScopeRead(e.target.checked)}
            disabled={busy}
          />
          read
        </label>
        <label className="inline-flex items-center gap-1 text-[10px]">
          <input
            type="checkbox"
            checked={scopeWrite}
            onChange={(e) => setScopeWrite(e.target.checked)}
            disabled={busy}
          />
          write
        </label>
        <Button type="button" size="sm" disabled={busy} onClick={() => void createToken()}>
          Gerar token
        </Button>
      </div>
      {active.length === 0 ? (
        <p className="text-[10px] text-mute">Nenhum token ativo.</p>
      ) : (
        <ul className="space-y-1 text-[10px]">
          {active.map((t) => (
            <li key={t.id} className="flex flex-wrap justify-between gap-2 border-t border-line pt-1">
              <span>
                {t.name} · {t.scopes.join(",")} · exp {formatDateTimeBR(t.expiresAt)}
                {t.lastUsedAt ? ` · uso ${formatDateTimeBR(t.lastUsedAt)}` : ""}
              </span>
              <button
                type="button"
                className="text-critical font-mono"
                disabled={busy}
                onClick={() => void revoke(t.id)}
              >
                Revogar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

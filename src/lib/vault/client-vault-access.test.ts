import { describe, expect, it } from "vitest";
import { interpretClientVaultRpc } from "@/lib/vault/client-vault-access";

describe("interpretClientVaultRpc", () => {
  it("distingue erro de rpc de acesso negado", () => {
    const denied = interpretClientVaultRpc(false, null);
    expect(denied).toEqual({ kind: "forbidden" });

    const allowed = interpretClientVaultRpc(true, null);
    expect(allowed).toEqual({ kind: "allowed" });

    const stale = interpretClientVaultRpc(null, {
      code: "PGRST202",
      message: "Could not find the function",
    });
    expect(stale.kind).toBe("rpc_error");
    expect(stale).toMatchObject({ code: "PGRST202" });
    if (stale.kind === "rpc_error") {
      expect(stale.message).toContain("PostgREST");
    }
  });
});

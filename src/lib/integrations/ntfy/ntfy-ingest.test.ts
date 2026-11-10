import { describe, expect, it } from "vitest";
import {
  extractNtfyIngestToken,
  verifyNtfyIngestToken,
} from "@/lib/integrations/ntfy/auth";
import {
  isRecoveryMessage,
  ntfyTimeToIso,
} from "@/lib/integrations/ntfy/ingest-core";
import { mapNtfyPriorityToSeverity } from "@/lib/integrations/ntfy/severity-map";
import { slaBreachLevel } from "@/lib/utils/sla";

describe("ntfy auth", () => {
  it("rejeita token inválido", () => {
    const prev = process.env.NTFY_INGEST_SECRET;
    process.env.NTFY_INGEST_SECRET = "test-secret-value";
    try {
      expect(verifyNtfyIngestToken("wrong")).toBe(false);
      expect(verifyNtfyIngestToken("test-secret-value")).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.NTFY_INGEST_SECRET;
      else process.env.NTFY_INGEST_SECRET = prev;
    }
  });

  it("extrai Bearer do request", () => {
    const req = new Request("http://localhost", {
      headers: { authorization: "Bearer abc123" },
    });
    expect(extractNtfyIngestToken(req)).toBe("abc123");
  });
});

describe("ntfy ingest-core", () => {
  it("detecta recovery por tag", () => {
    expect(isRecoveryMessage(["Resolved"], ["resolved"])).toBe(true);
    expect(isRecoveryMessage(["alert"], ["resolved"])).toBe(false);
  });

  it("converte epoch segundos para ISO", () => {
    expect(ntfyTimeToIso(1_700_000_000)).toMatch(/2023-/);
  });
});

describe("ntfy severity map", () => {
  it("mapeia priority 5 para high", () => {
    expect(mapNtfyPriorityToSeverity(5, undefined)).toBe("high");
  });

  it("respeita mapa customizado", () => {
    expect(
      mapNtfyPriorityToSeverity(3, { "3": "high" }),
    ).toBe("high");
  });
});

describe("sla vendor origin", () => {
  it("não calcula breach para fornecedor", () => {
    const level = slaBreachLevel(
      {
        status: "open",
        opened_at: new Date(Date.now() - 9_600_000).toISOString(),
        responded_at: null,
        resolved_at: null,
        problem_origin: "vendor",
      },
      { response_hours: 1, resolution_hours: null },
    );
    expect(level).toBe("ok");
  });
});

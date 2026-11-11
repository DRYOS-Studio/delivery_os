import { describe, expect, it } from "vitest";
import { normalizeEmbedOne } from "@/lib/db/normalize-embed";

/**
 * meetings/new chama getOperation → listAttendeeCandidates(op.client.id).
 * Sem normalizar embed, client como array não tem .id → UUID inválido na query.
 */
describe("getOperation client embed (regressão meetings/new)", () => {
  it("array com cliente resolve id para listAttendeeCandidates", () => {
    const embed = normalizeEmbedOne([
      {
        id: "5d7942fe-577c-45f4-853f-822c49cbdba6",
        name: "Cliente",
        slug: "cliente",
        archived_at: null,
      },
    ]);
    expect(embed?.id).toBe("5d7942fe-577c-45f4-853f-822c49cbdba6");
  });

  it("embed ausente equivale a operação invisível (redirect)", () => {
    expect(normalizeEmbedOne(null)).toBeNull();
    expect(normalizeEmbedOne([])).toBeNull();
  });
});

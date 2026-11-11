import { describe, expect, it } from "vitest";
import { normalizeEmbedOne } from "@/lib/db/normalize-embed";

describe("normalizeEmbedOne", () => {
  it("aceita objeto único", () => {
    expect(normalizeEmbedOne({ id: "c1", name: "Acme" })).toEqual({
      id: "c1",
      name: "Acme",
    });
  });

  it("extrai primeiro elemento quando embed vem como array", () => {
    expect(
      normalizeEmbedOne([
        { id: "c1", name: "Acme" },
        { id: "c2", name: "Other" },
      ]),
    ).toEqual({ id: "c1", name: "Acme" });
  });

  it("retorna null para ausente ou array vazio", () => {
    expect(normalizeEmbedOne(null)).toBeNull();
    expect(normalizeEmbedOne(undefined)).toBeNull();
    expect(normalizeEmbedOne([])).toBeNull();
  });
});

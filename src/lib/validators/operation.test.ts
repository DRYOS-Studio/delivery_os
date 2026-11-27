import { describe, expect, it } from "vitest";
import { CATALOG_OFFER_GROUPS } from "@/lib/catalog/catalog-offer";
import { operationSchema } from "@/lib/validators/operation";

const base = {
  client_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Cliente — DRYOS OS",
  status: "em_construcao" as const,
};

describe("operationSchema — catalog_group", () => {
  it("aceita todos os grupos comerciais oficiais", () => {
    for (const catalog_group of CATALOG_OFFER_GROUPS) {
      const parsed = operationSchema.safeParse({ ...base, catalog_group });
      expect(parsed.success, catalog_group).toBe(true);
    }
  });

  it("rejeita grupo fora do catálogo", () => {
    const parsed = operationSchema.safeParse({
      ...base,
      catalog_group: "core",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita legado product_line", () => {
    const parsed = operationSchema.safeParse({
      ...base,
      product_line: "core",
    });
    expect(parsed.success).toBe(false);
  });
});
import { describe, expect, it } from "vitest";
import { serviceProductSchema } from "@/lib/validators/service-product";
import { SERVICE_PRODUCT_DESCRIPTION_MAX } from "@/lib/validators/service-product-limits";

describe("serviceProductSchema", () => {
  const base = { name: "Teste", slug: "teste" } as const;

  it("aceita description até o limite canônico", () => {
    const description = "a".repeat(SERVICE_PRODUCT_DESCRIPTION_MAX);
    const parsed = serviceProductSchema.safeParse({ ...base, description });
    expect(parsed.success).toBe(true);
  });

  it("rejeita description acima do limite", () => {
    const description = "a".repeat(SERVICE_PRODUCT_DESCRIPTION_MAX + 1);
    const parsed = serviceProductSchema.safeParse({ ...base, description });
    expect(parsed.success).toBe(false);
  });
});
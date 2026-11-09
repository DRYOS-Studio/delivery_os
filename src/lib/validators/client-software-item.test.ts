import { describe, expect, it } from "vitest";
import { clientSoftwareItemSchema } from "@/lib/validators/client-software-item";

describe("clientSoftwareItemSchema", () => {
  it("accepts name-only (free text, no enum)", () => {
    const parsed = clientSoftwareItemSchema.safeParse({ name: "RD Station" });
    expect(parsed.success).toBe(true);
  });

  it("accepts workspace url when https", () => {
    const parsed = clientSoftwareItemSchema.safeParse({
      name: "Ferramenta X",
      purpose: "CRM",
      url: "https://app.cliente.exemplo/login",
    });
    expect(parsed.success).toBe(true);
  });
});

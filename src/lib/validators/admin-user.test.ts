import { describe, expect, it } from "vitest";
import { inviteUserFormSchema } from "@/lib/validators/admin-user";

describe("inviteUserFormSchema", () => {
  const memberPayload = {
    email: "a@b.co",
    name: "Test",
    role: "member" as const,
    operation_ids: ["00000000-0000-4000-8000-000000000001"],
  };

  it("parses the same payload twice (idempotent shape)", () => {
    const a = inviteUserFormSchema.safeParse(memberPayload);
    const b = inviteUserFormSchema.safeParse(memberPayload);
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(a.data).toEqual(b.data);
    }
  });

  it("rejects member with zero operations", () => {
    const r = inviteUserFormSchema.safeParse({
      ...memberPayload,
      operation_ids: [],
    });
    expect(r.success).toBe(false);
  });

  it("allows admin with no operations", () => {
    const r = inviteUserFormSchema.safeParse({
      email: "admin@x.co",
      name: "Ad",
      role: "admin" as const,
      operation_ids: [],
    });
    expect(r.success).toBe(true);
  });
});

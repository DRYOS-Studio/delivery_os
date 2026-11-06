import { describe, expect, it } from "vitest";
import { assertNotSelfDemote } from "@/lib/auth/self-demote-guard";

describe("assertNotSelfDemote", () => {
  const uid = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";

  it("blocks admin from demoting themselves to member", () => {
    const r = assertNotSelfDemote(uid, uid, "member");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("self_demote_blocked");
  });

  it("allows another admin to demote a user", () => {
    const r = assertNotSelfDemote(uid, other, "member");
    expect(r.ok).toBe(true);
  });

  it("allows self when staying admin", () => {
    const r = assertNotSelfDemote(uid, uid, "admin");
    expect(r.ok).toBe(true);
  });
});

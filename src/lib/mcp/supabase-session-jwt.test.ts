import { jwtVerify } from "jose";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mintSupabaseUserAccessToken } from "@/lib/mcp/supabase-session-jwt";

describe("mintSupabaseUserAccessToken", () => {
  const prev = process.env.SUPABASE_JWT_SECRET;
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = "test-secret-at-least-32-chars-long!!";
  });
  afterEach(() => {
    process.env.SUPABASE_JWT_SECRET = prev;
  });

  it("produces HS256 JWT for authenticated audience", async () => {
    const sub = "00000000-0000-4000-8000-000000000001";
    const jwt = await mintSupabaseUserAccessToken(sub, 120);
    const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(jwt, secret, { audience: "authenticated" });
    expect(payload.sub).toBe(sub);
    expect(payload.role).toBe("authenticated");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAdmin = {
  getUserById: vi.fn(),
  generateLink: vi.fn(),
};
const mockVerifyOtp = vi.fn();

vi.mock("@/lib/db/service-role", () => ({
  createServiceRole: () => ({
    auth: { admin: mockAdmin },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { verifyOtp: mockVerifyOtp },
  }),
}));

import {
  exchangeProfileForGoTrueAccessToken,
  GoTrueExchangeError,
} from "@/lib/mcp/exchange-gotrue-session";

describe("exchangeProfileForGoTrueAccessToken", () => {
  const profileId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mockAdmin.getUserById.mockReset();
    mockAdmin.generateLink.mockReset();
    mockVerifyOtp.mockReset();
  });

  it("returns access_token from verifyOtp after generateLink", async () => {
    mockAdmin.getUserById.mockResolvedValue({
      data: { user: { id: profileId, email: "agent@test.local" } },
      error: null,
    });
    mockAdmin.generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hash-abc" } },
      error: null,
    });
    mockVerifyOtp.mockResolvedValue({
      data: { session: { access_token: "real-es256-jwt" } },
      error: null,
    });

    await expect(exchangeProfileForGoTrueAccessToken(profileId)).resolves.toBe(
      "real-es256-jwt",
    );
    expect(mockAdmin.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "agent@test.local",
    });
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "email",
      token_hash: "hash-abc",
    });
  });

  it("throws no_email when user has no email", async () => {
    mockAdmin.getUserById.mockResolvedValue({
      data: { user: { id: profileId, email: null } },
      error: null,
    });
    await expect(exchangeProfileForGoTrueAccessToken(profileId)).rejects.toBeInstanceOf(
      GoTrueExchangeError,
    );
  });
});

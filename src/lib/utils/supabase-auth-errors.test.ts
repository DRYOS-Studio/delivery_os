import { describe, expect, it } from "vitest";
import { isDuplicateUserError } from "@/lib/utils/supabase-auth-errors";

describe("isDuplicateUserError", () => {
  it("returns false for null", () => {
    expect(isDuplicateUserError(null)).toBe(false);
  });

  it("detects user_already_exists code", () => {
    expect(
      isDuplicateUserError({
        message: "x",
        code: "user_already_exists",
      } as import("@supabase/supabase-js").AuthError),
    ).toBe(true);
  });

  it("detects message heuristics", () => {
    expect(
      isDuplicateUserError({
        message: "Email already registered",
        code: undefined,
      } as import("@supabase/supabase-js").AuthError),
    ).toBe(true);
  });
});

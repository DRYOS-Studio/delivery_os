import { createClient } from "@supabase/supabase-js";
import { createServiceRole } from "@/lib/db/service-role";
import type { Database } from "@/lib/db/types";

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export type GoTrueExchangeErrorCode =
  | "profile_not_found"
  | "no_email"
  | "generate_link_failed"
  | "verify_otp_failed";

export class GoTrueExchangeError extends Error {
  readonly code: GoTrueExchangeErrorCode;

  constructor(code: GoTrueExchangeErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/**
 * Emite access token real via GoTrue (assinatura do projeto — ex. ES256).
 * Documentação: Auth Admin API + verify OTP; não envia e-mail ao usar hashed_token/email_otp server-side.
 * @see https://supabase.com/docs/reference/javascript/auth-admin-generatelink
 * @see https://supabase.com/docs/guides/auth/signing-keys
 */
export async function exchangeProfileForGoTrueAccessToken(profileId: string): Promise<string> {
  const service = createServiceRole();

  const { data: userRes, error: userErr } = await service.auth.admin.getUserById(profileId);
  if (userErr || !userRes?.user) {
    throw new GoTrueExchangeError("profile_not_found", userErr?.message);
  }

  const email = userRes.user.email?.trim();
  if (!email) {
    throw new GoTrueExchangeError("no_email");
  }

  const { data: link, error: linkErr } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    throw new GoTrueExchangeError("generate_link_failed", linkErr?.message);
  }

  const publishable = createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: verified, error: verifyErr } = await publishable.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });

  const accessToken = verified.session?.access_token;
  if (verifyErr || !accessToken) {
    throw new GoTrueExchangeError("verify_otp_failed", verifyErr?.message);
  }

  return accessToken;
}

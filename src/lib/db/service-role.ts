import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

/**
 * Cliente Supabase com **service role** (bypass RLS). Use só em Server Actions
 * já guardadas por admin — nunca importar em Client Components.
 *
 * Aceita `SUPABASE_SERVICE_ROLE_KEY` (preferido) ou legado `SUPABASE_SECRET_KEY`.
 */
export function createServiceRole(): SupabaseClient<Database> {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (or legacy SUPABASE_SECRET_KEY)",
    );
  }
  return createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    secret,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

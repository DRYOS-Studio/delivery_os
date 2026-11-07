import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export type McpToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string; notFound?: boolean; forbidden?: boolean };

export type McpHandlerContext = {
  supabase: SupabaseClient<Database>;
  callerUserId: string;
};

export function clampLimit(raw: unknown, fallback = 20, max = 50): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(raw)));
}

export function clampOffset(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(10_000, Math.max(0, Math.floor(raw)));
}

export async function mcpCallerIsAdmin(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) return false;
  return data.role === "admin";
}

export type McpAdminDenied = {
  ok: false;
  message: string;
  forbidden: true;
};

export async function mcpRequireAdmin(
  ctx: McpHandlerContext,
): Promise<McpAdminDenied | null> {
  const ok = await mcpCallerIsAdmin(ctx.supabase, ctx.callerUserId);
  if (!ok) {
    return {
      ok: false,
      message: "Ação restrita a administradores.",
      forbidden: true,
    };
  }
  return null;
}

export function idempotencyKeyFromArgs(args: Record<string, unknown>): string | undefined {
  const ik = args.idempotency_key;
  return typeof ik === "string" && ik.trim().length >= 8 ? ik.trim() : undefined;
}

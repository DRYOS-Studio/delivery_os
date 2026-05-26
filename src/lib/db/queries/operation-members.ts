import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

type Role = Database["public"]["Enums"]["user_role"];

export type OperationMemberRow = {
  profileId: string;
  name: string | null;
  role: Role;
  createdAt: string;
};

export type AssignableProfile = {
  id: string;
  name: string | null;
};

export async function listOperationMembers(
  operationId: string,
): Promise<OperationMemberRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_members")
    .select(
      `
      profile_id,
      created_at,
      profile:profiles!fk_operation_members_profile(id, name, role)
    `,
    )
    .eq("operation_id", operationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    profileId: row.profile_id,
    name: row.profile?.name ?? null,
    role: row.profile?.role ?? "member",
    createdAt: row.created_at,
  }));
}

export async function listAssignableProfiles(
  operationId: string,
): Promise<AssignableProfile[]> {
  const supabase = await createServer();
  const [allRes, existingRes] = await Promise.all([
    supabase.from("profiles").select("id, name").eq("role", "member"),
    supabase
      .from("operation_members")
      .select("profile_id")
      .eq("operation_id", operationId),
  ]);

  if (allRes.error) throw allRes.error;
  if (existingRes.error) throw existingRes.error;

  const existing = new Set((existingRes.data ?? []).map((r) => r.profile_id));
  return (allRes.data ?? [])
    .filter((p) => !existing.has(p.id))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

export async function countOperationMembers(
  operationId: string,
): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("operation_members")
    .select("profile_id", { count: "exact", head: true })
    .eq("operation_id", operationId);
  if (error) throw error;
  return count ?? 0;
}

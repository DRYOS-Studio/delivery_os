import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { createServer } from "@/lib/db/client";

export type Role = "admin" | "member";

export type ProfileLite = {
  user: User;
  role: Role;
  personId: string | null;
};

export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}

export async function getUser(): Promise<User | null> {
  const supabase = await createServer();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getProfile(): Promise<ProfileLite | null> {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role, person_id")
    .eq("id", user.id)
    .maybeSingle();
  return {
    user,
    role: (data?.role as Role) ?? "member",
    personId: data?.person_id ?? null,
  };
}

export async function requireUser(redirectToOnFail?: string): Promise<User> {
  const user = await getUser();
  if (user) return user;
  const target = redirectToOnFail ?? "/";
  redirect(`/login?redirectTo=${encodeURIComponent(target)}`);
}

export async function requireProfile(
  redirectToOnFail?: string,
): Promise<ProfileLite> {
  const profile = await getProfile();
  if (profile) return profile;
  const target = redirectToOnFail ?? "/";
  redirect(`/login?redirectTo=${encodeURIComponent(target)}`);
}

export async function requireAdmin(
  redirectOnFail: string = "/",
): Promise<ProfileLite> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect(redirectOnFail);
  return profile;
}

export async function requireUserAction(): Promise<ActionResult<User>> {
  const user = await getUser();
  if (!user) return err("Sessão expirada.", "unauthenticated");
  return ok(user);
}

export async function requireAdminAction(): Promise<ActionResult<ProfileLite>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const supabase = await createServer();
  const { data } = await supabase
    .from("profiles")
    .select("role, person_id")
    .eq("id", userResult.data.id)
    .maybeSingle();
  if (data?.role !== "admin") {
    return err("Acesso restrito a admin.", "forbidden");
  }
  return ok({
    user: userResult.data,
    role: "admin",
    personId: data.person_id ?? null,
  });
}

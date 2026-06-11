import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
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

// React.cache: dedup per-render (RSC) — Sidebar + page no mesmo request fazem
// 1 chamada de rede de auth, não 2-3. Só as funções de LEITURA recebem cache;
// require* ficam fora (redirect/erro não deve ser memoizado por construção).
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createServer();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

// Delega ao getUser cacheado — sem isso, getUser() + getProfile() no mesmo
// render seriam 2 entradas de cache distintas e 2 chamadas auth.getUser().
export const getProfile = cache(async (): Promise<ProfileLite | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("role, person_id")
    .eq("id", user.id)
    .maybeSingle();
  // Erro engolido aqui rebaixava admin a member silenciosamente — e o cache
  // memoizava a resposta errada pro request inteiro. Falha de query = throw
  // (error boundary), não fallback de papel.
  if (error) throw new Error(`getProfile: ${error.message}`);
  return {
    user,
    role: (data?.role as Role) ?? "member",
    personId: data?.person_id ?? null,
  };
});

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
  // Delega ao getProfile (cacheado) em vez de duplicar o parse de profiles —
  // duas cópias da regra de papel divergem com o tempo. ActionResult não pode
  // throw (contrato das Server Actions): erro de query vira err() tipado.
  let profile: ProfileLite | null;
  try {
    profile = await getProfile();
  } catch {
    return err("Falha ao verificar permissões.", "db_error");
  }
  if (!profile) return err("Sessão expirada.", "unauthenticated");
  if (profile.role !== "admin") {
    return err("Acesso restrito a admin.", "forbidden");
  }
  return ok(profile);
}

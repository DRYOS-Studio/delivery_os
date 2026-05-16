import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { createServer } from "@/lib/db/client";

export async function getUser(): Promise<User | null> {
  const supabase = await createServer();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function requireUser(redirectToOnFail?: string): Promise<User> {
  const user = await getUser();
  if (user) return user;
  const target = redirectToOnFail ?? "/";
  redirect(`/login?redirectTo=${encodeURIComponent(target)}`);
}

export async function requireUserAction(): Promise<ActionResult<User>> {
  const user = await getUser();
  if (!user) return err("Sessão expirada.", "unauthenticated");
  return ok(user);
}

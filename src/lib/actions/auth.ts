"use server";

import { redirect } from "next/navigation";
import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { createServer } from "@/lib/db/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appUrl(): string {
  const value = process.env["NEXT_PUBLIC_APP_URL"];
  if (!value) throw new Error("Missing required env var: NEXT_PUBLIC_APP_URL");
  return value.replace(/\/$/, "");
}

export async function signInWithMagicLinkAction(
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const rawEmail = formData.get("email");
  const rawRedirectTo = formData.get("redirectTo");

  if (typeof rawEmail !== "string" || !EMAIL_RE.test(rawEmail.trim())) {
    return err("Informe um e-mail válido.", "invalid_email");
  }
  const email = rawEmail.trim().toLowerCase();
  const redirectTo =
    typeof rawRedirectTo === "string" && rawRedirectTo.startsWith("/")
      ? rawRedirectTo
      : "/";

  const supabase = await createServer();
  const emailRedirectTo = `${appUrl()}/auth/callback?next=${encodeURIComponent(redirectTo)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: false },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("signups not allowed") || message.includes("not allowed")) {
      return err("Acesso não autorizado. Contate o admin.", "not_invited");
    }
    if (message.includes("rate") || error.status === 429) {
      return err("Muitas tentativas. Aguarde 1 minuto.", "rate_limited");
    }
    return err("Falha ao enviar link. Tente novamente.", "sign_in_failed");
  }

  return ok({ email });
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServer();
  await supabase.auth.signOut();
  redirect("/login");
}

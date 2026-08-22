"use server";

import { redirect } from "next/navigation";
import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { createServer } from "@/lib/db/client";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signInWithPasswordAction(
  formData: FormData,
): Promise<ActionResult<{ email: string; redirectTo: string }>> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const rawRedirectTo = formData.get("redirectTo");

  if (typeof rawEmail !== "string" || !EMAIL_RE.test(rawEmail.trim())) {
    return err("Informe um e-mail válido.", "invalid_email");
  }
  if (typeof rawPassword !== "string" || rawPassword.length === 0) {
    return err("Informe a senha.", "missing_password");
  }

  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword;
  const redirectTo = safeRedirectPath(rawRedirectTo);

  const supabase = await createServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("invalid login credentials") ||
      message.includes("invalid_credentials") ||
      error.status === 400
    ) {
      return err("E-mail ou senha incorretos.", "invalid_credentials");
    }
    if (message.includes("email not confirmed")) {
      return err(
        "E-mail ainda não confirmado. Verifique sua caixa de entrada.",
        "email_not_confirmed",
      );
    }
    if (message.includes("rate") || error.status === 429) {
      return err("Muitas tentativas. Aguarde 1 minuto.", "rate_limited");
    }
    return err("Falha ao entrar. Tente novamente.", "sign_in_failed");
  }

  return ok({ email, redirectTo });
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServer();
  await supabase.auth.signOut();
  redirect("/login");
}

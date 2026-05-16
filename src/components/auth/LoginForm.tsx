"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signInWithPasswordAction } from "@/lib/actions/auth";

type Props = {
  redirectTo: string;
  initialError?: string | undefined;
};

type Status = "idle" | "submitting" | "error";

function mapInitialError(code: string | undefined): string | null {
  switch (code) {
    case "callback_failed":
      return "Falha ao autenticar. Tente novamente.";
    case "missing_code":
      return "Link inválido.";
    default:
      return null;
  }
}

export function LoginForm({
  redirectTo,
  initialError,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(
    initialError ? "error" : "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    mapInitialError(initialError),
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData): void {
    startTransition(async () => {
      setStatus("submitting");
      setErrorMessage(null);
      const result = await signInWithPasswordAction(formData);
      if (result.ok) {
        router.push(result.data.redirectTo);
      } else {
        setErrorMessage(result.error);
        setStatus("error");
      }
    });
  }

  const submitting = isPending || status === "submitting";

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="space-y-1">
        <label
          htmlFor="email"
          className="block font-mono text-[10px] text-mute uppercase tracking-wide"
        >
          E-mail
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="voce@empresa.com"
          disabled={submitting}
          className="w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="password"
          className="block font-mono text-[10px] text-mute uppercase tracking-wide"
        >
          Senha
        </label>
        <input
          id="password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
          disabled={submitting}
          className="w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-ink text-bg hover:bg-oak rounded px-3.5 py-2 text-[13px] font-medium disabled:opacity-50 transition-colors"
      >
        {submitting ? "Entrando..." : "Entrar"}
      </button>
      {errorMessage && (
        <p className="text-critical text-xs mt-2" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}

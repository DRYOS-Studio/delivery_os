"use client";

import { useState, useTransition } from "react";
import { signInWithMagicLinkAction } from "@/lib/actions/auth";

type Props = {
  redirectTo: string;
  initialError?: string | undefined;
};

type Status = "idle" | "sending" | "sent" | "error";

function mapInitialError(code: string | undefined): string | null {
  switch (code) {
    case "callback_failed":
      return "Falha ao autenticar. Tente novamente.";
    case "link_expired":
      return "Link expirado. Solicite novo.";
    case "missing_code":
      return "Link inválido. Solicite novo.";
    default:
      return null;
  }
}

export function LoginForm({ redirectTo, initialError }: Props): React.JSX.Element {
  const [status, setStatus] = useState<Status>(
    initialError ? "error" : "idle",
  );
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    mapInitialError(initialError),
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData): void {
    startTransition(async () => {
      setStatus("sending");
      setErrorMessage(null);
      const result = await signInWithMagicLinkAction(formData);
      if (result.ok) {
        setEmail(result.data.email);
        setStatus("sent");
      } else {
        setErrorMessage(result.error);
        setStatus("error");
      }
    });
  }

  if (status === "sent") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          Verifique seu e-mail em{" "}
          <strong className="text-ink">{email}</strong>.
        </p>
        <p className="font-mono text-xs text-mute">
          Pode levar até 1 minuto.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setEmail("");
            setErrorMessage(null);
          }}
          className="text-xs font-mono text-mute hover:text-ink underline"
        >
          trocar de e-mail
        </button>
      </div>
    );
  }

  const sending = isPending || status === "sending";

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="voce@empresa.com"
        disabled={sending}
        className="w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={sending}
        className="w-full bg-ink text-bg hover:bg-oak rounded px-3.5 py-2 text-[13px] font-medium disabled:opacity-50 transition-colors"
      >
        {sending ? "Enviando..." : "Enviar link"}
      </button>
      {errorMessage && (
        <p className="text-critical text-xs mt-2" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}

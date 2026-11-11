import Link from "next/link";
import type { ClientVaultAccessResult } from "@/lib/vault/client-vault-access";

type Props = {
  clientId: string;
  access: ClientVaultAccessResult;
  loadError?: string | undefined;
};

export function ClientVaultAccessGate({
  clientId,
  access,
  loadError,
}: Props): React.JSX.Element {
  if (access.kind === "forbidden") {
    return (
      <section className="max-w-lg space-y-3" data-testid="client-vault-forbidden">
        <h2 className="font-display text-lg text-ink font-semibold">Cofre</h2>
        <p className="text-sm text-mute">
          Você não tem permissão para ver o cofre deste cliente. Peça acesso à
          operação ou fale com um admin.
        </p>
        <Link href={`/clients/${clientId}`} className="text-sm text-oak hover:underline">
          Voltar ao cliente
        </Link>
      </section>
    );
  }

  const rpc =
    access.kind === "rpc_error"
      ? access
      : { kind: "rpc_error" as const, message: "Erro desconhecido." };

  return (
    <section className="max-w-lg space-y-3" data-testid="client-vault-rpc-error">
      <h2 className="font-display text-lg text-ink font-semibold">Cofre</h2>
      <p className="text-sm text-critical" role="alert">
        Não foi possível verificar o acesso ao cofre.
      </p>
      <p className="text-sm text-mute font-mono break-words">
        {rpc.code ? `${rpc.code}: ` : ""}
        {rpc.message}
      </p>
      {loadError ? (
        <p className="text-sm text-mute font-mono break-words">{loadError}</p>
      ) : null}
      <p className="text-xs text-mute">
        Se você é admin e a migration do cofre já foi aplicada, pode faltar{" "}
        <code className="text-ink">NOTIFY pgrst, &apos;reload schema&apos;</code>{" "}
        no banco (veja migration 20261110510000).
      </p>
      <Link href={`/clients/${clientId}`} className="text-sm text-oak hover:underline">
        Voltar ao cliente
      </Link>
    </section>
  );
}

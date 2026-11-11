import { notFound } from "next/navigation";
import { ClientCredentialForm } from "@/components/domain/ClientCredentialForm";
import { ClientVaultAccessGate } from "@/components/domain/ClientVaultAccessGate";
import { requireUser } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { checkClientVaultAccess } from "@/lib/vault/client-vault-access";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientVaultNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  await requireUser(`/clients/${id}/cofre/new`);

  const supabase = await createServer();
  const access = await checkClientVaultAccess(supabase, id);
  if (access.kind === "forbidden") {
    return <ClientVaultAccessGate clientId={id} access={access} />;
  }

  const { data: ops } = await supabase
    .from("operations")
    .select("id, name")
    .eq("client_id", id)
    .is("archived_at", null)
    .order("name");

  return (
    <>
      {access.kind === "rpc_error" ? (
        <p className="text-sm text-mute mb-4 border border-line rounded px-3 py-2 bg-card">
          Aviso: {access.message}
        </p>
      ) : null}
      <ClientCredentialForm
        clientId={id}
        operations={(ops ?? []).map((o) => ({ id: o.id, name: o.name }))}
      />
    </>
  );
}

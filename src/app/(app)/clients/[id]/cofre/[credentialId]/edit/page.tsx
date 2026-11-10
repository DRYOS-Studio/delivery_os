import { notFound } from "next/navigation";
import { ClientCredentialForm } from "@/components/domain/ClientCredentialForm";
import { ClientVaultAccessGate } from "@/components/domain/ClientVaultAccessGate";
import { requireUser } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { listClientCredentials } from "@/lib/db/queries/client-credentials";
import { checkClientVaultAccess } from "@/lib/vault/client-vault-access";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientVaultEditPage({
  params,
}: {
  params: Promise<{ id: string; credentialId: string }>;
}): Promise<React.JSX.Element> {
  const { id, credentialId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(credentialId)) notFound();
  await requireUser(`/clients/${id}/cofre/${credentialId}/edit`);

  const supabase = await createServer();
  const access = await checkClientVaultAccess(supabase, id);
  if (access.kind !== "allowed") {
    return (
      <ClientVaultAccessGate
        clientId={id}
        access={access}
      />
    );
  }

  const credentials = await listClientCredentials(
    id,
    { includeArchived: true },
    supabase,
  );
  const credential = credentials.find((c) => c.id === credentialId);
  if (!credential) notFound();

  const { data: ops } = await supabase
    .from("operations")
    .select("id, name")
    .eq("client_id", id)
    .is("archived_at", null)
    .order("name");

  return (
    <ClientCredentialForm
      clientId={id}
      operations={(ops ?? []).map((o) => ({ id: o.id, name: o.name }))}
      credential={credential}
    />
  );
}

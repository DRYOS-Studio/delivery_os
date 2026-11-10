import { notFound, redirect } from "next/navigation";
import { ClientCredentialForm } from "@/components/domain/ClientCredentialForm";
import { requireUser } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

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
  const { data: allowed } = await supabase.rpc("can_access_client_vault", {
    p_client_id: id,
  });
  if (!allowed) redirect(`/clients/${id}`);

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
    />
  );
}

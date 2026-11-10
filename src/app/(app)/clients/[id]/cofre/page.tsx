import { notFound, redirect } from "next/navigation";
import { ClientVaultSection } from "@/components/domain/ClientVaultSection";
import { requireUser } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  listClientCredentialAuditLogs,
  listClientCredentials,
} from "@/lib/db/queries/client-credentials";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientVaultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  await requireUser(`/clients/${id}/cofre`);

  const supabase = await createServer();
  const { data: allowed } = await supabase.rpc("can_access_client_vault", {
    p_client_id: id,
  });
  if (!allowed) redirect(`/clients/${id}`);

  const [credentials, auditLogs] = await Promise.all([
    listClientCredentials(id),
    listClientCredentialAuditLogs(id, 80),
  ]);

  return (
    <ClientVaultSection
      clientId={id}
      credentials={credentials}
      auditLogs={auditLogs}
    />
  );
}

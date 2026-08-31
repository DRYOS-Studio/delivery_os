import { redirect } from "next/navigation";
import { ClientForm } from "@/components/domain/ClientForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import {
  countActiveOperationsByClient,
  getClient,
} from "@/lib/db/queries/clients";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/clients");

  const client = await getClient(id);
  if (!client) redirect("/clients");

  const activeOps = await countActiveOperationsByClient(id);
  const hasOps = activeOps > 0;
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <PageHeader title={`Editar — ${client.name}`} />
      <ClientForm
        mode="edit"
        initialData={client}
        canChangeSlug={isAdmin || !hasOps}
        hasActiveOperations={hasOps}
        canArchive={!hasOps}
        archiveBlockedReason={
          hasOps
            ? `${activeOps} ${activeOps === 1 ? "Operação ainda ativa" : "Operações ainda ativas"} — encerre-${activeOps === 1 ? "a" : "as"} antes.`
            : null
        }
        isAdmin={isAdmin}
      />
    </>
  );
}

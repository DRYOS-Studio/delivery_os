import { notFound } from "next/navigation";
import { ClientVaultAccessGate } from "@/components/domain/ClientVaultAccessGate";
import { ClientVaultSection } from "@/components/domain/ClientVaultSection";
import { requireUser } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { loadClientVaultPage } from "@/lib/vault/load-client-vault-page";

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
  const loaded = await loadClientVaultPage(supabase, id);

  if (loaded.kind === "blocked") {
    const gateProps = loaded.loadError
      ? { clientId: id, access: loaded.access, loadError: loaded.loadError }
      : { clientId: id, access: loaded.access };
    return <ClientVaultAccessGate {...gateProps} />;
  }

  return (
    <>
      {loaded.accessWarning ? (
        <p className="text-sm text-mute mb-4 border border-line rounded px-3 py-2 bg-card">
          Aviso: {loaded.accessWarning}
        </p>
      ) : null}
      <ClientVaultSection
        clientId={id}
        credentials={loaded.credentials}
        auditLogs={loaded.auditLogs}
      />
    </>
  );
}

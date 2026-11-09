import Link from "next/link";
import { OperationForm } from "@/components/domain/OperationForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { getProfile } from "@/lib/auth/server";
import { listClients } from "@/lib/db/queries/clients";
import { listDiagnosticsForSelect } from "@/lib/db/queries/diagnostics";

type SearchParams = Promise<{ clientId?: string; returnTo?: string }>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { clientId, returnTo } = await searchParams;
  const safeReturnTo =
    returnTo?.startsWith("/clients/") || returnTo?.startsWith("/operations/")
      ? returnTo
      : undefined;

  const [clients, diagnosticsByClient] = await Promise.all([
    listClients(),
    listDiagnosticsForSelect(),
  ]);
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const clientsForSelect = clients.map((c) => ({ id: c.id, name: c.name }));
  const defaultClientId =
    clientId && clientsForSelect.some((c) => c.id === clientId)
      ? clientId
      : undefined;

  if (clientsForSelect.length === 0) {
    return (
      <>
        <PageHeader title="Nova operação" />
        <div className="bg-card border border-line rounded shadow-sm p-7 max-w-xl">
          <p className="font-display text-lg text-mute mb-3">
            Crie um Cliente primeiro.
          </p>
          <p className="font-body text-sm text-mute mb-5">
            Uma Operação precisa estar vinculada a um Cliente. Cadastre um
            antes de continuar.
          </p>
          <Link href="/clients/new">
            <Button variant="sage">Cadastrar Cliente</Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Nova operação"
        subtitle="Vincule uma Operação a um Cliente existente."
      />
      <OperationForm
        mode="create"
        clientsForSelect={clientsForSelect}
        diagnosticsByClient={diagnosticsByClient}
        isAdmin={isAdmin}
        {...(defaultClientId ? { defaultClientId } : {})}
        {...(safeReturnTo ? { returnTo: safeReturnTo } : {})}
      />
    </>
  );
}

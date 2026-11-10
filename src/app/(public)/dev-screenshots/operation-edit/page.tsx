import { notFound } from "next/navigation";
import { OperationForm } from "@/components/domain/OperationForm";
import { acmeCoreOperationEditFixture } from "@/lib/dev-fixtures/acme-core-operation-costs";

export default function DevScreenshotOperationEditPage(): React.JSX.Element {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-cream p-6 md:p-10 max-w-2xl">
      <h1 className="font-display text-xl font-semibold text-ink mb-2">
        Editar — Acme
      </h1>
      <p className="text-sm text-mute mb-6">Acme Core</p>
      <OperationForm
        mode="edit"
        initialData={acmeCoreOperationEditFixture}
        clientsForSelect={[{ id: acmeCoreOperationEditFixture.client.id, name: "Acme" }]}
        canArchive={false}
        archiveBlockedReason="Marque como Concluída ou Cancelada antes de arquivar."
        diagnosticsByClient={[]}
        isAdmin
      />
    </main>
  );
}

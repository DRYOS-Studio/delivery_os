import { notFound } from "next/navigation";
import { CostForm } from "@/components/domain/CostForm";
import { ACME_CORE_OPERATION_ID } from "@/lib/dev-fixtures/acme-core-operation-costs";

export default function DevScreenshotCostFormPage(): React.JSX.Element {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-cream p-6 md:p-10 max-w-xl">
      <h1 className="font-display text-xl font-semibold text-ink mb-6">
        Novo custo
      </h1>
      <CostForm mode="create" operationId={ACME_CORE_OPERATION_ID} isAdmin />
    </main>
  );
}

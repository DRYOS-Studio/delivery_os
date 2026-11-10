import { notFound } from "next/navigation";
import { CostsTab } from "@/components/domain/CostsTab";
import {
  ACME_CORE_OPERATION_ID,
  acmeCoreCostsBreakdown,
} from "@/lib/dev-fixtures/acme-core-operation-costs";

export default function DevScreenshotOperationCostsPage(): React.JSX.Element {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-cream p-6 md:p-10">
      <CostsTab
        operationId={ACME_CORE_OPERATION_ID}
        breakdown={acmeCoreCostsBreakdown}
      />
    </main>
  );
}

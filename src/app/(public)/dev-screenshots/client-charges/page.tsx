import { notFound } from "next/navigation";
import { ClientChargesSection } from "@/components/domain/ClientChargesSection";
import {
  ACME_CLIENT_ID,
  acmeClientChargesFixture,
} from "@/lib/dev-fixtures/acme-client-charges";
import type { ClientContractRow } from "@/lib/db/queries/client-contracts";

const contractsFixture: ClientContractRow[] = [
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    clientId: ACME_CLIENT_ID,
    label: "Contrato Core 2026",
    monthlyValue: 3000,
    currency: "BRL",
    reajusteNotes: null,
    startDate: "2026-01-01",
    endDate: null,
    paymentDayOfMonth: 10,
    status: "vigente",
    notes: null,
    filename: "contrato.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

export default function DevScreenshotClientChargesPage(): React.JSX.Element {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-cream p-6 md:p-10 max-w-3xl">
      <ClientChargesSection
        clientId={ACME_CLIENT_ID}
        charges={acmeClientChargesFixture}
        contracts={contractsFixture}
        registeredMrr={3000}
      />
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateClientJourneyStatusAction } from "@/lib/actions/client-journey";
import {
  clientJourneyLabel,
  clientJourneyOptionsForManualSelect,
  clientJourneyVariant,
} from "@/lib/utils/client-journey-status";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import type { ClientDetail } from "@/lib/db/queries/clients";
import type { OperationCardData } from "@/lib/db/queries/operations";

type Props = {
  client: ClientDetail;
  operations: OperationCardData[];
  isAdmin: boolean;
};

export function ClientJourneyPanel({
  client,
  operations,
  isAdmin,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = client.journey_status;

  async function onStatusChange(next: string): Promise<void> {
    setError(null);
    setSaving(true);
    const result = await updateClientJourneyStatusAction(client.id, next);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const showOnboardingAlert =
    status === "onboarding_pendente" && isAdmin;

  const scheduleHref = pickOnboardingScheduleHref(client.id, operations);

  return (
    <section className="mb-7 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Pill variant={clientJourneyVariant(status)}>
          {clientJourneyLabel(status)}
        </Pill>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-mute">
            <span className="font-mono text-[10px] uppercase">Jornada</span>
            <select
              className="min-h-[44px] bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft"
              value={status}
              disabled={saving}
              onChange={(e) => void onStatusChange(e.target.value)}
            >
              {clientJourneyOptionsForManualSelect().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p className="text-sm text-critical bg-critical-bg rounded px-3 py-2">
          {error}
        </p>
      )}
      {showOnboardingAlert && (
        <div className="bg-warning-bg border border-warning/30 rounded-lg px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <p className="font-display text-base text-ink font-semibold">
              Falta agendar a reunião de onboarding
            </p>
            <p className="text-sm text-mute mt-1">
              Crie uma reunião de onboarding na Operação deste cliente.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:ml-auto shrink-0">
            {scheduleHref ? (
              <Link href={scheduleHref}>
                <Button variant="sage" className="w-full min-h-[44px]">
                  Agendar onboarding
                </Button>
              </Link>
            ) : (
              <Link
                href={`/operations/new?clientId=${encodeURIComponent(client.id)}&returnTo=${encodeURIComponent(`/clients/${client.id}`)}`}
              >
                <Button variant="sage" className="w-full min-h-[44px]">
                  Criar operação para agendar
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function pickOnboardingScheduleHref(
  clientId: string,
  operations: OperationCardData[],
): string | null {
  const returnTo = encodeURIComponent(`/clients/${clientId}`);
  if (operations.length === 1) {
    const op = operations[0];
    if (!op) return null;
    return `/operations/${op.id}/meetings/new?kind=onboarding&returnTo=${returnTo}`;
  }
  if (operations.length > 1) {
    return `/clients/${clientId}/onboarding?returnTo=${returnTo}`;
  }
  return null;
}

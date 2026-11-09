"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { approveRegistrationInvitationAction } from "@/lib/actions/client-registration";
import { RegistrationSubmissionReviewSummary } from "@/components/domain/RegistrationSubmissionReviewSummary";
import type { ClientRegistrationSubmission } from "@/lib/validators/client-registration";

type Props = {
  invitationId: string;
  status: string;
  submission: ClientRegistrationSubmission;
  approvedClientId: string | null;
};

export function RegistrationInviteReviewPanel({
  invitationId,
  status,
  submission,
  approvedClientId,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function approve(): Promise<void> {
    if (!window.confirm("Aprovar e criar cliente com estes dados?")) return;
    setBusy(true);
    setError(null);
    const result = await approveRegistrationInvitationAction(invitationId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/clients/${result.data.clientId}`);
    router.refresh();
  }

  const title =
    submission.person_type === "pf"
      ? submission.full_name
      : submission.legal_name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl text-ink font-semibold">{title}</h1>
        <Pill variant={status === "preenchido" ? "warning" : "neutral"}>
          {status}
        </Pill>
      </div>

      {approvedClientId && (
        <Card className="p-4">
          <Link href={`/clients/${approvedClientId}`} className="text-sm text-oak">
            Ver cliente aprovado →
          </Link>
        </Card>
      )}

      <RegistrationSubmissionReviewSummary submission={submission} />

      {error && <p className="text-sm text-critical">{error}</p>}

      {status === "preenchido" && (
        <Button type="button" variant="sage" disabled={busy} onClick={() => void approve()}>
          Aprovar e criar cliente
        </Button>
      )}
    </div>
  );
}

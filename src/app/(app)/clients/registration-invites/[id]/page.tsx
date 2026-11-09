import Link from "next/link";
import { RegistrationInviteReviewPanel } from "@/components/domain/RegistrationInviteReviewPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  effectiveInvitationStatus,
  getRegistrationInvitationById,
  parseSubmittedPayload,
} from "@/lib/db/queries/client-registration-invitations";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function RegistrationInviteReviewPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  await requireAdmin("/clients");
  const { id } = await params;
  const supabase = await createServer();
  const row = await getRegistrationInvitationById(supabase, id);

  if (!row) {
    return (
      <PageHeader
        title="Convite não encontrado"
        actions={
          <Link href="/clients/registration-invites" className="text-sm text-oak">
            Voltar
          </Link>
        }
      />
    );
  }

  const status = effectiveInvitationStatus(row);
  const submission = parseSubmittedPayload(row.submitted_payload);

  return (
    <>
      <PageHeader
        title="Revisar cadastro"
        subtitle={row.prefill_contact_name}
        actions={
          <Link href="/clients/registration-invites" className="text-sm text-oak">
            Voltar à lista
          </Link>
        }
      />
      {!submission ? (
        <p className="text-sm text-mute">
          Ainda não há submissão para revisar (status: {status}).
        </p>
      ) : (
        <RegistrationInviteReviewPanel
          invitationId={row.id}
          status={status}
          submission={submission}
          approvedClientId={row.approved_client_id}
        />
      )}
    </>
  );
}

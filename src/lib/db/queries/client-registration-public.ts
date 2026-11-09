import { createAdmin } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import { hashRegistrationToken } from "@/lib/registration/token";
import {
  effectiveInvitationStatus,
  type RegistrationInvitationRow,
} from "@/lib/db/queries/client-registration-invitations";

export type PublicRegistrationPrefill = {
  invitationId: string;
  status: Database["public"]["Enums"]["client_registration_invitation_status"];
  prefillContactName: string;
  prefillContactPhone: string;
  inviteNote: string | null;
  expiresAt: string;
};

export async function getRegistrationInvitationByToken(
  rawToken: string,
): Promise<RegistrationInvitationRow | null> {
  const token = rawToken.trim();
  if (token.length < 16) return null;

  const admin = createAdmin();
  const tokenHash = hashRegistrationToken(token);
  const { data, error } = await admin
    .from("client_registration_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(`getRegistrationInvitationByToken: ${error.message}`);
  }
  return data;
}

export async function getPublicRegistrationPrefill(
  rawToken: string,
): Promise<PublicRegistrationPrefill | null> {
  const row = await getRegistrationInvitationByToken(rawToken);
  if (!row) return null;

  const status = effectiveInvitationStatus(row);

  return {
    invitationId: row.id,
    status,
    prefillContactName: row.prefill_contact_name,
    prefillContactPhone: row.prefill_contact_phone,
    inviteNote: row.invite_note,
    expiresAt: row.expires_at,
  };
}

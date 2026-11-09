import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/types";
import {
  clientRegistrationSubmissionSchema,
  type ClientRegistrationSubmission,
} from "@/lib/validators/client-registration";

export type InvitationStatus =
  Database["public"]["Enums"]["client_registration_invitation_status"];

export type RegistrationInvitationRow =
  Database["public"]["Tables"]["client_registration_invitations"]["Row"];

export type RegistrationInvitationListItem = {
  id: string;
  status: InvitationStatus;
  prefillContactName: string;
  prefillContactPhone: string;
  expiresAt: string;
  submittedAt: string | null;
  approvedClientId: string | null;
  createdAt: string;
};

const LIST_SELECT =
  "id, status, prefill_contact_name, prefill_contact_phone, expires_at, submitted_at, approved_client_id, created_at";

export async function listRegistrationInvitations(
  supabase: SupabaseClient<Database>,
): Promise<RegistrationInvitationListItem[]> {
  const { data, error } = await supabase
    .from("client_registration_invitations")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listRegistrationInvitations: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    prefillContactName: row.prefill_contact_name,
    prefillContactPhone: row.prefill_contact_phone,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at,
    approvedClientId: row.approved_client_id,
    createdAt: row.created_at,
  }));
}

export async function getRegistrationInvitationById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<RegistrationInvitationRow | null> {
  const { data, error } = await supabase
    .from("client_registration_invitations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getRegistrationInvitationById: ${error.message}`);
  return data;
}

export function parseSubmittedPayload(
  raw: Json | null,
): ClientRegistrationSubmission | null {
  if (raw === null) return null;
  const parsed = clientRegistrationSubmissionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function effectiveInvitationStatus(
  row: Pick<RegistrationInvitationRow, "status" | "expires_at">,
  now = new Date(),
): InvitationStatus {
  if (row.status === "enviado" && new Date(row.expires_at) < now) {
    return "expirado";
  }
  return row.status;
}

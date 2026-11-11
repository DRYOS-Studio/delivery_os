import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProfileDisplayNames } from "@/lib/db/queries/profile-display-names";
import {
  encryptCredentialSecret,
  decryptCredentialSecret,
  VaultEncryptionConfigError,
} from "@/lib/vault/credential-crypto";

export type ClientCredentialAuditAction =
  Database["public"]["Enums"]["client_credential_audit_action"];

export type ClientCredentialListRow = {
  id: string;
  clientId: string;
  operationId: string | null;
  serviceName: string;
  url: string | null;
  loginUsername: string | null;
  keyVersion: number;
  createdBy: string;
  updatedBy: string;
  updatedByLabel: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientCredentialAuditRow = {
  id: string;
  credentialId: string | null;
  clientId: string;
  action: ClientCredentialAuditAction;
  actorUserId: string | null;
  actorLabel: string | null;
  actorMcp: boolean;
  reason: string | null;
  createdAt: string;
};

const LIST_SELECT =
  "id, client_id, operation_id, service_name, url, login_username, key_version, created_by, updated_by, archived_at, created_at, updated_at";

const AUDIT_SELECT =
  "id, credential_id, client_id, action, actor_user_id, actor_mcp, reason, created_at";

const SECRET_SELECT =
  "id, client_id, key_version, password_ciphertext, notes_ciphertext, two_factor_ciphertext, archived_at";

async function resolveSupabase(
  supabase?: SupabaseClient<Database>,
): Promise<SupabaseClient<Database>> {
  return supabase ?? (await createServer());
}

function mapListRow(
  r: {
    id: string;
    client_id: string;
    operation_id: string | null;
    service_name: string;
    url: string | null;
    login_username: string | null;
    key_version: number;
    created_by: string;
    updated_by: string;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
  },
  labels: Map<string, string>,
): ClientCredentialListRow {
  return {
    id: r.id,
    clientId: r.client_id,
    operationId: r.operation_id,
    serviceName: r.service_name,
    url: r.url,
    loginUsername: r.login_username,
    keyVersion: r.key_version,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    updatedByLabel: labels.get(r.updated_by) ?? null,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listClientCredentials(
  clientId: string,
  opts?: { includeArchived?: boolean },
  supabase?: SupabaseClient<Database>,
): Promise<ClientCredentialListRow[]> {
  const db = await resolveSupabase(supabase);
  let q = db
    .from("client_credentials")
    .select(LIST_SELECT)
    .eq("client_id", clientId)
    .order("service_name", { ascending: true });
  if (!opts?.includeArchived) {
    q = q.is("archived_at", null);
  }
  const { data, error } = await q;
  if (error) throw new Error(`listClientCredentials: ${error.message}`);
  const rows = data ?? [];
  const labelMap = await resolveProfileDisplayNames(
    rows.map((r) => r.updated_by),
    db,
  );
  return rows.map((r) => mapListRow(r, labelMap));
}

export async function listClientCredentialAuditLogs(
  clientId: string,
  limit = 50,
  supabase?: SupabaseClient<Database>,
): Promise<ClientCredentialAuditRow[]> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
    .from("client_credential_audit_logs")
    .select(AUDIT_SELECT)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`listClientCredentialAuditLogs: ${error.message}`);
  }
  const rows = data ?? [];
  const actors = rows
    .map((r) => r.actor_user_id)
    .filter((id): id is string => typeof id === "string");
  const labelMap = await resolveProfileDisplayNames(actors, db);
  return rows.map((r) => ({
    id: r.id,
    credentialId: r.credential_id,
    clientId: r.client_id,
    action: r.action,
    actorUserId: r.actor_user_id,
    actorLabel: r.actor_user_id ? (labelMap.get(r.actor_user_id) ?? null) : null,
    actorMcp: r.actor_mcp,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

export type ClientCredentialSecrets = {
  password: string;
  notes: string | null;
  twoFactorNotes: string | null;
};

export async function insertClientCredentialAuditLog(
  db: SupabaseClient<Database>,
  entry: {
    credentialId: string | null;
    clientId: string;
    action: ClientCredentialAuditAction;
    actorUserId: string;
    actorMcp?: boolean;
    actorMcpTokenId?: string | null;
    reason?: string | null;
  },
): Promise<void> {
  const { error } = await db.from("client_credential_audit_logs").insert({
    credential_id: entry.credentialId,
    client_id: entry.clientId,
    action: entry.action,
    actor_user_id: entry.actorUserId,
    actor_mcp: entry.actorMcp ?? false,
    actor_mcp_token_id: entry.actorMcpTokenId ?? null,
    reason: entry.reason ?? null,
  });
  if (error) {
    throw new Error(`insertClientCredentialAuditLog: ${error.message}`);
  }
}

export type CreateClientCredentialInput = {
  clientId: string;
  operationId: string | null;
  serviceName: string;
  url: string | null;
  loginUsername: string | null;
  password: string;
  notes: string | null;
  twoFactorNotes: string | null;
};

export async function createClientCredential(
  input: CreateClientCredentialInput,
  actorUserId: string,
  supabase?: SupabaseClient<Database>,
): Promise<ClientCredentialListRow> {
  const db = await resolveSupabase(supabase);
  let passwordCipher: string;
  let keyVersion: number;
  try {
    const enc = encryptCredentialSecret(input.password);
    passwordCipher = enc.ciphertext;
    keyVersion = enc.keyVersion;
  } catch (e) {
    if (e instanceof VaultEncryptionConfigError) throw e;
    throw e;
  }
  const notesCipher = input.notes
    ? encryptCredentialSecret(input.notes).ciphertext
    : null;
  const twoCipher = input.twoFactorNotes
    ? encryptCredentialSecret(input.twoFactorNotes).ciphertext
    : null;

  const { data, error } = await db
    .from("client_credentials")
    .insert({
      client_id: input.clientId,
      operation_id: input.operationId,
      service_name: input.serviceName,
      url: input.url,
      login_username: input.loginUsername,
      password_ciphertext: passwordCipher,
      notes_ciphertext: notesCipher,
      two_factor_ciphertext: twoCipher,
      key_version: keyVersion,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select(LIST_SELECT)
    .single();
  if (error) throw new Error(`createClientCredential: ${error.message}`);

  await insertClientCredentialAuditLog(db, {
    credentialId: data.id,
    clientId: input.clientId,
    action: "create",
    actorUserId,
  });

  const labelMap = await resolveProfileDisplayNames([data.updated_by], db);
  return mapListRow(data, labelMap);
}

export type UpdateClientCredentialInput = {
  operationId?: string | null;
  serviceName?: string;
  url?: string | null;
  loginUsername?: string | null;
  password?: string;
  notes?: string | null;
  twoFactorNotes?: string | null;
  clearNotes?: boolean;
  clearTwoFactor?: boolean;
};

export async function updateClientCredential(
  credentialId: string,
  input: UpdateClientCredentialInput,
  actorUserId: string,
  supabase?: SupabaseClient<Database>,
): Promise<ClientCredentialListRow> {
  const db = await resolveSupabase(supabase);
  const patch: Database["public"]["Tables"]["client_credentials"]["Update"] = {
    updated_by: actorUserId,
  };
  if (input.operationId !== undefined) patch.operation_id = input.operationId;
  if (input.serviceName !== undefined) patch.service_name = input.serviceName;
  if (input.url !== undefined) patch.url = input.url;
  if (input.loginUsername !== undefined) patch.login_username = input.loginUsername;
  if (input.password) {
    const enc = encryptCredentialSecret(input.password);
    patch.password_ciphertext = enc.ciphertext;
    patch.key_version = enc.keyVersion;
  }
  if (input.clearNotes) patch.notes_ciphertext = null;
  else if (input.notes !== undefined && input.notes !== null) {
    patch.notes_ciphertext = encryptCredentialSecret(input.notes).ciphertext;
  }
  if (input.clearTwoFactor) patch.two_factor_ciphertext = null;
  else if (input.twoFactorNotes !== undefined && input.twoFactorNotes !== null) {
    patch.two_factor_ciphertext = encryptCredentialSecret(
      input.twoFactorNotes,
    ).ciphertext;
  }

  const { data, error } = await db
    .from("client_credentials")
    .update(patch)
    .eq("id", credentialId)
    .select(LIST_SELECT)
    .single();
  if (error) throw new Error(`updateClientCredential: ${error.message}`);

  await insertClientCredentialAuditLog(db, {
    credentialId: data.id,
    clientId: data.client_id,
    action: "update",
    actorUserId,
  });

  const labelMap = await resolveProfileDisplayNames([data.updated_by], db);
  return mapListRow(data, labelMap);
}

export async function archiveClientCredential(
  credentialId: string,
  actorUserId: string,
  supabase?: SupabaseClient<Database>,
): Promise<void> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
    .from("client_credentials")
    .update({ archived_at: new Date().toISOString(), updated_by: actorUserId })
    .eq("id", credentialId)
    .select("id, client_id")
    .single();
  if (error) throw new Error(`archiveClientCredential: ${error.message}`);
  await insertClientCredentialAuditLog(db, {
    credentialId: data.id,
    clientId: data.client_id,
    action: "archive",
    actorUserId,
  });
}

export async function deleteClientCredential(
  credentialId: string,
  actorUserId: string,
  supabase?: SupabaseClient<Database>,
): Promise<void> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
    .from("client_credentials")
    .select("id, client_id")
    .eq("id", credentialId)
    .maybeSingle();
  if (error) throw new Error(`deleteClientCredential: ${error.message}`);
  if (!data) throw new Error("Credencial não encontrada.");

  await insertClientCredentialAuditLog(db, {
    credentialId: data.id,
    clientId: data.client_id,
    action: "delete",
    actorUserId,
  });

  const { error: delErr } = await db
    .from("client_credentials")
    .delete()
    .eq("id", credentialId);
  if (delErr) throw new Error(`deleteClientCredential.delete: ${delErr.message}`);
}

export async function revealClientCredentialSecrets(
  credentialId: string,
  actorUserId: string,
  opts: {
    action: "reveal" | "copy";
    reason?: string | null;
    actorMcp?: boolean;
    actorMcpTokenId?: string | null;
  },
  supabase?: SupabaseClient<Database>,
): Promise<ClientCredentialSecrets & { clientId: string }> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
    .from("client_credentials")
    .select(SECRET_SELECT)
    .eq("id", credentialId)
    .maybeSingle();
  if (error) throw new Error(`revealClientCredentialSecrets: ${error.message}`);
  if (!data) throw new Error("Credencial não encontrada.");
  if (data.archived_at) throw new Error("Credencial arquivada.");

  let password: string;
  try {
    password = decryptCredentialSecret(
      data.password_ciphertext,
      data.key_version,
    );
  } catch (e) {
    if (e instanceof VaultEncryptionConfigError) throw e;
    throw new Error("Não foi possível decifrar a credencial.");
  }
  const notes = data.notes_ciphertext
    ? decryptCredentialSecret(data.notes_ciphertext, data.key_version)
    : null;
  const twoFactorNotes = data.two_factor_ciphertext
    ? decryptCredentialSecret(data.two_factor_ciphertext, data.key_version)
    : null;

  await insertClientCredentialAuditLog(db, {
    credentialId: data.id,
    clientId: data.client_id,
    action: opts.action,
    actorUserId,
    actorMcp: opts.actorMcp ?? false,
    actorMcpTokenId: opts.actorMcpTokenId ?? null,
    reason: opts.reason ?? null,
  });

  return {
    clientId: data.client_id,
    password,
    notes,
    twoFactorNotes,
  };
}

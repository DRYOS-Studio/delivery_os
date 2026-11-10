"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import {
  archiveClientCredential,
  createClientCredential,
  deleteClientCredential,
  revealClientCredentialSecrets,
  updateClientCredential,
} from "@/lib/db/queries/client-credentials";
import { VaultEncryptionConfigError } from "@/lib/vault/credential-crypto";
import {
  createClientCredentialSchema,
  revealClientCredentialSchema,
  updateClientCredentialSchema,
} from "@/lib/validators/client-credential";

function revalidateVaultPaths(clientId: string) {
  revalidatePath(`/clients/${clientId}/cofre`);
}

function vaultConfigMessage(e: unknown): string {
  if (e instanceof VaultEncryptionConfigError) return e.message;
  return "Cofre indisponível.";
}

export async function createClientCredentialAction(
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const parsed = createClientCredentialSchema.safeParse({
    client_id: clientId,
    operation_id: formData.get("operation_id") ?? undefined,
    service_name: formData.get("service_name"),
    url: formData.get("url") ?? undefined,
    login_username: formData.get("login_username") ?? undefined,
    password: formData.get("password"),
    notes: formData.get("notes") ?? undefined,
    two_factor_notes: formData.get("two_factor_notes") ?? undefined,
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  if (parsed.data.client_id !== clientId) {
    return err("Cliente inválido.");
  }
  try {
    const row = await createClientCredential(
      {
        clientId: parsed.data.client_id,
        operationId: parsed.data.operation_id,
        serviceName: parsed.data.service_name,
        url: parsed.data.url,
        loginUsername: parsed.data.login_username,
        password: parsed.data.password,
        notes: parsed.data.notes,
        twoFactorNotes: parsed.data.two_factor_notes,
      },
      user.data.id,
    );
    revalidateVaultPaths(clientId);
    return ok({ id: row.id });
  } catch (e) {
    if (e instanceof VaultEncryptionConfigError) return err(vaultConfigMessage(e));
    const message = e instanceof Error ? e.message : "Falha ao criar credencial.";
    return err(message);
  }
}

export async function updateClientCredentialAction(
  clientId: string,
  credentialId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const passwordRaw = formData.get("password");
  const parsed = updateClientCredentialSchema.safeParse({
    credential_id: credentialId,
    operation_id: formData.get("operation_id") ?? undefined,
    service_name: formData.get("service_name") ?? undefined,
    url: formData.get("url") ?? undefined,
    login_username: formData.get("login_username") ?? undefined,
    password:
      typeof passwordRaw === "string" && passwordRaw.trim() !== ""
        ? passwordRaw
        : undefined,
    notes: formData.get("notes") ?? undefined,
    two_factor_notes: formData.get("two_factor_notes") ?? undefined,
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  try {
    const updateInput: Parameters<typeof updateClientCredential>[1] = {};
    if (parsed.data.operation_id !== undefined) {
      updateInput.operationId = parsed.data.operation_id;
    }
    if (parsed.data.service_name !== undefined) {
      updateInput.serviceName = parsed.data.service_name;
    }
    if (parsed.data.url !== undefined) updateInput.url = parsed.data.url;
    if (parsed.data.login_username !== undefined) {
      updateInput.loginUsername = parsed.data.login_username;
    }
    if (parsed.data.password) updateInput.password = parsed.data.password;
    if (parsed.data.notes !== undefined) updateInput.notes = parsed.data.notes;
    if (parsed.data.two_factor_notes !== undefined) {
      updateInput.twoFactorNotes = parsed.data.two_factor_notes;
    }

    const row = await updateClientCredential(
      credentialId,
      updateInput,
      user.data.id,
    );
    if (row.clientId !== clientId) return err("Credencial não pertence a este cliente.");
    revalidateVaultPaths(clientId);
    return ok({ id: row.id });
  } catch (e) {
    if (e instanceof VaultEncryptionConfigError) return err(vaultConfigMessage(e));
    const message = e instanceof Error ? e.message : "Falha ao atualizar credencial.";
    return err(message);
  }
}

export async function revealClientCredentialAction(
  clientId: string,
  credentialId: string,
  action: "reveal" | "copy",
): Promise<ActionResult<{ password: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  try {
    const secrets = await revealClientCredentialSecrets(
      credentialId,
      user.data.id,
      { action },
    );
    if (secrets.clientId !== clientId) {
      return err("Credencial não pertence a este cliente.");
    }
    revalidateVaultPaths(clientId);
    return ok({ password: secrets.password });
  } catch (e) {
    if (e instanceof VaultEncryptionConfigError) return err(vaultConfigMessage(e));
    const message = e instanceof Error ? e.message : "Falha ao revelar senha.";
    return err(message);
  }
}

export async function archiveClientCredentialAction(
  clientId: string,
  credentialId: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  try {
    await archiveClientCredential(credentialId, user.data.id);
    revalidateVaultPaths(clientId);
    return ok({ id: credentialId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao arquivar.";
    return err(message);
  }
}

export async function deleteClientCredentialAction(
  clientId: string,
  credentialId: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  try {
    await deleteClientCredential(credentialId, user.data.id);
    revalidateVaultPaths(clientId);
    return ok({ id: credentialId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao excluir.";
    return err(message);
  }
}

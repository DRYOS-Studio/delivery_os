"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getAttachment } from "@/lib/db/queries/attachments";
import { getMeeting } from "@/lib/db/queries/meetings";
import { sanitizeFilename } from "@/lib/utils/file";
import {
  attachmentUploadSchema,
  MAX_ATTACHMENT_BYTES,
  setAttachmentVisibilitySchema,
} from "@/lib/validators/attachment";

const BUCKET = "attachments";

export async function uploadAttachmentAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const userId = userResult.data.id;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return err("Arquivo obrigatório.", "validation_file");
  }
  if (file.size === 0) {
    return err("Arquivo vazio.", "validation_file");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return err("Arquivo maior que 10MB.", "validation_size_bytes");
  }

  const parsed = attachmentUploadSchema.safeParse({
    filename: file.name,
    size_bytes: file.size,
    mime_type: file.type || "application/octet-stream",
    description: ((formData.get("description") as string | null) ?? "").trim(),
    meeting_id: ((formData.get("meeting_id") as string | null) ?? "").trim(),
    // typeof guard: FormDataEntryValue pode ser File — cast cego + .trim() viraria
    // throw (Inv. 13). Garbage string o Zod rejeita.
    visibility: (() => {
      const raw = formData.get("visibility");
      return (typeof raw === "string" ? raw.trim() : "") || "cliente";
    })(),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  const data = parsed.data;

  // Validate meeting_id belongs to operation
  if (data.meeting_id) {
    const m = await getMeeting(data.meeting_id);
    if (!m || m.operation_id !== operationId) {
      return err("Reunião inválida pra esta Operação.", "invalid_meeting");
    }
  }

  const sanitized = sanitizeFilename(data.filename);
  const storagePath = `${operationId}/${crypto.randomUUID()}-${sanitized}`;

  const supabase = await createServer();

  // 1. Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: data.mime_type,
      upsert: false,
    });
  if (uploadErr) {
    return dbErr(uploadErr, "uploadAttachmentAction.storage");
  }

  // 2. Insert DB row
  const { data: row, error: insErr } = await supabase
    .from("attachments")
    .insert({
      operation_id: operationId,
      meeting_id: data.meeting_id ?? null,
      storage_path: storagePath,
      filename: data.filename,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
      description: data.description ?? null,
      visibility: data.visibility,
      uploaded_by: userId,
    })
    .select("id")
    .single();

  if (insErr) {
    // Best-effort cleanup
    await supabase.storage
      .from(BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
    return dbErr(insErr, "uploadAttachmentAction.db");
  }
  if (!row) {
    await supabase.storage
      .from(BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
    return err("Falha inesperada ao salvar anexo.", "no_data");
  }

  revalidatePath(`/operations/${operationId}`);
  if (data.meeting_id) {
    revalidatePath(
      `/operations/${operationId}/meetings/${data.meeting_id}/edit`,
    );
  }
  return ok({ id: row.id, operationId });
}

export async function setAttachmentVisibilityAction(
  attachmentId: string,
  visibility: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const parsed = setAttachmentVisibilitySchema.safeParse({
    attachment_id: attachmentId,
    visibility,
  });
  if (!parsed.success) {
    return err("Dados inválidos.", "validation_failed");
  }

  const supabase = await createServer();
  // .select() obrigatório: RLS que filtra a row vira update de 0 rows SEM erro —
  // sem ele a action retornaria ok num no-op (toast de sucesso falso).
  const { data: row, error } = await supabase
    .from("attachments")
    .update({ visibility: parsed.data.visibility })
    .eq("id", parsed.data.attachment_id)
    .select("id, operation_id, meeting_id")
    .maybeSingle();
  if (error) return dbErr(error, "setAttachmentVisibilityAction");
  if (!row) return err("Anexo não encontrado.", "not_found");

  revalidatePath(`/operations/${row.operation_id}`);
  if (row.meeting_id) {
    revalidatePath(
      `/operations/${row.operation_id}/meetings/${row.meeting_id}/edit`,
    );
  }
  return ok({ id: row.id });
}

export async function deleteAttachmentAction(
  attachmentId: string,
): Promise<ActionResult<{ operationId: string; meetingId: string | null }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const current = await getAttachment(attachmentId);
  if (!current) return err("Anexo não encontrado.", "not_found");

  const supabase = await createServer();
  const { error: delErr } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId);
  if (delErr) return dbErr(delErr, "deleteAttachmentAction");

  // Best-effort cleanup
  await supabase.storage
    .from(BUCKET)
    .remove([current.storage_path])
    .catch(() => undefined);

  revalidatePath(`/operations/${current.operation_id}`);
  if (current.meeting_id) {
    revalidatePath(
      `/operations/${current.operation_id}/meetings/${current.meeting_id}/edit`,
    );
  }
  return ok({
    operationId: current.operation_id,
    meetingId: current.meeting_id,
  });
}

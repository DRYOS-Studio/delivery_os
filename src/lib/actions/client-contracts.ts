"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { sanitizeFilename } from "@/lib/utils/file";
import { clientContractFormSchema } from "@/lib/validators/client-contract";

const BUCKET = "contracts";
const MAX_BYTES = 50 * 1024 * 1024;

function parseContractForm(formData: FormData) {
  return {
    label: ((formData.get("label") as string | null) ?? "").trim(),
    monthly_value: ((formData.get("monthly_value") as string | null) ?? "").trim(),
    currency: ((formData.get("currency") as string | null) ?? "BRL").trim(),
    reajuste_notes: ((formData.get("reajuste_notes") as string | null) ?? "").trim(),
    start_date: ((formData.get("start_date") as string | null) ?? "").trim(),
    end_date: ((formData.get("end_date") as string | null) ?? "").trim(),
    payment_day_of_month: (
      (formData.get("payment_day_of_month") as string | null) ?? ""
    ).trim(),
    status: ((formData.get("status") as string | null) ?? "rascunho").trim(),
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
  };
}

export async function createClientContractAction(
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const file = formData.get("file");
  if (!(file instanceof File)) return err("Arquivo obrigatório.", "validation_file");
  if (file.size === 0) return err("Arquivo vazio.", "validation_file");
  if (file.size > MAX_BYTES) {
    return err("Arquivo maior que 50MB.", "validation_size_bytes");
  }

  const parsed = clientContractFormSchema.safeParse(parseContractForm(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Dados inválidos.", "validation_form");
  }
  const d = parsed.data;

  const sanitized = sanitizeFilename(file.name);
  const storagePath = `${clientId}/${crypto.randomUUID()}-${sanitized}`;
  const mime = file.type || "application/octet-stream";

  const supabase = await createServer();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: mime, upsert: false });
  if (upErr) return dbErr(upErr, "createClientContractAction.storage");

  const { data: row, error: insErr } = await supabase
    .from("client_contracts")
    .insert({
      client_id: clientId,
      label: d.label,
      monthly_value: d.monthly_value,
      currency: d.currency ?? "BRL",
      reajuste_notes: d.reajuste_notes ?? null,
      start_date: d.start_date ?? null,
      end_date: d.end_date ?? null,
      payment_day_of_month: d.payment_day_of_month,
      status: d.status,
      notes: d.notes ?? null,
      storage_path: storagePath,
      filename: file.name,
      mime_type: mime,
      size_bytes: file.size,
      uploaded_by: userResult.data.id,
    })
    .select("id")
    .single();

  if (insErr) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
    return dbErr(insErr, "createClientContractAction.db");
  }
  if (!row) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
    return err("Falha ao salvar contrato.", "no_data");
  }

  revalidatePath(`/clients/${clientId}`);
  return ok({ id: row.id });
}

export async function deleteClientContractAction(
  contractId: string,
  clientId: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const supabase = await createServer();
  const { data: row, error: fetchErr } = await supabase
    .from("client_contracts")
    .select("storage_path, client_id")
    .eq("id", contractId)
    .maybeSingle();
  if (fetchErr) return dbErr(fetchErr, "deleteClientContractAction.fetch");
  if (!row || row.client_id !== clientId) {
    return err("Contrato não encontrado.", "not_found");
  }

  const { error: delErr } = await supabase
    .from("client_contracts")
    .delete()
    .eq("id", contractId);
  if (delErr) return dbErr(delErr, "deleteClientContractAction.db");

  await supabase.storage.from(BUCKET).remove([row.storage_path]).catch(() => undefined);
  revalidatePath(`/clients/${clientId}`);
  return ok({ id: contractId });
}

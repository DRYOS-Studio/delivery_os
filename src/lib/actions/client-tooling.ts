"use server";

import {
  type ActionResult,
  dbErr,
  err,
  ok,
} from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { clientSoftwareItemSchema } from "@/lib/validators/client-software-item";
import { clientTechItemSchema } from "@/lib/validators/client-tech-item";

type PostgresError = { code?: string; message: string };

function techFromForm(formData: FormData) {
  return {
    name: ((formData.get("name") as string | null) ?? "").trim(),
    category: ((formData.get("category") as string | null) ?? "").trim(),
    url: ((formData.get("url") as string | null) ?? "").trim(),
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
  };
}

function softwareFromForm(formData: FormData) {
  return {
    name: ((formData.get("name") as string | null) ?? "").trim(),
    purpose: ((formData.get("purpose") as string | null) ?? "").trim(),
    url: ((formData.get("url") as string | null) ?? "").trim(),
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
  };
}

export async function createClientTechItemAction(
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const parsed = clientTechItemSchema.safeParse(techFromForm(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(first?.message ?? "Dados inválidos.", `validation_${field}`);
  }

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("client_tech_items")
    .insert({
      client_id: clientId,
      name: parsed.data.name,
      category: parsed.data.category ?? null,
      url: parsed.data.url ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error) return dbErr(error as PostgresError, "createClientTechItem");
  if (!data) return err("Falha ao criar item.", "no_data");
  return ok({ id: data.id });
}

export async function updateClientTechItemAction(
  itemId: string,
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const parsed = clientTechItemSchema.safeParse(techFromForm(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(first?.message ?? "Dados inválidos.", `validation_${field}`);
  }

  const supabase = await createServer();
  const { error } = await supabase
    .from("client_tech_items")
    .update({
      name: parsed.data.name,
      category: parsed.data.category ?? null,
      url: parsed.data.url ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", itemId)
    .eq("client_id", clientId);

  if (error) return dbErr(error as PostgresError, "updateClientTechItem");
  return ok({ id: itemId });
}

export async function deleteClientTechItemAction(
  itemId: string,
  clientId: string,
): Promise<ActionResult<undefined>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const supabase = await createServer();
  const { error } = await supabase
    .from("client_tech_items")
    .delete()
    .eq("id", itemId)
    .eq("client_id", clientId);

  if (error) return dbErr(error as PostgresError, "deleteClientTechItem");
  return ok(undefined);
}

export async function createClientSoftwareItemAction(
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const parsed = clientSoftwareItemSchema.safeParse(softwareFromForm(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(first?.message ?? "Dados inválidos.", `validation_${field}`);
  }

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("client_software_items")
    .insert({
      client_id: clientId,
      name: parsed.data.name,
      purpose: parsed.data.purpose ?? null,
      url: parsed.data.url ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error) return dbErr(error as PostgresError, "createClientSoftwareItem");
  if (!data) return err("Falha ao criar software.", "no_data");
  return ok({ id: data.id });
}

export async function updateClientSoftwareItemAction(
  itemId: string,
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const parsed = clientSoftwareItemSchema.safeParse(softwareFromForm(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(first?.message ?? "Dados inválidos.", `validation_${field}`);
  }

  const supabase = await createServer();
  const { error } = await supabase
    .from("client_software_items")
    .update({
      name: parsed.data.name,
      purpose: parsed.data.purpose ?? null,
      url: parsed.data.url ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", itemId)
    .eq("client_id", clientId);

  if (error) return dbErr(error as PostgresError, "updateClientSoftwareItem");
  return ok({ id: itemId });
}

export async function deleteClientSoftwareItemAction(
  itemId: string,
  clientId: string,
): Promise<ActionResult<undefined>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const supabase = await createServer();
  const { error } = await supabase
    .from("client_software_items")
    .delete()
    .eq("id", itemId)
    .eq("client_id", clientId);

  if (error) return dbErr(error as PostgresError, "deleteClientSoftwareItem");
  return ok(undefined);
}

"use server";

import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import {
  getProfile,
  requireAdminAction,
  requireUserAction,
} from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { clientHasActiveOperations, getClient } from "@/lib/db/queries/clients";
import { clientSchema, type ClientOutput } from "@/lib/validators/client";

type PostgresError = { code?: string; message: string };

function isUniqueViolation(error: PostgresError): boolean {
  return error.code === "23505";
}

function stripDigits(raw: string | null): string {
  return (raw ?? "").replace(/\D/g, "");
}

function get(formData: FormData, key: string): string {
  return (formData.get(key) as string | null) ?? "";
}

function formDataToClientInput(formData: FormData) {
  const cnpjRaw = stripDigits(formData.get("cnpj") as string | null);
  const zipRaw = stripDigits(formData.get("address_zip") as string | null);
  const stateRaw = get(formData, "address_state").trim().toUpperCase();
  return {
    name: get(formData, "name"),
    slug: get(formData, "slug"),
    notes: get(formData, "notes"),
    legal_name: get(formData, "legal_name"),
    cnpj: cnpjRaw,
    inscricao_estadual: get(formData, "inscricao_estadual"),
    primary_contact_name: get(formData, "primary_contact_name"),
    primary_contact_email: get(formData, "primary_contact_email"),
    primary_contact_phone: get(formData, "primary_contact_phone"),
    address_street: get(formData, "address_street"),
    address_number: get(formData, "address_number"),
    address_complement: get(formData, "address_complement"),
    address_district: get(formData, "address_district"),
    address_city: get(formData, "address_city"),
    address_state: stateRaw,
    address_zip: zipRaw,
  };
}

function toDbPayload(data: ClientOutput) {
  return {
    name: data.name,
    slug: data.slug,
    notes: data.notes ?? null,
    legal_name: data.legal_name ?? null,
    cnpj: data.cnpj ?? null,
    inscricao_estadual: data.inscricao_estadual ?? null,
    primary_contact_name: data.primary_contact_name ?? null,
    primary_contact_email: data.primary_contact_email ?? null,
    primary_contact_phone: data.primary_contact_phone ?? null,
    address_street: data.address_street ?? null,
    address_number: data.address_number ?? null,
    address_complement: data.address_complement ?? null,
    address_district: data.address_district ?? null,
    address_city: data.address_city ?? null,
    address_state: data.address_state ?? null,
    address_zip: data.address_zip ?? null,
  };
}

export async function createClientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const parsed = clientSchema.safeParse(formDataToClientInput(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }

  const supabase = await createServer();
  const { data, error: dbError } = await supabase
    .from("clients")
    .insert(toDbPayload(parsed.data))
    .select("id, slug")
    .single();

  if (dbError) {
    if (isUniqueViolation(dbError as PostgresError)) {
      return err("Já existe Cliente com esse slug.", "slug_taken");
    }
    return dbErr(dbError, "createClientAction");
  }
  if (!data) return err("Falha inesperada ao criar Cliente.", "no_data");

  return ok({ id: data.id, slug: data.slug });
}

export async function updateClientAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const parsed = clientSchema.safeParse(formDataToClientInput(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }

  const current = await getClient(id);
  if (!current) return err("Cliente não encontrado.", "not_found");

  if (parsed.data.slug !== current.slug) {
    const hasOps = await clientHasActiveOperations(id);
    if (hasOps) {
      const profile = await getProfile();
      if (profile?.role !== "admin") {
        return err(
          "Cliente tem Operações ativas; slug não pode mudar.",
          "slug_locked",
        );
      }
    }
  }

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("clients")
    .update(toDbPayload(parsed.data))
    .eq("id", id);

  if (dbError) {
    if (isUniqueViolation(dbError as PostgresError)) {
      return err("Já existe Cliente com esse slug.", "slug_taken");
    }
    return dbErr(dbError, "updateClientAction");
  }

  return ok({ id });
}

export async function archiveClientAction(
  id: string,
): Promise<ActionResult<undefined>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const hasOps = await clientHasActiveOperations(id);
  if (hasOps) {
    return err(
      "Cliente tem Operações ativas. Arquive-as antes.",
      "has_active_operations",
    );
  }

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (dbError) return dbErr(dbError, "archiveClientAction");
  return ok(undefined);
}

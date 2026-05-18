"use server";

import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import {
  getPerson,
  personHasActiveAllocations,
} from "@/lib/db/queries/persons";
import { personSchema } from "@/lib/validators/person";

type PostgresError = { code?: string; message: string };
type PersonInsert = Database["public"]["Tables"]["persons"]["Insert"];
type PersonUpdate = Database["public"]["Tables"]["persons"]["Update"];

function parseFormData(formData: FormData) {
  return {
    kind: ((formData.get("kind") as string | null) ?? "").trim(),
    name: ((formData.get("name") as string | null) ?? "").trim(),
    email: ((formData.get("email") as string | null) ?? "").trim(),
    specialty: ((formData.get("specialty") as string | null) ?? "").trim(),
    external_role: ((formData.get("external_role") as string | null) ?? "").trim(),
    client_id: ((formData.get("client_id") as string | null) ?? "").trim(),
    hourly_rate: ((formData.get("hourly_rate") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const raw = parseFormData(formData);
  const parsed = personSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

function mapDbError(error: PostgresError) {
  if (error.code === "23503") return err("Cliente inválido.", "invalid_client");
  if (error.code === "23514")
    return err("Configuração inválida pra o tipo selecionado.", "check_violation");
  return null;
}

export async function createPersonAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const insertPayload: PersonInsert =
    data.kind === "internal"
      ? {
          kind: "internal",
          name: data.name,
          email: data.email ?? null,
          specialty: data.specialty,
          external_role: null,
          client_id: null,
          hourly_rate: data.hourly_rate ?? null,
        }
      : {
          kind: "external",
          name: data.name,
          email: data.email ?? null,
          specialty: null,
          external_role: data.external_role,
          client_id: data.client_id,
          hourly_rate: data.hourly_rate ?? null,
        };

  const { data: row, error: dbError } = await supabase
    .from("persons")
    .insert(insertPayload)
    .select("id")
    .single();

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "createPersonAction");
  }
  if (!row) return err("Falha inesperada ao criar Pessoa.", "no_data");
  return ok({ id: row.id });
}

export async function updatePersonAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getPerson(id);
  if (!current) return err("Pessoa não encontrada.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  if (data.kind !== current.kind) {
    return err(
      "Tipo da pessoa não pode mudar. Crie nova pessoa.",
      "kind_locked",
    );
  }

  const updatePayload: PersonUpdate =
    data.kind === "internal"
      ? {
          name: data.name,
          email: data.email ?? null,
          specialty: data.specialty,
          hourly_rate: data.hourly_rate ?? null,
        }
      : {
          name: data.name,
          email: data.email ?? null,
          external_role: data.external_role,
          client_id: data.client_id,
          hourly_rate: data.hourly_rate ?? null,
        };

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("persons")
    .update(updatePayload)
    .eq("id", id);

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "updatePersonAction");
  }
  return ok({ id });
}

export async function archivePersonAction(
  id: string,
): Promise<ActionResult<undefined>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const current = await getPerson(id);
  if (!current) return err("Pessoa não encontrada.", "not_found");

  if (current.kind === "internal") {
    const hasAllocs = await personHasActiveAllocations(id);
    if (hasAllocs) {
      return err(
        "Pessoa tem alocações ativas. Remova antes de arquivar.",
        "has_active_allocations",
      );
    }
  }

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("persons")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (dbError) return dbErr(dbError, "archivePersonAction");
  return ok(undefined);
}

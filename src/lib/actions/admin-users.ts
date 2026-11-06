"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { logProfileActivity } from "@/lib/actions/admin-activity";
import { requireAdminAction } from "@/lib/auth/server";
import { createServiceRole } from "@/lib/db/service-role";
import {
  inviteUserFormSchema,
  setPersonLinkFormSchema,
  type InviteUserFormOutput,
} from "@/lib/validators/admin-user";
import { isDuplicateUserError } from "@/lib/utils/supabase-auth-errors";

function generateTempPassword(): string {
  return randomBytes(18).toString("base64url");
}

/** Procura usuário por e-mail (paginação do Admin API). */
async function findUserIdByEmail(
  service: ReturnType<typeof createServiceRole>,
  emailNorm: string,
): Promise<string | null> {
  const target = emailNorm.toLowerCase();
  const maxPages = 25;
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) return null;
    const users = data.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < 1000) break;
  }
  return null;
}

async function ensureProfileRow(
  service: ReturnType<typeof createServiceRole>,
  userId: string,
): Promise<ActionResult<true>> {
  const { data: existing, error: selErr } = await service
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (selErr) return dbErr(selErr, "ensureProfileRow.select");
  if (existing) return ok(true);
  const { error: insErr } = await service.from("profiles").insert({
    id: userId,
    role: "member",
  });
  if (insErr) return dbErr(insErr, "ensureProfileRow.insert");
  return ok(true);
}

async function upsertOperationMembers(
  service: ReturnType<typeof createServiceRole>,
  profileId: string,
  actorProfileId: string,
  operationIds: string[],
): Promise<ActionResult<true>> {
  const unique = Array.from(new Set(operationIds));

  const { data: validRows, error: vErr } = await service
    .from("operations")
    .select("id")
    .in("id", unique)
    .is("archived_at", null);
  if (vErr) return dbErr(vErr, "upsertOperationMembers.validate_ops");
  const validIds = new Set((validRows ?? []).map((r) => r.id));
  const missing = unique.filter((id) => !validIds.has(id));
  if (missing.length > 0) {
    return err(
      "Uma ou mais operações não existem ou estão arquivadas.",
      "validation_operation_ids",
    );
  }

  const { data: current, error: curErr } = await service
    .from("operation_members")
    .select("operation_id")
    .eq("profile_id", profileId);
  if (curErr) return dbErr(curErr, "upsertOperationMembers.current");
  const currentSet = new Set((current ?? []).map((r) => r.operation_id));

  const toAdd = unique.filter((id) => !currentSet.has(id));
  const toRemove = [...currentSet].filter((id) => !unique.includes(id));

  if (toRemove.length > 0) {
    const { error: delErr } = await service
      .from("operation_members")
      .delete()
      .eq("profile_id", profileId)
      .in("operation_id", toRemove);
    if (delErr) return dbErr(delErr, "upsertOperationMembers.delete");
  }

  if (toAdd.length > 0) {
    const { error: insErr } = await service.from("operation_members").insert(
      toAdd.map((operation_id) => ({
        profile_id: profileId,
        operation_id,
        created_by: actorProfileId,
      })),
    );
    if (insErr) return dbErr(insErr, "upsertOperationMembers.insert");
  }

  return ok(true);
}

export type InviteUserResult = {
  userId: string;
  mode: "invited" | "created_confirmed" | "updated";
  tempPassword?: string;
};

export async function inviteUserAction(
  formData: FormData,
): Promise<ActionResult<InviteUserResult>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;
  const actorId = guard.data.user.id;

  const raw = {
    email: String(formData.get("email") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    role: String(formData.get("role") ?? "member").trim(),
    person_id: String(formData.get("person_id") ?? "").trim(),
    operation_ids: formData
      .getAll("operation_ids")
      .map((v) => String(v).trim())
      .filter(Boolean),
  };

  const parsed = inviteUserFormSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Dados inválidos.", "validation_failed");
  }
  const data: InviteUserFormOutput = parsed.data;

  let service: ReturnType<typeof createServiceRole>;
  try {
    service = createServiceRole();
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Servidor sem chave service role.",
      "config_error",
    );
  }

  const emailNorm = data.email.toLowerCase();

  if (data.person_id) {
    const { data: person, error: pErr } = await service
      .from("persons")
      .select("id")
      .eq("id", data.person_id)
      .is("archived_at", null)
      .maybeSingle();
    if (pErr) return dbErr(pErr, "inviteUser.person");
    if (!person) return err("Pessoa não encontrada ou arquivada.", "invalid_person");
  }

  let userId = await findUserIdByEmail(service, emailNorm);
  let tempPassword: string | undefined;
  let authCreated = false;

  if (!userId) {
    const inv = await service.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.name },
    });

    if (!inv.error && inv.data.user?.id) {
      userId = inv.data.user.id;
      authCreated = true;
    } else if (inv.error) {
      if (isDuplicateUserError(inv.error)) {
        userId = await findUserIdByEmail(service, emailNorm);
      } else {
        const pw = generateTempPassword();
        const cr = await service.auth.admin.createUser({
          email: data.email,
          email_confirm: true,
          password: pw,
          user_metadata: { full_name: data.name },
        });

        if (!cr.error && cr.data.user?.id) {
          userId = cr.data.user.id;
          authCreated = true;
          tempPassword = pw;
        } else if (cr.error && isDuplicateUserError(cr.error)) {
          userId = await findUserIdByEmail(service, emailNorm);
        } else {
          const msg = inv.error.message || cr.error?.message || "Falha ao criar usuário.";
          return err(msg, "auth_invite_failed");
        }
      }
    }
  }

  if (!userId) {
    return err("Não foi possível resolver o usuário pelo e-mail.", "auth_lookup_failed");
  }

  const ensure = await ensureProfileRow(service, userId);
  if (!ensure.ok) return ensure;

  const { data: before, error: bErr } = await service
    .from("profiles")
    .select("role, person_id, name")
    .eq("id", userId)
    .single();
  if (bErr) return dbErr(bErr, "inviteUser.before_profile");

  const { error: upProfileErr } = await service.from("profiles").upsert(
    {
      id: userId,
      name: data.name,
      role: data.role,
      person_id: data.person_id ?? null,
    },
    { onConflict: "id" },
  );
  if (upProfileErr) return dbErr(upProfileErr, "inviteUser.upsert_profile");

  if (data.role === "member") {
    const om = await upsertOperationMembers(service, userId, actorId, data.operation_ids);
    if (!om.ok) return om;
  } else {
    const { error: clearOmErr } = await service
      .from("operation_members")
      .delete()
      .eq("profile_id", userId);
    if (clearOmErr) return dbErr(clearOmErr, "inviteUser.clear_operation_members");
  }

  const mode: InviteUserResult["mode"] = authCreated
    ? tempPassword
      ? "created_confirmed"
      : "invited"
    : "updated";

  try {
    if (authCreated) {
      await logProfileActivity(userId, "invited", null, null, { email: data.email, role: data.role }, {
        via: tempPassword ? "createUser_confirmed" : "invite",
      });
    } else {
      await logProfileActivity(
        userId,
        "invite_sync",
        null,
        null,
        { email: data.email, role: data.role },
        { idempotent: true },
      );
    }

    if (before.role !== data.role) {
      await logProfileActivity(userId, "role_changed", "role", before.role, data.role, {
        email: data.email,
      });
    }

    const oldPid = before.person_id;
    const newPid = data.person_id ?? null;
    if (oldPid !== newPid) {
      await logProfileActivity(
        userId,
        "person_linked",
        "person_id",
        oldPid,
        newPid,
        { email: data.email },
      );
    }
  } catch {
    /* activity: migration profile ou RPC indisponível */
  }

  revalidatePath("/admin");

  return ok({
    userId,
    mode,
    ...(tempPassword ? { tempPassword } : {}),
  });
}

export async function setProfilePersonLinkAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; person_id: string | null }>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  const raw = {
    profile_id: String(formData.get("profile_id") ?? "").trim(),
    person_id: String(formData.get("person_id") ?? "").trim(),
  };
  const parsed = setPersonLinkFormSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Dados inválidos.", "validation_failed");
  }
  const { profile_id: profileId, person_id: personId } = parsed.data;

  let service: ReturnType<typeof createServiceRole>;
  try {
    service = createServiceRole();
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Servidor sem chave service role.",
      "config_error",
    );
  }

  if (personId) {
    const { data: person, error: pErr } = await service
      .from("persons")
      .select("id")
      .eq("id", personId)
      .is("archived_at", null)
      .maybeSingle();
    if (pErr) return dbErr(pErr, "setProfilePersonLink.person");
    if (!person) return err("Pessoa não encontrada ou arquivada.", "invalid_person");
  }

  const { data: before, error: bErr } = await service
    .from("profiles")
    .select("person_id")
    .eq("id", profileId)
    .maybeSingle();
  if (bErr) return dbErr(bErr, "setProfilePersonLink.before");
  if (!before) return err("Perfil não encontrado.", "not_found");

  const { error: upErr } = await service
    .from("profiles")
    .update({ person_id: personId ?? null })
    .eq("id", profileId);
  if (upErr) return dbErr(upErr, "setProfilePersonLink.update");

  try {
    if (before.person_id !== (personId ?? null)) {
      await logProfileActivity(
        profileId,
        "person_linked",
        "person_id",
        before.person_id,
        personId ?? null,
        {},
      );
    }
  } catch {
    /* migration */
  }

  revalidatePath("/admin");
  return ok({ id: profileId, person_id: personId ?? null });
}

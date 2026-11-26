"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import {
  disconnectGoogleCalendarConnection,
  getGoogleCalendarConnectionPublic,
  loadGoogleCalendarTokens,
  setGoogleCalendarTarget,
} from "@/lib/db/queries/google-calendar-integration";
import { GoogleCalendarApiClient } from "@/lib/google-calendar/api-client";
import { googleOAuthConfigured } from "@/lib/google-calendar/config";
import { getValidGoogleCalendarAccessToken } from "@/lib/google-calendar/token-access";

export async function disconnectGoogleCalendarAction(): Promise<
  ActionResult<true>
> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  try {
    await disconnectGoogleCalendarConnection();
    revalidatePath("/admin");
    return ok(true);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao desconectar.";
    return err(message, "state_conflict");
  }
}

export async function setGoogleCalendarIdAction(
  calendarId: string,
  calendarSummary: string | null,
): Promise<ActionResult<true>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  const id = calendarId.trim();
  if (!id) return err("Selecione um calendário.", "validation_failed");
  try {
    await setGoogleCalendarTarget({ calendarId: id, calendarSummary });
    revalidatePath("/admin");
    return ok(true);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao salvar calendário.";
    return err(message, "db_error");
  }
}

export async function listGoogleCalendarsForAdminAction(): Promise<
  ActionResult<{ id: string; summary: string; primary?: boolean }[]>
> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  if (!googleOAuthConfigured()) {
    return err("Google OAuth não configurado no ambiente.", "state_conflict");
  }
  const connection = await getGoogleCalendarConnectionPublic();
  if (!connection.connected) {
    return err("Conecte uma conta Google antes.", "state_conflict");
  }
  try {
    const auth = await getValidGoogleCalendarAccessToken();
    if (!auth) {
      return err("Tokens indisponíveis.", "state_conflict");
    }
    const client = new GoogleCalendarApiClient(
      auth.accessToken,
      auth.calendarId,
    );
    const calendars = await client.listCalendars();
    return ok(calendars);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao listar calendários.";
    return err(message, "db_error");
  }
}

export async function getGoogleCalendarAdminStatusAction(): Promise<
  ActionResult<{
    configured: boolean;
    connection: Awaited<ReturnType<typeof getGoogleCalendarConnectionPublic>>;
    hasRefreshToken: boolean;
  }>
> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  const connection = await getGoogleCalendarConnectionPublic();
  const tokens = await loadGoogleCalendarTokens();
  return ok({
    configured: googleOAuthConfigured(),
    connection,
    hasRefreshToken: Boolean(tokens?.refreshToken),
  });
}
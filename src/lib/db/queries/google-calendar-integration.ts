import { createAdmin } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import {
  GOOGLE_CALENDAR_SINGLETON_KEY,
} from "@/lib/google-calendar/config";
import {
  decryptCredentialSecret,
  encryptCredentialSecret,
} from "@/lib/vault/credential-crypto";

export type GoogleCalendarConnectionPublic = {
  connected: boolean;
  accountEmail: string | null;
  calendarId: string | null;
  calendarSummary: string | null;
  tokenExpiresAt: string | null;
};

export type GoogleCalendarTokens = {
  accessToken: string;
  refreshToken: string;
  calendarId: string;
  tokenExpiresAt: string;
  accountEmail: string;
};

type ConnectionRow =
  Database["public"]["Tables"]["google_calendar_connections"]["Row"];

function decryptTokens(row: ConnectionRow): GoogleCalendarTokens {
  const accessToken = decryptCredentialSecret(
    row.access_token_ciphertext,
    row.access_token_key_version,
  );
  const refreshToken = decryptCredentialSecret(
    row.refresh_token_ciphertext,
    row.refresh_token_key_version,
  );
  return {
    accessToken,
    refreshToken,
    calendarId: row.calendar_id,
    tokenExpiresAt: row.token_expires_at,
    accountEmail: row.account_email,
  };
}

async function loadConnectionRow(): Promise<ConnectionRow | null> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("*")
    .eq("singleton_key", GOOGLE_CALENDAR_SINGLETON_KEY)
    .maybeSingle();
  if (error) throw new Error(`google_calendar_connections: ${error.message}`);
  return data;
}

export async function getGoogleCalendarConnectionPublic(): Promise<GoogleCalendarConnectionPublic> {
  try {
    const row = await loadConnectionRow();
    if (!row) {
      return {
        connected: false,
        accountEmail: null,
        calendarId: null,
        calendarSummary: null,
        tokenExpiresAt: null,
      };
    }
    return {
      connected: true,
      accountEmail: row.account_email,
      calendarId: row.calendar_id,
      calendarSummary: row.calendar_summary,
      tokenExpiresAt: row.token_expires_at,
    };
  } catch {
    return {
      connected: false,
      accountEmail: null,
      calendarId: null,
      calendarSummary: null,
      tokenExpiresAt: null,
    };
  }
}

export async function loadGoogleCalendarTokens(): Promise<GoogleCalendarTokens | null> {
  const row = await loadConnectionRow();
  if (!row) return null;
  try {
    return decryptTokens(row);
  } catch {
    return null;
  }
}

export async function upsertGoogleCalendarConnection(input: {
  accountEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAtIso: string;
  connectedByUserId: string;
  calendarId?: string;
  calendarSummary?: string | null;
}): Promise<void> {
  const accessEnc = encryptCredentialSecret(input.accessToken);
  const refreshEnc = encryptCredentialSecret(input.refreshToken);
  const admin = createAdmin();
  const { error } = await admin.from("google_calendar_connections").upsert(
    {
      singleton_key: GOOGLE_CALENDAR_SINGLETON_KEY,
      account_email: input.accountEmail,
      calendar_id: input.calendarId ?? "primary",
      calendar_summary: input.calendarSummary ?? null,
      access_token_ciphertext: accessEnc.ciphertext,
      access_token_key_version: accessEnc.keyVersion,
      refresh_token_ciphertext: refreshEnc.ciphertext,
      refresh_token_key_version: refreshEnc.keyVersion,
      token_expires_at: input.expiresAtIso,
      connected_by: input.connectedByUserId,
    },
    { onConflict: "singleton_key" },
  );
  if (error) throw new Error(`upsertGoogleCalendarConnection: ${error.message}`);
}

export async function updateGoogleCalendarAccessToken(input: {
  accessToken: string;
  expiresAtIso: string;
}): Promise<void> {
  const enc = encryptCredentialSecret(input.accessToken);
  const admin = createAdmin();
  const { error } = await admin
    .from("google_calendar_connections")
    .update({
      access_token_ciphertext: enc.ciphertext,
      access_token_key_version: enc.keyVersion,
      token_expires_at: input.expiresAtIso,
    })
    .eq("singleton_key", GOOGLE_CALENDAR_SINGLETON_KEY);
  if (error) throw new Error(`updateGoogleCalendarAccessToken: ${error.message}`);
}

export async function setGoogleCalendarTarget(input: {
  calendarId: string;
  calendarSummary: string | null;
}): Promise<void> {
  const admin = createAdmin();
  const { error } = await admin
    .from("google_calendar_connections")
    .update({
      calendar_id: input.calendarId,
      calendar_summary: input.calendarSummary,
    })
    .eq("singleton_key", GOOGLE_CALENDAR_SINGLETON_KEY);
  if (error) throw new Error(`setGoogleCalendarTarget: ${error.message}`);
}

export async function disconnectGoogleCalendarConnection(): Promise<void> {
  const admin = createAdmin();
  const { error } = await admin
    .from("google_calendar_connections")
    .delete()
    .eq("singleton_key", GOOGLE_CALENDAR_SINGLETON_KEY);
  if (error) throw new Error(`disconnectGoogleCalendarConnection: ${error.message}`);
}
import { randomUUID } from "node:crypto";
import {
  GOOGLE_CALENDAR_API_BASE,
  GOOGLE_CALENDAR_TIMEZONE,
} from "@/lib/google-calendar/config";

export type GoogleCalendarEventInput = {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  attendeeEmails: string[];
  sendInvites: boolean;
};

export type GoogleCalendarEventResult = {
  id: string;
  htmlLink: string | null;
  meetLink: string | null;
};

type ConferenceEntryPoint = { entryPointType?: string; uri?: string };

type GoogleEventResponse = {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: ConferenceEntryPoint[];
  };
};

function meetLinkFromEvent(data: GoogleEventResponse): string | null {
  if (data.hangoutLink?.trim()) return data.hangoutLink.trim();
  const video = data.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video" && e.uri,
  );
  return video?.uri?.trim() ?? null;
}

function sendUpdatesParam(sendInvites: boolean): string {
  return sendInvites ? "all" : "none";
}

export class GoogleCalendarApiClient {
  constructor(
    private readonly accessToken: string,
    private readonly calendarId: string,
  ) {}

  private async request(
    path: string,
    init?: RequestInit & { searchParams?: Record<string, string> },
  ): Promise<Response> {
    const url = new URL(`${GOOGLE_CALENDAR_API_BASE}${path}`);
    if (init?.searchParams) {
      for (const [k, v] of Object.entries(init.searchParams)) {
        url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    return res;
  }

  async createEvent(
    input: GoogleCalendarEventInput,
  ): Promise<GoogleCalendarEventResult> {
    const body = this.buildEventBody(input);
    const res = await this.request(
      `/calendars/${encodeURIComponent(this.calendarId)}/events`,
      {
        method: "POST",
        searchParams: {
          conferenceDataVersion: "1",
          sendUpdates: sendUpdatesParam(input.sendInvites),
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Google create event: ${res.status} ${text.slice(0, 300)}`,
      );
    }
    const data = (await res.json()) as GoogleEventResponse;
    if (!data.id) throw new Error("Google create event sem id.");
    return {
      id: data.id,
      htmlLink: data.htmlLink ?? null,
      meetLink: meetLinkFromEvent(data),
    };
  }

  async updateEvent(
    eventId: string,
    input: GoogleCalendarEventInput,
  ): Promise<GoogleCalendarEventResult> {
    const body = this.buildEventBody(input);
    const res = await this.request(
      `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        searchParams: {
          conferenceDataVersion: "1",
          sendUpdates: sendUpdatesParam(input.sendInvites),
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Google update event: ${res.status} ${text.slice(0, 300)}`,
      );
    }
    const data = (await res.json()) as GoogleEventResponse;
    if (!data.id) throw new Error("Google update event sem id.");
    return {
      id: data.id,
      htmlLink: data.htmlLink ?? null,
      meetLink: meetLinkFromEvent(data),
    };
  }

  async cancelEvent(eventId: string, sendInvites: boolean): Promise<void> {
    const res = await this.request(
      `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        searchParams: { sendUpdates: sendUpdatesParam(sendInvites) },
      },
    );
    if (res.status === 404 || res.status === 410) return;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Google cancel event: ${res.status} ${text.slice(0, 300)}`,
      );
    }
  }

  async listCalendars(): Promise<
    { id: string; summary: string; primary?: boolean }[]
  > {
    const res = await this.request("/users/me/calendarList", { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Google list calendars: ${res.status} ${text.slice(0, 300)}`,
      );
    }
    const data = (await res.json()) as {
      items?: { id?: string; summary?: string; primary?: boolean }[];
    };
    return (data.items ?? [])
      .filter((c): c is { id: string; summary: string; primary?: boolean } =>
        Boolean(c.id && c.summary),
      )
      .map((c) => ({
        id: c.id,
        summary: c.summary,
        ...(c.primary !== undefined ? { primary: c.primary } : {}),
      }));
  }

  private buildEventBody(input: GoogleCalendarEventInput): Record<string, unknown> {
    const requestId = randomUUID();
    const attendees = input.attendeeEmails
      .filter((e) => e.includes("@"))
      .map((email) => ({ email }));
    return {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.startIso,
        timeZone: GOOGLE_CALENDAR_TIMEZONE,
      },
      end: {
        dateTime: input.endIso,
        timeZone: GOOGLE_CALENDAR_TIMEZONE,
      },
      attendees,
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };
  }
}
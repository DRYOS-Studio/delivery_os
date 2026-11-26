import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google-calendar/config", () => ({
  googleOAuthConfigured: () => true,
  GOOGLE_CALENDAR_SINGLETON_KEY: "dryos",
}));

const markUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db/client", () => ({
  createAdmin: () => ({
    from: (table: string) => {
      if (table === "meetings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "m1",
                    title: "Reunião",
                    scheduled_at: "2026-11-26T15:00:00.000Z",
                    ended_at: null,
                    notes: null,
                    kind: "general",
                    operation_id: "op1",
                    google_event_id: null,
                    google_calendar_send_invites: true,
                  },
                  error: null,
                }),
            }),
          }),
          update: (patch: unknown) => {
            markUpdate(patch);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      if (table === "persons") {
        return {
          select: () => ({
            in: () => ({
              is: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "operations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    name: "Core",
                    client: { name: "Cliente" },
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "meeting_agenda_items") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

vi.mock("@/lib/google-calendar/token-access", () => ({
  getValidGoogleCalendarAccessToken: () =>
    Promise.resolve({ accessToken: "at", calendarId: "primary" }),
}));

vi.mock("@/lib/google-calendar/api-client", () => ({
  GoogleCalendarApiClient: class {
    createEvent = vi.fn().mockRejectedValue(new Error("Google indisponível"));
  },
}));

vi.mock("@/lib/utils/log-route-error", () => ({
  logRouteError: vi.fn(),
}));

describe("syncMeetingWithGoogleCalendar failure path", () => {
  beforeEach(() => {
    markUpdate.mockClear();
  });

  it("marca sync pendente sem propagar erro", async () => {
    const { syncMeetingWithGoogleCalendar } = await import(
      "@/lib/google-calendar/sync-meeting"
    );
    await expect(
      syncMeetingWithGoogleCalendar({
        meetingId: "m1",
        mode: "create",
        sendInvites: true,
        attendeeIds: [],
      }),
    ).resolves.toBeUndefined();

    expect(markUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        google_calendar_sync_status: "pending",
        google_calendar_sync_error: expect.stringContaining("Google"),
      }),
    );
  });
});
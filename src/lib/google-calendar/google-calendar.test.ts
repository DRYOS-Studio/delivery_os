import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleCalendarApiClient } from "@/lib/google-calendar/api-client";
import {
  buildMeetingCalendarDescription,
  defaultMeetingEndIso,
} from "@/lib/google-calendar/build-event";

describe("buildMeetingCalendarDescription", () => {
  it("inclui contexto sem valores financeiros", () => {
    const desc = buildMeetingCalendarDescription({
      title: "Kickoff",
      scheduledAt: "2026-11-26T15:00:00.000Z",
      endedAt: null,
      notes: "MRR R$ 10.000\nAnotação segura",
      kind: "onboarding",
      clientName: "Richaeny",
      operationName: "Core",
      operationId: "881c0252-a269-4296-8af3-d235b3c78efc",
      agendaTitles: ["Apresentação"],
    });
    expect(desc).toContain("Richaeny");
    expect(desc).toContain("Onboarding");
    expect(desc).not.toMatch(/MRR/i);
    expect(desc).toContain("Anotação segura");
  });
});

describe("defaultMeetingEndIso", () => {
  it("usa +1h quando sem término", () => {
    const start = "2026-11-26T15:00:00.000Z";
    const end = defaultMeetingEndIso(start, null);
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(
      60 * 60 * 1000,
    );
  });
});

describe("GoogleCalendarApiClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("createEvent envia conferenceDataVersion e sendUpdates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "evt1",
          htmlLink: "https://calendar.google.com/event?eid=evt1",
          conferenceData: {
            entryPoints: [
              { entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    global.fetch = fetchMock;

    const client = new GoogleCalendarApiClient("token", "primary");
    const result = await client.createEvent({
      summary: "Teste",
      description: "Corpo",
      startIso: "2026-11-26T15:00:00.000Z",
      endIso: "2026-11-26T16:00:00.000Z",
      attendeeEmails: ["a@dryos.studio"],
      sendInvites: true,
    });

    expect(result.id).toBe("evt1");
    expect(result.meetLink).toContain("meet.google.com");
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("conferenceDataVersion=1");
    expect(calledUrl).toContain("sendUpdates=all");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.conferenceData?.createRequest?.conferenceSolutionKey?.type).toBe(
      "hangoutsMeet",
    );
  });

  it("updateEvent usa sendUpdates=none quando convites desligados", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: "evt2", htmlLink: "https://calendar.google.com" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    global.fetch = fetchMock;

    const client = new GoogleCalendarApiClient("token", "primary");
    await client.updateEvent("evt2", {
      summary: "Atualizado",
      description: "",
      startIso: "2026-11-26T15:00:00.000Z",
      endIso: "2026-11-26T16:00:00.000Z",
      attendeeEmails: [],
      sendInvites: false,
    });

    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("sendUpdates=none");
    expect(calledUrl).toContain("/events/evt2");
  });

  it("cancelEvent tolera 404", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("", { status: 404 }));

    const client = new GoogleCalendarApiClient("token", "primary");
    await expect(client.cancelEvent("gone", true)).resolves.toBeUndefined();
  });

  it("createEvent propaga falha da API", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("quota", { status: 503 }),
    );
    const client = new GoogleCalendarApiClient("token", "primary");
    await expect(
      client.createEvent({
        summary: "X",
        description: "",
        startIso: "2026-11-26T15:00:00.000Z",
        endIso: "2026-11-26T16:00:00.000Z",
        attendeeEmails: [],
        sendInvites: false,
      }),
    ).rejects.toThrow(/Google create event/);
  });
});
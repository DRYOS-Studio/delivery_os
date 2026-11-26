import { describe, expect, it } from "vitest";
import {
  buildMeetingFormPayload,
  meetingFormClientSchema,
  meetingFormSchema,
} from "@/lib/validators/meeting-form";

/** Regressão Zod 4: `.omit()` em schema com `.refine()` quebra na avaliação do módulo. */
describe("meeting-form validators (module + onboarding)", () => {
  it("schemas exportados são utilizáveis", () => {
    expect(meetingFormSchema).toBeDefined();
    expect(meetingFormClientSchema).toBeDefined();
  });

  it("parse payload de onboarding no client schema", () => {
    const scheduled = "2026-11-26T15:00:00.000Z";
    const client = meetingFormClientSchema.parse({
      title: "Reunião de onboarding",
      scheduled_at: scheduled,
      visibility: "cliente",
      kind: "onboarding",
      attendee_ids: [],
      agenda_items: [{ title: "", notes: "" }],
      next_steps: [
        { description: "", due_date: "", assignee_person_id: "", frente_id: "" },
      ],
      auto_create_tasks_from_next_steps: true,
    });
    expect(client.kind).toBe("onboarding");
    expect(client.title).toBe("Reunião de onboarding");

    const built = buildMeetingFormPayload(client, "");
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.data.kind).toBe("onboarding");
      expect(meetingFormSchema.safeParse(built.data).success).toBe(true);
    }
  });
});
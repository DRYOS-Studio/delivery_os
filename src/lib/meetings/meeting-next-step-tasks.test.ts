import { describe, expect, it } from "vitest";
import {
  appendExternalAssigneeNote,
  buildTaskTitleAndBody,
} from "@/lib/meetings/meeting-next-step-tasks";

describe("meeting-next-step-tasks helpers", () => {
  it("appendExternalAssigneeNote idempotente", () => {
    const base = "Fazer X";
    const once = appendExternalAssigneeNote(base, "André");
    const twice = appendExternalAssigneeNote(once, "André");
    expect(once).toContain("(cliente)");
    expect(twice).toBe(once);
  });

  it("buildTaskTitleAndBody separa título longo", () => {
    const long = "a".repeat(250);
    const { title, description } = buildTaskTitleAndBody(long);
    expect(title.length).toBe(200);
    expect(description).toBe(long);
  });
});

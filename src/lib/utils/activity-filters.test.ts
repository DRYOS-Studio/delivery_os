import { describe, expect, it } from "vitest";
import {
  actionsForCategory,
  dateRangeForPreset,
  resolveActivityListFilters,
} from "@/lib/utils/activity-filters";

describe("activity-filters", () => {
  it("mapeia categoria assignee para ações SQL", () => {
    expect(actionsForCategory("assignee")).toEqual([
      "assignee_added",
      "assignee_removed",
    ]);
  });

  it("preset hoje define intervalo do dia", () => {
    const now = new Date("2026-11-09T15:30:00.000Z");
    const range = dateRangeForPreset("today", now);
    expect(range.createdAfter).toBeDefined();
    expect(range.createdBefore).toBeDefined();
    expect(new Date(range.createdAfter!).getTime()).toBeLessThanOrEqual(
      now.getTime(),
    );
  });

  it("resolve filtros com limit padrão", () => {
    const r = resolveActivityListFilters({
      category: "status",
      datePreset: "7d",
    });
    expect(r.statusFieldOnly).toBe(true);
    expect(r.limit).toBe(50);
    expect(r.actions).toEqual(["updated"]);
  });
});

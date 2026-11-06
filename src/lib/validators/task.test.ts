import { describe, expect, it } from "vitest";
import {
  taskSchema,
  taskUpdateFieldsWithoutAssigneesSchema,
} from "@/lib/validators/task";

describe("taskSchema", () => {
  it("rejects start_date after due_date", () => {
    const r = taskSchema.safeParse({
      title: "Valid title here",
      status: "todo",
      start_date: "2026-02-01",
      due_date: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });
});

describe("taskUpdateFieldsWithoutAssigneesSchema", () => {
  it("allows empty object (partial update)", () => {
    const r = taskUpdateFieldsWithoutAssigneesSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("rejects inconsistent dates on partial update when both provided", () => {
    const r = taskUpdateFieldsWithoutAssigneesSchema.safeParse({
      start_date: "2026-06-10",
      due_date: "2026-06-01",
    });
    expect(r.success).toBe(false);
  });
});

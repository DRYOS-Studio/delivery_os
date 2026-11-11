import { describe, expect, it } from "vitest";
import { mergeAttendeeCandidates } from "@/lib/db/queries/meetings-attendee-candidates";
import type { AttendeeRef } from "@/lib/db/queries/meetings";

function person(
  id: string,
  name: string,
  kind: AttendeeRef["kind"],
): AttendeeRef {
  return { id, name, kind };
}

describe("mergeAttendeeCandidates", () => {
  it("ordena por kind e depois nome", () => {
    const merged = mergeAttendeeCandidates(
      [person("1", "Zeca", "internal"), person("2", "Ana", "internal")],
      [person("3", "Bob", "external")],
    );
    expect(merged.map((p) => p.name)).toEqual(["Bob", "Ana", "Zeca"]);
    expect(merged[0]?.kind).toBe("external");
  });
});

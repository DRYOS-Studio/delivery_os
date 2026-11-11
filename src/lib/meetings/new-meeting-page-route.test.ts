import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("rota meetings/new (onboarding)", () => {
  it("usa loader com frentes e attendeeCandidates para o MeetingForm", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "src/app/(app)/operations/[id]/meetings/new/page.tsx",
      ),
      "utf8",
    );
    expect(src).toContain("loadNewMeetingPageData");
    expect(src).toMatch(/frentes=\{frentes\}/);
    expect(src).toMatch(/attendeeCandidates=\{attendeeCandidates\}/);
    expect(src).toContain('"onboarding"');
    expect(src).toContain("returnTo");
  });
});

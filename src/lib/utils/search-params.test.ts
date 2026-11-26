import { describe, expect, it } from "vitest";
import {
  firstSearchParam,
  parseNewMeetingSearchParams,
} from "@/lib/utils/search-params";

describe("firstSearchParam", () => {
  it("retorna primeiro valor de array", () => {
    expect(firstSearchParam(["/clients/x", "/oops"])).toBe("/clients/x");
  });
});

describe("parseNewMeetingSearchParams", () => {
  it("onboarding com returnTo válido", () => {
    expect(
      parseNewMeetingSearchParams({
        kind: "onboarding",
        returnTo: "/clients/78c99b9d-9281-48f5-8094-c9e7ddf872ea",
      }),
    ).toEqual({
      defaultKind: "onboarding",
      returnTo: "/clients/78c99b9d-9281-48f5-8094-c9e7ddf872ea",
    });
  });

  it("usa só o primeiro returnTo e rejeita prefixo inválido", () => {
    expect(
      parseNewMeetingSearchParams({
        kind: ["onboarding"],
        returnTo: ["https://evil.test", "/clients/ok"],
      }),
    ).toEqual({
      defaultKind: "onboarding",
    });
    expect(
      parseNewMeetingSearchParams({
        kind: "onboarding",
        returnTo: ["/clients/ok", "https://evil.test"],
      }),
    ).toEqual({
      defaultKind: "onboarding",
      returnTo: "/clients/ok",
    });
  });

  it("kind desconhecido cai em general", () => {
    expect(parseNewMeetingSearchParams({ kind: "hack" })).toEqual({
      defaultKind: "general",
      returnTo: undefined,
    });
  });
});
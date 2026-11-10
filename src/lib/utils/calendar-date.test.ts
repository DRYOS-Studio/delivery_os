import { describe, expect, it } from "vitest";
import {
  calendarDateFromValue,
  formatCalendarDateBR,
  isCalendarDate,
} from "@/lib/utils/calendar-date";

describe("calendar-date", () => {
  it("formata AAAA-MM-DD sem deslocar um dia (fuso)", () => {
    expect(formatCalendarDateBR("2026-10-26")).toBe("26/10/2026");
    expect(formatCalendarDateBR("2026-10-25")).toBe("25/10/2026");
  });

  it("extrai calendário de prefixo ISO", () => {
    expect(calendarDateFromValue("2026-10-26T15:00:00.000Z")).toBe("2026-10-26");
    expect(calendarDateFromValue("2026-10-26")).toBe("2026-10-26");
  });

  it("valida datas inválidas", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2024-02-29")).toBe(true);
  });
});

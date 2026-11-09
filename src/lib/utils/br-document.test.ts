import { describe, expect, it } from "vitest";
import { isValidCnpj, isValidCpf } from "@/lib/utils/br-document";

describe("isValidCpf", () => {
  it("accepts valid CPF", () => {
    expect(isValidCpf("15477850710")).toBe(true);
    expect(isValidCpf("71384308253")).toBe(true);
  });

  it("rejects invalid checksum", () => {
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("12345678901")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("accepts valid CNPJ", () => {
    expect(isValidCnpj("36862199000104")).toBe(true);
  });

  it("rejects invalid checksum", () => {
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  getSiteOriginFromEnv,
  resolveSiteOrigin,
} from "@/lib/utils/site-origin";

describe("resolveSiteOrigin", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.exemplo.com/";
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    expect(resolveSiteOrigin("preview-xxx.vercel.app")).toBe(
      "https://app.exemplo.com",
    );
  });

  it("uses VERCEL_PROJECT_PRODUCTION_URL before request host", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "delivery-os-phi.vercel.app";
    process.env.VERCEL_URL = "preview-should-not-use.vercel.app";
    expect(resolveSiteOrigin("admin-preview.vercel.app")).toBe(
      "https://delivery-os-phi.vercel.app",
    );
  });

  it("falls back to request host when env vars unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(resolveSiteOrigin("delivery-os-phi.vercel.app")).toBe(
      "https://delivery-os-phi.vercel.app",
    );
  });

  it("never reads VERCEL_URL in getSiteOriginFromEnv", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.VERCEL_URL = "only-preview.vercel.app";
    expect(getSiteOriginFromEnv()).toBe("http://localhost:3000");
  });
});

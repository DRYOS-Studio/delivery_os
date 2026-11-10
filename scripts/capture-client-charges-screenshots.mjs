import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.CLIENT_CHARGES_SCREENSHOT_URL ?? "http://127.0.0.1:3099";
const OUT = "/opt/cursor/artifacts";

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/dev-screenshots/client-charges`, {
    waitUntil: "networkidle",
  });
  await page
    .locator('[data-testid="client-charges-section"]')
    .waitFor({ timeout: 120_000 });
  await page.screenshot({
    path: `${OUT}/client-charges-section.png`,
    fullPage: true,
  });
  await browser.close();
  console.log("Saved", `${OUT}/client-charges-section.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

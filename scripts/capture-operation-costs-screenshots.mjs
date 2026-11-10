import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE =
  process.env.OPERATION_COSTS_SCREENSHOT_URL ?? "http://127.0.0.1:3099";
const OUT = "/opt/cursor/artifacts";

const routes = [
  {
    path: "/dev-screenshots/operation-costs",
    file: "operation-costs-tab.png",
    ready: '[data-testid="operation-costs-section"]',
  },
  {
    path: "/dev-screenshots/operation-cost-form",
    file: "operation-cost-commission-form.png",
    ready: "#commission_percent",
  },
  {
    path: "/dev-screenshots/operation-edit",
    file: "operation-edit-form.png",
    ready: 'input[name="name"]',
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  for (const route of routes) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle" });
    await page.locator(route.ready).first().waitFor({ timeout: 120_000 });
    if (route.beforeShot) await route.beforeShot(page);
    await page.screenshot({ path: `${OUT}/${route.file}`, fullPage: true });
  }

  await browser.close();
  console.log("Saved screenshots to", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

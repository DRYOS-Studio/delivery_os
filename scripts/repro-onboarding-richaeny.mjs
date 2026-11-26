/**
 * Repro E2E (local): página do cliente + link Agendar onboarding.
 * Requer: `supabase start`, seed fixture, `.env.local`, app em BASE.
 *
 *   node scripts/repro-onboarding-richaeny.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CLIENT_ID = "78c99b9d-9281-48f5-8094-c9e7ddf872ea";
const OP_ID = "1a36d7fa-89d0-44e2-bd7a-01f689046477";

const clientPath = `/clients/${CLIENT_ID}`;
const meetingsNewPath = `/operations/${OP_ID}/meetings/new?kind=onboarding&returnTo=${encodeURIComponent(clientPath)}`;

function isErrorBoundary(text) {
  return text.includes("Algo deu errado");
}

async function capturePage(page, label, url) {
  const consoleLogs = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    pageErrors.push(String(err));
  });
  const res = await page.goto(`${BASE}${url}`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  const body = await page.locator("body").innerText();
  return {
    label,
    url,
    status: res?.status(),
    errorBoundary: isErrorBoundary(body),
    bodySnippet: body.slice(0, 500),
    consoleLogs,
    pageErrors,
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();

const results = [
  await capturePage(page, "client_visao", clientPath),
  await capturePage(page, "meetings_new_onboarding", meetingsNewPath),
];

await browser.close();

console.log(JSON.stringify({ base: BASE, results }, null, 2));

const failed = results.filter((r) => r.errorBoundary || r.pageErrors.length > 0);
process.exitCode = failed.length > 0 ? 1 : 0;
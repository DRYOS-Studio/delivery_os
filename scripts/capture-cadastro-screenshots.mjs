import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.CADASTRO_SCREENSHOT_URL ?? "http://127.0.0.1:3099/cadastro/dev-preview";
const OUT = "/opt/cursor/artifacts";

async function shot(page, name, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/${name}-${width}w.png`, fullPage: true });
}

const pageScript = `
async (step) => {
  const clickText = (t) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(t));
    btn?.click();
  };
  if (step === 'pf') clickText('Pessoa física');
  if (step === 'review') {
    clickText('Pessoa física');
    await new Promise((r) => setTimeout(r, 300));
    for (let i = 0; i < 5; i++) {
      clickText('Continuar');
      await new Promise((r) => setTimeout(r, 200));
    }
  }
};
`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.screenshot({
      path: `${OUT}/cadastro-wizard-step-type-${width}w.png`,
      fullPage: true,
    });

    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Pessoa física"),
      );
      btn?.click();
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUT}/cadastro-wizard-step1-qualification-${width}w.png`,
      fullPage: true,
    });

    await page.evaluate(async () => {
      const names = [
        "Maria Silva",
        "Médica",
        "15477850710",
        "maria@test.com",
      ];
      const inputs = [...document.querySelectorAll("input")];
      let i = 0;
      for (const inp of inputs) {
        if (inp.type === "email" && i < names.length) {
          await inp.fill(names[3] ?? "maria@test.com");
          continue;
        }
        if (i < 3 && inp.type !== "checkbox") {
          await inp.fill(names[i]);
          i++;
        }
      }
      const sel = document.querySelector("select");
      if (sel) sel.value = "Solteiro(a)";
    });
    for (let n = 0; n < 5; n++) {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) =>
          b.textContent?.includes("Continuar"),
        );
        btn?.click();
      });
      await page.waitForTimeout(350);
    }
    await page.screenshot({
      path: `${OUT}/cadastro-wizard-step-review-${width}w.png`,
      fullPage: true,
    });
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

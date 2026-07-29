import { chromium } from "@playwright/test";
import {
  discoverAndValidate,
} from "@sasysolutions1/playwright-selector-toolkit";

const url = process.env.TARGET_URL;
const seedSelector = process.env.TARGET_SELECTOR;

if (!url || !seedSelector) {
  throw new Error(
    "Set TARGET_URL and TARGET_SELECTOR for a page you are authorized to test.",
  );
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const report = await discoverAndValidate(page, seedSelector);
  console.log(
    JSON.stringify(
      {
        best: report.best,
        candidates: report.results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

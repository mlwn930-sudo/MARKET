import { expect, test } from "@playwright/test";

test("market-first entry, sources, discovery, and scroll continuity", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".primary-destinations a")).toHaveCount(6);
  expect((await page.locator(".index-rail").boundingBox())!.y).toBeLessThan(350);
  await expect(page.locator(".company-tile")).toHaveCount(6);
  await page.getByRole("button", { name: "Nasdaq 100", exact: true }).click();
  await expect(page.locator(".signal-quote")).toContainText("QQQ");
  await page.locator(".story-select button").nth(1).click();
  const headline = await page.locator(".story-select button").nth(1).locator("span").innerText();
  await expect(page.locator(".evidence-sheet h3")).toHaveText(headline);
  await page.locator("#context-step-2").scrollIntoViewIfNeeded();
  await expect(page.locator(".evidence-sheet")).toBeVisible();
  await expect(page.locator(".evidence-sheet a[target='_blank']")).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: "כל הכלים", exact: true }).click();
  for (const route of ["/macro", "/sectors", "/compare", "/institutional", "/chat", "/learn"]) {
    await expect(page.locator(`dialog a[href='${route}']`)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("mobile preserves early data, touch navigation, and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await page.locator(".index-rail").boundingBox())!.y).toBeLessThan(330);
    expect((await page.locator(".company-tile").first().boundingBox())!.y).toBeLessThan(650);
    await expect(page.locator(".primary-destinations a")).toHaveCount(6);
    await expect(page.locator(".evidence-space")).toHaveCSS("position", "relative");
    await page.locator(".story-select button").nth(2).click();
    await expect(page.locator(".story-select button").nth(2)).toHaveAttribute("aria-pressed", "true");
  }
});

import { expect, test } from "@playwright/test";

test("market-first entry, sources, discovery, and scroll continuity", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".primary-destinations a")).toHaveCount(5);
  expect((await page.locator(".index-rail").boundingBox())!.y).toBeLessThan(350);
  await expect(page.locator(".company-tile")).toHaveCount(7);
  await page.getByRole("button", { name: "Nasdaq 100", exact: true }).click();
  await expect(page.locator(".signal-quote")).toContainText("QQQ");
  await page.locator(".story-select button").nth(1).click();
  const headline = await page.locator(".story-select button").nth(1).locator("span").innerText();
  await expect(page.locator(".scene-object-panel h3").first()).toHaveText(headline);
  await page.locator(".scene-stops button").nth(2).click();
  await expect(page.locator(".scroll-scene")).toHaveAttribute("data-stage", "2");
  await expect(page.locator(".evidence-sheet")).toBeVisible();
  await expect(page.locator(".evidence-sheet a[target='_blank']")).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: "כל הכלים", exact: true }).click();
  for (const route of ["/macro", "/sectors", "/compare", "/institutional", "/chat", "/learn"]) {
    await expect(page.locator(`dialog a[href='${route}']`).first()).toBeVisible();
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
    await expect(page.locator(".primary-destinations a")).toHaveCount(5);
    await expect(page.locator(".scroll-scene")).not.toHaveAttribute("data-pinned", "true");
    await page.locator(".index-tile").nth(1).click();
    await expect(page.locator(".signal-quote")).toContainText("QQQ");
    await page.locator(".workspace-switch button").filter({ hasText: "חדשות" }).click();
    await expect(page.locator(".now-news")).toBeVisible();
    await page.locator(".story-select button").nth(2).click();
    await expect(page.locator(".story-select button").nth(2)).toHaveAttribute("aria-pressed", "true");
    await page.locator(".scene-stops button").nth(2).click();
    await expect(page.locator("#context-step-2")).toBeVisible();
    await expect(page.locator("#context-step-0")).not.toBeVisible();
  }
});

test("the pinned dossier changes depth while its viewport remains stable", async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("/");
  const scene=page.locator(".scroll-scene");
  await expect(scene).toHaveAttribute("data-pinned","true");
  const start=await scene.evaluate(e=>e.getBoundingClientRect().top+scrollY-125);
  await page.evaluate(y=>scrollTo(0,y),start+20);
  await expect(scene).toHaveAttribute("data-stage","0");
  await page.locator(".scene-stops button").nth(1).click();
  await expect(scene).toHaveAttribute("data-stage","1");
  await expect.poll(()=>page.locator(".scene-object").evaluate(e=>getComputedStyle(e).transform)).toContain("matrix3d");
  expect(Math.abs((await page.locator(".scene-viewport").boundingBox())!.y-125)).toBeLessThan(3);
  await page.locator(".scene-stops button").nth(2).click();
  await expect(scene).toHaveAttribute("data-stage","2");
  await expect(page.locator("#context-step-0")).toHaveAttribute("inert", "");
});

test("homepage research layers stay readable without JavaScript",async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  const page=await context.newPage();
  await page.goto((process.env.MARKET_TEST_URL||"http://127.0.0.1:3000")+"/");
  await expect(page.locator(".company-tile").first()).toBeVisible();
  for(const panel of await page.locator(".scene-reading").all())await expect(panel).toBeVisible();
  await context.close();
});

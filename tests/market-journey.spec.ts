import { expect, test } from "@playwright/test";

test("scenario → personal thesis → persistent watchlist", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/launch/ttwo");
  await page.getByRole("button", { name: "היקף רחב", exact: true }).click();
  await expect(page.locator(".scenario-total")).toHaveText("$2.40B");
  await page.locator("#scenario-units").fill("30");
  await expect(page.locator(".scenario-total")).toHaveText("$1.80B");
  const thesis = "הצמיחה צריכה להתבטא בתזרים חופשי ובשיפור ברווחיות.";
  await page.getByLabel("התזה שלי", { exact: true }).fill(thesis);
  await page.getByLabel("מה ישנה את דעתי", { exact: true }).fill("דחייה נוספת ללא שיפור בתזרים תשנה את ההנחה שלי.");
  await page.getByRole("button", { name: "לשמור תזה ולהוסיף למעקב" }).click();
  await expect(page.locator(".notebook-status")).toContainText("נשמרה");
  await page.reload();
  await expect(page.getByLabel("התזה שלי", { exact: true })).toHaveValue(thesis);
  await page.goto("/watchlist");
  await expect(page.locator(".saved-thesis")).toContainText(thesis);
  expect(errors).toEqual([]);
});

test("navigation, mobile overflow, and reduced motion", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "כל הכלים", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "כל הכלים", exact: true })).toBeFocused();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["/", "/launch/ttwo"]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await expect(page.locator(".story-track")).not.toHaveAttribute("data-enhanced", "true");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/launch/ttwo");
  await expect(page.locator(".story-track")).not.toHaveAttribute("data-enhanced", "true");
  for (const scene of await page.locator(".story-scene").all()) await expect(scene).toBeVisible();
});

test("storage denial never reports a successful save", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); }; });
  await page.goto("/launch/ttwo");
  await page.getByLabel("התזה שלי", { exact: true }).fill("זאת תזה לבדיקה של צמיחה ורווחיות.");
  await page.getByLabel("מה ישנה את דעתי", { exact: true }).fill("דחייה או שינוי בהנחיה יצריכו בדיקה מחדש.");
  await page.getByRole("button", { name: "לשמור תזה ולהוסיף למעקב" }).click();
  await expect(page.locator(".notebook-status")).toContainText("לא מאפשר שמירה");
  await expect(page.getByLabel("התזה שלי", { exact: true })).toHaveValue("זאת תזה לבדיקה של צמיחה ורווחיות.");
});

test("story chapters remain readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto((process.env.MARKET_TEST_URL || "http://127.0.0.1:3000") + "/launch/ttwo");
  await expect(page.locator("h1")).toContainText("GTA");
  for (const scene of await page.locator(".story-scene").all()) await expect(scene).toBeVisible();
  await context.close();
});

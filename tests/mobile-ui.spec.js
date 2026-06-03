import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?v=playwright");
});

test("mobile shell keeps key navigation and date control tidy", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "总览" })).toBeVisible();
  await expect(page.locator(".nav-tabs")).toBeVisible();
  await expect(page.locator(".date-control")).toBeVisible();

  const dateBox = await page.locator(".date-control").boundingBox();
  expect(dateBox?.width).toBeGreaterThanOrEqual(80);
  expect(dateBox?.width).toBeLessThanOrEqual(100);

  await expectNoHorizontalOverflow(page);
});

test("history view stays within the mobile viewport", async ({ page }) => {
  await page.getByRole("button", { name: "历史" }).click();
  await expect(page.locator("#view-title")).toHaveText("历史");
  await expect(page.locator(".history-table-wrap")).toBeVisible();

  await expectNoHorizontalOverflow(page);
});

test("trend chart renders in a stable mobile frame", async ({ page }) => {
  await page.getByRole("button", { name: "趋势" }).click();
  await expect(page.locator("#view-title")).toHaveText("趋势");
  await expect(page.locator(".chart-shell")).toBeVisible();

  const chartBox = await page.locator("#weight-chart").boundingBox();
  expect(chartBox?.width).toBeGreaterThan(280);
  expect(chartBox?.height).toBeGreaterThanOrEqual(250);
  expect(chartBox?.height).toBeLessThanOrEqual(270);

  await expectNoHorizontalOverflow(page);
});

test("meal logging reveals nutrition fields only after analysis", async ({ page }) => {
  await page.getByRole("button", { name: "记录" }).click();
  await expect(page.locator("#macro-editor")).toBeHidden();
  await expect(page.locator("#food-photo")).toHaveAttribute("multiple", "");

  await page.locator("#meal-text").fill("午餐：鸡胸肉150g 米饭200g");
  await page.getByRole("button", { name: "分析餐食" }).click();

  await expect(page.locator("#macro-editor")).toBeVisible();
  await expect(page.locator("#calories-input")).toBeVisible();
  await expect(page.getByText("识别到的食物")).toBeVisible();
  await expect(page.getByRole("button", { name: "确认并保存餐食" })).toBeVisible();

  await expectNoHorizontalOverflow(page);
});

test("meal logging accepts multiple photos from the picker", async ({ page }) => {
  await page.getByRole("button", { name: "记录" }).click();
  await page.locator("#food-photo").setInputFiles([
    {
      name: "meal-1.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64")
    },
    {
      name: "meal-2.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64")
    }
  ]);

  await expect(page.locator("#photo-preview img")).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
});

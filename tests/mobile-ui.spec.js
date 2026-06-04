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
  const analysisRequests = [];
  await page.route("**/api/analyze-meal-text", async (route) => {
    const payload = route.request().postDataJSON();
    analysisRequests.push(payload);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        text: "午餐：鸡胸肉150g 米饭200g",
        foods: ["鸡胸肉 150g", "米饭 200g"],
        items: [
          { name: "鸡胸肉", amount: "150g", calories: 248, protein: 46.5, carbs: 0, fat: 5.4 },
          { name: "米饭", amount: "200g", calories: 232, protein: 4.4, carbs: 50.4, fat: 0.4 }
        ],
        calories: 480,
        protein: 50.9,
        carbs: 50.4,
        fat: 5.8,
        fiber: 0,
        sodium: 0,
        potassium: 0,
        calcium: 0,
        iron: 0,
        source: "ai",
        warning: "",
        message: payload.correction
          ? `已采纳：${payload.correction}`
          : "请确认食物和份量。"
      })
    });
  });

  await page.getByRole("button", { name: "记录", exact: true }).click();
  await expect(page.locator("#macro-editor")).toHaveCount(0);
  await expect(page.locator("#food-photo")).toHaveAttribute("multiple", "");

  await page.locator("#meal-text").fill("午餐：鸡胸肉150g 米饭200g");
  await page.getByRole("button", { name: "分析餐食" }).click();

  await expect(page.getByText("正在分析餐食")).toBeVisible();
  await expect(page.getByRole("button", { name: "分析餐食" })).toBeDisabled();
  await expect(page.locator("#calories-input")).toHaveCount(0);
  await expect(page.getByText("识别到的食物")).toBeVisible();
  await page.locator('[data-adjustment="calories"]').fill("520");
  await page.locator('[data-adjustment="calories"]').blur();
  await expect(page.locator('[data-adjustment="calories"]')).toHaveValue("520");
  await expect(page.getByRole("button", { name: "重新开始" })).toBeVisible();
  await expect(page.getByRole("button", { name: "确认并保存餐食" })).toBeVisible();

  await page.locator("#correction-input").fill("只有一个汉堡");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("已采纳：只有一个汉堡")).toBeVisible();

  await page.locator("#correction-input").fill("碳水只有15g");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("已采纳：只有一个汉堡")).toBeVisible();
  await expect(page.getByText("碳水只有15g")).toBeVisible();
  expect(analysisRequests.at(-1)?.correction).toContain("只有一个汉堡");
  expect(analysisRequests.at(-1)?.correction).toContain("碳水只有15g");

  await expectNoHorizontalOverflow(page);
});

test("meal logging accepts multiple photos from the picker", async ({ page }) => {
  await page.getByRole("button", { name: "记录", exact: true }).click();
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

test("a saved meal can be reopened in the editor and overwritten", async ({ page }) => {
  // Keep the test independent of any server-persisted state.
  await page.route("**/api/state", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
    } else {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
    }
  });
  await page.route("**/api/analyze-meal-text", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        text: "午餐：鸡胸肉150g",
        foods: ["鸡胸肉 150g"],
        items: [{ name: "鸡胸肉", amount: "150g", calories: 248, protein: 46.5, carbs: 0, fat: 5.4 }],
        calories: 480,
        protein: 50.9,
        carbs: 50.4,
        fat: 5.8,
        fiber: 0,
        sodium: 0,
        potassium: 0,
        calcium: 0,
        iron: 0,
        source: "ai",
        warning: "",
        message: "请确认食物和份量。"
      })
    });
  });

  // Start from a clean slate: the beforeEach navigation already hydrated
  // any server state into localStorage before these routes existed, so
  // wipe storage and reload with the mocked (empty) server in place.
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?v=playwright");

  // Create and save a meal.
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await page.locator("#meal-text").fill("午餐：鸡胸肉150g");
  await page.getByRole("button", { name: "分析餐食" }).click();
  await expect(page.locator('[data-adjustment="calories"]')).toHaveValue("480");
  await page.getByRole("button", { name: "确认并保存餐食" }).click();

  const meal = page.locator("#meal-list .meal-item");
  await expect(meal).toHaveCount(1);
  await expect(meal.locator(".meal-meta")).toContainText("480 kcal");

  // Reopen it in the editor.
  await meal.getByRole("button", { name: "编辑记录" }).click();
  await expect(page.getByText("正在编辑已保存的餐食")).toBeVisible();
  await expect(page.locator("#meal-text")).toHaveValue("午餐：鸡胸肉150g");
  await expect(page.locator('[data-adjustment="calories"]')).toHaveValue("480");
  const saveEdit = page.getByRole("button", { name: "保存修改" });
  await expect(saveEdit).toBeVisible();

  // Edit a macro and save — it overwrites instead of adding a duplicate.
  await page.locator('[data-adjustment="calories"]').fill("600");
  await page.locator('[data-adjustment="calories"]').blur();
  await saveEdit.click();

  await expect(page.locator("#meal-list .meal-item")).toHaveCount(1);
  await expect(page.locator("#meal-list .meal-meta")).toContainText("600 kcal");
  await expectNoHorizontalOverflow(page);
});

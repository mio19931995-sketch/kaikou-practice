import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 1440, height: 1000 } });
test("desktop workspace uses the full window and preserves navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "桌面导航" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "今天，也向前一步。" }),
  ).toBeVisible();
  await expect(page.locator(".desk-mode")).toHaveCount(3);
  expect(
    await page.locator(".desktop-shell").evaluate((e) => e.clientWidth),
  ).toBeGreaterThan(950);
  await page.screenshot({
    path: ".reference-analysis/desktop-workspace.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "逻辑表达", exact: true }).click();
  await page.getByRole("button", { name: /结构库/ }).click();
  await page.getByRole("button", { name: "PREP 模型", exact: true }).click();
  await page.getByRole("button", { name: "用这个结构练一题" }).click();
  await expect(page.locator(".practice-guide")).toContainText("PREP 模型");
  await page.screenshot({
    path: ".reference-analysis/desktop-practice.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "复述素材", exact: true }).click();
  await expect(page.locator(".material-card")).toHaveCount(6);
  await page.getByRole("link", { name: "21 天开口计划", exact: true }).click();
  await expect(page.locator(".journey-node")).toHaveCount(21);
  await page.screenshot({
    path: ".reference-analysis/desktop-plan.png",
    fullPage: true,
  });
});
test("sidebar navigation protects an unsaved practice", async ({ page }) => {
  await page.goto("/#/practice/improv");
  await page.getByRole("button", { name: "也可以用文字练习" }).click();
  await page.getByLabel("我的表达").fill("这是一段还没有保存的练习内容。");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "练习概览", exact: true }).click();
  await expect(page.getByLabel("我的表达")).toHaveValue(
    "这是一段还没有保存的练习内容。",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "练习概览", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "今天，也向前一步。" }),
  ).toBeVisible();
});
test("minimum desktop window and large monitor fit all workspaces", async ({
  page,
}) => {
  for (const width of [1080, 1280, 1920]) {
    await page.setViewportSize({ width, height: width === 1080 ? 680 : 900 });
    for (const route of [
      "/",
      "/#/logic",
      "/#/practice/improv",
      "/#/library",
      "/#/plan",
      "/#/history",
      "/#/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator(".sidebar-settings")).toBeInViewport({ ratio: 1 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const content = await page.locator(".app-shell").boundingBox();
      expect(content!.x).toBeGreaterThanOrEqual(200);
    }
  }
});


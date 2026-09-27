import { test, expect } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`independent framework learning and local notebook at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/");
    await page.getByRole("link", { name: "思维框架", exact: true }).click();
    await expect(page.locator(".thinking-card")).toHaveCount(12);
    await page.getByRole("button", { name: "做出选择", exact: true }).click();
    await expect(page.locator(".thinking-card")).toHaveCount(3);
    await page.getByLabel("搜索思维框架").fill("机会成本");
    await expect(page.locator(".thinking-card")).toHaveCount(1);
    await page
      .getByRole("button", { name: "收藏机会成本", exact: true })
      .click();
    await page.locator(".thinking-card a").click();
    await expect(
      page.getByRole("heading", { name: "机会成本", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "什么时候用" }),
    ).toBeVisible();
    await page
      .getByLabel("我的问题与下一步")
      .fill("比较修复故障与开发新功能；先确认用户影响。");
    await page.getByRole("button", { name: "保存笔记", exact: true }).click();
    await expect(page.getByText("已保存到本机", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("我的问题与下一步")).toHaveValue(
      "比较修复故障与开发新功能；先确认用户影响。",
    );
    await expect(
      page.getByRole("button", { name: "已收藏", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.reference-analysis/thinking-detail-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "← 全部思维框架" }).click();
    await page.getByRole("button", { name: "我的收藏 1" }).click();
    await expect(page.locator(".thinking-card")).toHaveCount(1);
    await page.getByRole("button", { name: "取消收藏机会成本" }).click();
    await expect(page.getByText("没有符合条件的收藏")).toBeVisible();
    await page.getByRole("button", { name: "查看全部框架" }).click();
    await page.screenshot({
      path: `.reference-analysis/thinking-library-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("storage failure keeps the note and does not report a successful save", async ({
  page,
}) => {
  await page.goto("/#/thinking?model=inversion");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.getByLabel("我的问题与下一步").fill("重要笔记不能丢失");
  await page.getByRole("button", { name: "保存笔记", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("未能保存到本机");
  await expect(page.getByLabel("我的问题与下一步")).toHaveValue(
    "重要笔记不能丢失",
  );
  await expect(page.getByText("已保存到本机", { exact: true })).toHaveCount(0);
});

test("unsaved notes warn before leaving through application navigation", async ({ page }) => {
  await page.goto("/#/thinking?model=inversion");
  await page.getByLabel("我的问题与下一步").fill("尚未保存的思考");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("link", { name: "首页", exact: true }).click();
  await expect(page).toHaveURL(/model=inversion/);
  await expect(page.getByLabel("我的问题与下一步")).toHaveValue("尚未保存的思考");
  await page.getByRole("button", { name: "保存笔记", exact: true }).click();
  await page.getByRole("link", { name: "首页", exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
});

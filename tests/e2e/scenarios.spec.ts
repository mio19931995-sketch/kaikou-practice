import { test, expect } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`scenario selection carries task and structure into practice at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/logic");
    await expect(
      page.getByRole("button", { name: "按场景练习", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "向上求助", exact: true }).click();
    await expect(page.locator(".scene-recommendation")).toContainText(
      "首选结构 · 向上求助",
    );
    await page.getByRole("button", { name: "切换到SCQA 模型" }).click();
    await expect(page.locator(".scene-recommendation")).toContainText(
      "备选结构",
    );
    await page.getByRole("button", { name: "切换到向上求助" }).click();
    await page.screenshot({
      path: `.reference-analysis/scenes-${width}.png`,
      fullPage: false,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "开始这个场景的练习" }).click();
    await expect(page).toHaveURL(/framework=HELP&scene=help/);
    await expect(page.locator(".question-card")).toContainText("跨部门依赖");
    await page.getByRole("button", { name: "换一题", exact: true }).click();
    await expect(page.locator(".question-card")).toContainText("资源不足");
    await page.reload();
    await expect(page.locator(".mini-steps")).toContainText("需要支持");
    await page.getByRole("button", { name: "也可以用文字练习" }).click();
    await page
      .getByLabel("我的表达")
      .fill(
        "测试环境还未开通，可能影响周五交付。我已经提交申请并联系维护人员，希望主管帮助确认审批时间。",
      );
    await page.getByRole("button", { name: "查看基础反馈" }).click();
    await expect(
      page.getByText("已保存到练习记录", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "查看练习记录" }).click();
    await expect(page.locator(".history-card")).toContainText("跨部门依赖");
  });
}


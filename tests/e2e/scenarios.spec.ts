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

test("video-derived frameworks can be selected and used in a practice", async ({
  page,
}) => {
  await page.goto("/#/logic");
  for (const [scene, framework] of [
    ["临时被点名发言", "SPARK 即兴发言"],
    ["推动一项有阻力的改变", "RIDE 说服"],
    ["先听懂有分歧的同事", "LEAPS 倾听对话"],
    ["把不满说成建设性请求", "OFND 建设性对话"],
    ["面对批评先把事实讲清", "FIRE 事实沟通"],
    ["完整讲述一项改进方案", "SCRTV 方案叙述"],
    ["解释一个新项目为何值得做", "黄金圈表达"],
    ["用半分钟介绍一个想法", "电梯沟通"],
    ["把模糊需求问清楚", "沟通黄金三步"],
  ]) {
    await page.getByRole("button", { name: scene, exact: true }).click();
    await expect(page.locator(".scene-recommendation")).toContainText(
      framework,
    );
    expect(await page.locator(".example-row").count()).toBe(
      await page.locator(".structure-steps span").count(),
    );
  }
  await page.getByRole("button", { name: "临时被点名发言" }).click();
  await page.getByRole("button", { name: "开始这个场景的练习" }).click();
  await expect(page).toHaveURL(/framework=SPARK&scene=impromptu_meeting/);
  await expect(page.locator(".mini-steps")).toContainText("抓住观点");
  await page.getByRole("button", { name: "也可以用文字练习" }).click();
  await expect(
    page.getByRole("button", { name: "生成 AI 点评", exact: true }),
  ).toBeVisible();
});


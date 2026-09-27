import { test, expect } from "@playwright/test";
import { thinkingModels } from "../../src/thinkingData";
import { thinkingLessons } from "../../src/thinkingLessons";

test("all frameworks contain a full lesson with an interactive explanation", async ({ page }) => {
  // 12 课依次展开三个折叠区并平滑滚动，单个用例需要更长时间
  test.setTimeout(120000);
  for (const model of thinkingModels) {
    const lesson = thinkingLessons[model.id];
    expect(lesson, model.id).toBeTruthy();
    await page.goto(`/#/thinking?model=${model.id}`);
    // v0.9：深度内容默认折叠，通过本课目录展开
    await page.getByRole("button", { name: "案例拆解", exact: true }).click();
    await expect(page.getByRole("heading", { name: lesson.caseTitle, exact: true })).toBeVisible();
    await expect(page.locator(".lesson-walkthrough li")).toHaveCount(4);
    await page.getByRole("button", { name: "看图理解", exact: true }).click();
    await page.locator(".visual-node").last().click();
    await expect(page.locator("#lesson-node-explanation")).toContainText(lesson.nodes.at(-1)![1]);
    await page.getByRole("button", { name: "检验理解", exact: true }).click();
    await page.locator(".lesson-options button").nth((lesson.quiz.correct + 1) % 3).click();
    await expect(page.locator(".lesson-answer")).toContainText("再想一步");
    await page.locator(".lesson-options button").nth(lesson.quiz.correct).click();
    await expect(page.locator(".lesson-answer")).toContainText("理解到位");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

for (const width of [390, 1280]) {
  test(`diagram layouts remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ["pyramid", "feedback", "six-hats", "bottleneck", "opportunity"]) {
      await page.goto(`/#/thinking?model=${id}`);
      await page.getByRole("button", { name: "看图理解", exact: true }).click();
      await expect(page.locator(".lesson-figure")).toBeVisible();
      await page.locator(".visual-node").last().click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `.reference-analysis/lesson-${id}-${width}.png` });
    }
  });
}

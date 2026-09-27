import { test, expect } from "@playwright/test";
import { thinkingModels } from "../../src/thinkingData";
import { thinkingPractice } from "../../src/thinkingPractice";

for (const model of thinkingModels) {
  test(`${model.id}: daily case, task, revealable solution and source`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const practice = thinkingPractice[model.id];
    expect(practice, model.id).toBeTruthy();
    await page.goto(`/#/thinking?model=${model.id}`);
    await expect(page.locator(".lesson-outcome")).toContainText(
      practice.outcome,
    );
    await page.getByRole("button", { name: "生活案例", exact: true }).click();
    await expect(page.locator("#lesson-everyday h2")).toHaveText(
      practice.everyday.title,
    );
    await expect(page.locator(".everyday-steps > div")).toHaveCount(4);
    await page.getByRole("button", { name: "动手练习", exact: true }).click();
    await expect(page.locator(".practice-task")).toContainText(practice.task);
    await expect(page.locator(".practice-solution p")).not.toBeVisible();
    await page.locator(".practice-solution summary").click();
    await expect(page.locator(".practice-solution p")).toHaveText(
      practice.solution,
    );
    await expect(page.locator("#lesson-sources a")).toHaveCount(
      practice.sources.length,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const width of [390, 1280]) {
  test(`template preserves notes and survives save and restart at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/thinking?model=batna");
    const note = page.getByLabel("我的问题与下一步");
    await note.fill("已有的思考不能被覆盖");
    await page.getByRole("button", { name: "将本课模板加入笔记" }).click();
    await expect(note).toBeFocused();
    const expected =
      "已有的思考不能被覆盖\n\n【本课应用模板】\n" +
      thinkingPractice.batna.template.join("\n") +
      "\n";
    await expect(note).toHaveValue(expected);
    await expect(page.locator(".thinking-note-status")).toContainText(
      "填写后请保存",
    );
    await page.getByRole("button", { name: "保存笔记", exact: true }).click();
    await page.reload();
    await expect(note).toHaveValue(expected);
    await page.getByRole("button", { name: "动手练习", exact: true }).click();
    await page.locator(".practice-solution summary").click();
    await page.screenshot({
      path: `.reference-analysis/practice-batna-${width}.png`,
    });
    await page.getByRole("button", { name: "去笔记里作答" }).click();
    await expect(note).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("template refuses overflow without truncating an existing draft", async ({
  page,
}) => {
  await page.goto("/#/thinking?model=sbi");
  const original = "保".repeat(5990);
  await page.getByLabel("我的问题与下一步").fill(original);
  await page.getByRole("button", { name: "将本课模板加入笔记" }).click();
  await expect(page.getByLabel("我的问题与下一步")).toHaveValue(original);
  await expect(page.locator(".thinking-note-status")).toContainText(
    "模板尚未加入",
  );
});

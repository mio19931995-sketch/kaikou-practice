import { test, expect } from "@playwright/test";
const speech =
  "我建议每周安排一次没有会议的上午。因为完整时间有助于集中精力。例如上周我关掉消息提醒，一上午就完成了一份复杂方案。所以可以先试行两周，再听听大家的反馈。";
test("mobile home, categories and framework selection are usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /把想法，\s*说清楚。/ }),
  ).toBeVisible();
  await page.screenshot({
    path: ".reference-analysis/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "逻辑表达", exact: false }).click();
  await page.getByRole("button", { name: /结构库/ }).click();
  await page.getByRole("button", { name: "PREP 模型", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "先亮观点，再给理由" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "用这个结构练一题" }).click();
  await expect(page.getByText("PREP 模型 · 先亮观点，再给理由")).toBeVisible();
  await page.screenshot({
    path: ".reference-analysis/practice-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("text practice produces honest feedback, persists after reload and deletes", async ({
  page,
}) => {
  await page.goto("/#/practice/logic?framework=PREP");
  await page.getByRole("button", { name: "也可以用文字练习" }).click();
  await page.getByRole("button", { name: "查看基础反馈" }).click();
  await expect(page.getByRole('alert')).toContainText('至少 5 个字');
  await expect(page.getByLabel('我的表达')).toBeFocused();
  await page.getByLabel("我的表达").fill(speech);
  await page.getByRole("button", { name: "查看基础反馈" }).click();
  await expect(page.getByText("基础反馈 · 非 AI 点评")).toBeVisible();
  await expect(
    page.getByText("已保存到练习记录", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: ".reference-analysis/feedback-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "查看练习记录" }).click();
  await page.reload();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await page.locator(".history-card").click();
  await expect(page.getByText(speech, { exact: true })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "删除这条记录" }).click();
  await expect(
    page.getByRole("heading", { name: "第一条记录，等你开口" }),
  ).toBeVisible();
});
test("real MediaRecorder pipeline records fake-device audio, stores and plays it after reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/practice/improv");
  const checkbox = page.getByRole("checkbox");
  if (await checkbox.count()) await checkbox.uncheck();
  await page.getByRole("button", { name: "开始表达", exact: true }).click();
  await expect(page.getByRole("button", { name: "结束录音" })).toBeVisible({
    timeout: 10000,
  });
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: "结束录音" }).click();
  await expect(page.locator("audio")).toBeVisible();
  const playable = await page
    .locator("audio")
    .evaluate(async (element: HTMLAudioElement) => {
      await element.play();
      return !element.paused;
    });
  expect(playable).toBe(true);
  await page.getByRole("button", { name: "仅保存练习" }).click();
  await page.reload();
  await page.locator(".history-card").click();
  await expect(page.locator("audio")).toBeVisible();
  expect(
    await page.locator("audio").evaluate(async (element: HTMLAudioElement) => {
      await element.play();
      return !element.paused;
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("course completion derives from a saved practice and survives reload", async ({
  page,
}) => {
  await page.goto("/#/lesson/4");
  await page.getByRole("button", { name: "开始今天的练习" }).click();
  await page.getByRole("button", { name: "也可以用文字练习" }).click();
  await page.getByLabel("我的表达").fill(speech);
  await page.getByRole("button", { name: "仅保存练习" }).click();
  await page.goto("/#/plan");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "第 4 天 先说重点，已完成" }),
  ).toBeVisible();
  await expect(page.locator(".plan-stats")).toContainText("1 / 21");
});
test("retelling reference, random words and empty history filters", async ({
  page,
}) => {
  await page.goto("/#/library?category=职场表达");
  await expect(page.locator(".material-card")).toHaveCount(2);
  await page.locator(".material-card").first().click();
  await expect(page.locator(".reading-card")).toContainText("共享文档");
  await page.goto("/#/practice/improv");
  await page.getByRole("button", { name: "随机词语", exact: true }).click();
  await page.getByLabel("词语数量").selectOption("3");
  await expect(page.locator(".word-card>span")).toHaveCount(3);
  await page.getByLabel("词语分类").selectOption("职场");
  await expect(page.locator(".word-card>span")).toHaveCount(3);
  await page.goto("/#/history");
  await page.getByRole("button", { name: "复述表达", exact: true }).click();
  await expect(page.locator(".empty-state")).toBeVisible();
});
test("permission denial has an actionable fallback and no invented transcript", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.goto("/#/practice/improv");
  await page.getByRole("button", { name: "开始表达", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("麦克风权限未开启");
  await page.getByRole("button", { name: "也可以用文字练习" }).click();
  await expect(page.getByLabel("我的表达")).toHaveValue("");
});
test("AI errors keep the draft and never render a successful report", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { ai: true, asr: false } }),
  );
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "AI 服务暂时不可用，请稍后重试。" },
    }),
  );
  await page.goto("/#/practice/improv");
  await page.getByRole("button", { name: "也可以用文字练习" }).click();
  await page.getByLabel("我的表达").fill(speech);
  await page.getByRole("button", { name: "生成 AI 点评" }).click();
  await expect(page.getByRole("alert")).toContainText("AI 服务暂时不可用");
  await expect(page.getByLabel("我的表达")).toHaveValue(speech);
  await expect(page.locator(".report")).toHaveCount(0);
});
test("small phone, landscape and desktop layouts do not overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const size of [
    { width: 375, height: 667 },
    { width: 844, height: 390 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    for (const route of ["/", "/#/logic", "/#/plan", "/#/settings"]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.goto("/");
  await page.screenshot({
    path: ".reference-analysis/home-desktop.png",
    fullPage: true,
  });
});


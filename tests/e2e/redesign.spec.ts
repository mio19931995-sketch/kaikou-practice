import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";

const draft =
  "我建议先确认会议目标，再分享背景，最后明确由谁在什么时候完成下一步。";
const primaryItems = [
  { name: "今日练习", path: "/" },
  { name: "开口训练", path: "/practice/improv" },
  { name: "方法学习", path: "/thinking" },
  { name: "我的练习", path: "/history" },
];

// These are deliberately local fixtures. Redesign QA must never call a paid AI
// or transcription service, even on a developer machine with services enabled.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { ai: false, asr: false } }),
  );
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        source: "basic",
        summary: "这是本地测试基础反馈，不是 AI 点评。",
        dimensions: [],
        improvements: ["补充一个具体例子。"],
        rewrite: "",
        metrics: { characters: draft.length, duration: 0, fillers: 0 },
      },
    }),
  );
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ status: 503, json: { error: "测试未启用转写服务。" } }),
  );
});

async function readRecords(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("kaikou-practice", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<
      Array<{ id: string; transcript: string; duration: number }>
    >((resolve, reject) => {
      const request = db
        .transaction("sessions")
        .objectStore("sessions")
        .getAll();
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  });
}

for (const width of [390, 1440]) {
  test(`four primary destinations remain distinct and usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const item of primaryItems) {
      await page.goto("/#/");
      const navigation = page.getByRole("navigation", {
        name: width >= 1000 ? "桌面导航" : "主导航",
        exact: true,
      });
      await expect(navigation).toBeVisible();
      for (const expected of primaryItems) {
        await expect(
          navigation.getByRole("link", { name: expected.name, exact: true }),
        ).toHaveAttribute("href", `#${expected.path}`);
      }
      await navigation
        .getByRole("link", { name: item.name, exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`#${item.path.replaceAll("/", "\\/")}$`),
      );
      await expect(page.locator("main")).toBeVisible();
      await page.reload();
      await expect(page.locator("main")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    expect(errors).toEqual([]);
  });

  test(`empty history has no invented progress and settings remain reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/history");
    await expect(page.locator(".history-card")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "第一条记录，等你开口" }),
    ).toBeVisible();
    expect(await readRecords(page)).toEqual([]);
    await page.getByRole("button", { name: "复述练习", exact: true }).click();
    await expect(page.locator(".history-card")).toHaveCount(0);
    await expect(page.locator(".empty-state")).toBeVisible();
    await page.goto("/#/");
    if (width >= 1000) {
      await page.locator(".sidebar-settings").click();
    } else {
      await page
        .getByRole("link", { name: "设置与服务状态", exact: true })
        .click();
    }
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(
      page.getByRole("button", { name: "导出文字记录（不含音频）" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "重新检查服务" }).click();
    await expect(
      page.getByRole("button", { name: "重新检查服务" }),
    ).toBeEnabled();
    await expect(page.locator(".settings-section").first()).toContainText(
      "未启用",
    );
  });

  test(`cancel and repeat preserve or reset the intended unsaved draft at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/practice/improv");
    await page
      .getByRole("button", { name: "也可以用文字练习", exact: true })
      .click();
    await page.getByLabel("我的表达", { exact: true }).fill(draft);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await expect(page).toHaveURL(/#\/practice\/improv$/);
    await expect(page.getByLabel("我的表达", { exact: true })).toHaveValue(
      draft,
    );
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "重新练习", exact: true }).click();
    await expect(page.getByLabel("我的表达", { exact: true })).toHaveValue(
      draft,
    );
    expect(await readRecords(page)).toHaveLength(0);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "重新练习", exact: true }).click();
    await page
      .getByRole("button", { name: "也可以用文字练习", exact: true })
      .click();
    await expect(page.getByLabel("我的表达", { exact: true })).toHaveValue("");
    expect(await readRecords(page)).toHaveLength(0);
  });
}

test("saved history and exported data use real local records, and delete cancellation is safe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/practice/improv");
  await page
    .getByRole("button", { name: "也可以用文字练习", exact: true })
    .click();
  await page.getByLabel("我的表达", { exact: true }).fill(draft);
  await page.getByRole("button", { name: "仅保存练习", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  const [saved] = await readRecords(page);
  expect(saved.transcript).toBe(draft);
  await page.reload();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await page.locator(".history-card").click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "删除这条记录", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`record/${saved.id}$`));
  expect(await readRecords(page)).toHaveLength(1);
  await page.locator(".sidebar-settings").click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出文字记录（不含音频）", exact: true })
    .click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported).toHaveLength(1);
  expect(exported[0].id).toBe(saved.id);
  expect(exported[0].transcript).toBe(draft);
  expect(exported[0]).not.toHaveProperty("audio");
  await page.goto(`/#/record/${saved.id}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除这条记录", exact: true }).click();
  await expect(page.locator(".history-card")).toHaveCount(0);
  expect(await readRecords(page)).toEqual([]);
});

test("clean Back and Forward retain selected primary destination without duplicate navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/");
  const navigation = page.getByRole("navigation", {
    name: "桌面导航",
    exact: true,
  });
  await navigation.getByRole("link", { name: "方法学习", exact: true }).click();
  await expect(page).toHaveURL(/#\/thinking$/);
  await expect(
    navigation.getByRole("link", { name: "方法学习", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("link", { name: "方法学习", exact: true }).click();
  await navigation.getByRole("link", { name: "我的练习", exact: true }).click();
  await expect(page).toHaveURL(/#\/history$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/thinking$/);
  await expect(
    navigation.getByRole("link", { name: "方法学习", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/#\/thinking$/);
});

test("all retained routes and expression structures fit small and large viewports", async ({
  page,
}) => {
  for (const size of [
    { width: 375, height: 667 },
    { width: 844, height: 390 },
    { width: 1080, height: 680 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    for (const path of [
      "/",
      "/practice/improv",
      "/logic",
      "/library",
      "/thinking",
      "/structures",
      "/plan",
      "/history",
      "/settings",
    ]) {
      await page.goto(`/#${path}`);
      await expect(page.locator("main")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "这条路暂时走不到" }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} at ${size.width}px`,
      ).toBe(true);
      if (size.width >= 1000)
        await expect(page.locator(".sidebar-settings")).toBeInViewport({
          ratio: 1,
        });
    }
  }
});

import { test, expect } from "@playwright/test";
const first = "我建议提前分享会议材料，因为大家可以先了解背景。";
const second =
  "我建议由主持人在周三前分享会议材料，因为大家可以先了解背景，会上只讨论需要解决的问题。";
function report(text: string, improved = false) {
  return {
    source: "ai",
    provider: "agnes",
    model: "test-model",
    ruleVersion: "agnes-coach-1",
    ruleProfile: "general",
    profileName: "一般表达",
    summary: "观点明确，可以继续练习行动的具体程度。",
    dimensions: [
      {
        id: "structure",
        title: "结构与逻辑",
        standard: "交代观点与依据",
        status: improved ? "good" : "partial",
        evidence: [text],
        text: improved
          ? "已说明负责人与时间。"
          : "行动的负责人与时间尚未说明。",
        advice: "说明由谁在什么时候完成。",
      },
    ],
    improvements: ["说明由谁在什么时候完成。", "结尾收束观点。"],
    rewrite: "",
    metrics: { characters: text.length, duration: 0, fillers: 0 },
  };
}
async function records(page: any) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("kaikou-practice", 1);
      q.onsuccess = () => r(q.result);
    });
    return new Promise<any[]>((r) => {
      const q = db.transaction("sessions").objectStore("sessions").getAll();
      q.onsuccess = () => {
        db.close();
        r(q.result);
      };
    });
  });
}
for (const width of [390, 1280])
  test(`failed analysis, same-topic retry and honest comparison at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/status", (r) =>
      r.fulfill({ json: { ai: true, asr: false } }),
    );
    let calls = 0;
    const requests: any[] = [];
    await page.route("**/api/analyze", async (r) => {
      calls++;
      requests.push(r.request().postDataJSON());
      if (calls === 1) {
        await r.fulfill({
          status: 502,
          json: { error: "AI 返回的点评未通过完整性校验，请重试。" },
        });
        return;
      }
      const input = r.request().postDataJSON();
      await r.fulfill({
        json: {
          ...report(input.transcript, calls > 2),
          model: calls > 3 ? "another-model" : "test-model",
        },
      });
    });
    await page.goto("/#/practice/logic?framework=PREP");
    await page.getByRole("button", { name: "也可以用文字练习" }).click();
    await page.getByLabel("我的表达", { exact: true }).fill(first);
    await page
      .getByRole("button", { name: "生成 AI 点评", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("完整性");
    await expect(page.getByLabel("我的表达", { exact: true })).toHaveValue(
      first,
    );
    expect((await records(page))[0].transcript).toBe(first);
    await page
      .getByRole("button", { name: "重试 AI 点评", exact: true })
      .click();
    await expect(
      page.getByText("已保存到练习记录", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "针对这一点再练", exact: true })
      .click();
    await expect(page.getByText("同一道题，再试一次")).toBeVisible();
    await page.reload();
    await expect(page.getByText("同一道题，再试一次")).toBeVisible();
    await expect(page.locator(".question-card")).toContainText(
      requests[0].topic,
    );
    await page.getByRole("button", { name: "也可以用文字练习" }).click();
    await page.getByLabel("我的表达", { exact: true }).fill(second);
    await page
      .getByRole("button", { name: "生成 AI 点评", exact: true })
      .click();
    const comparison = page.getByLabel("修改前后对比");
    await expect(comparison).toContainText("需完善 → 已做到");
    await expect(comparison).toContainText(first);
    await expect(comparison).toContainText(second);
    await comparison.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `.reference-analysis/practice-loop-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(requests[2].topic).toBe(requests[0].topic);
    expect(requests[2].framework).toBe(requests[0].framework);
    const saved = await records(page);
    expect(saved).toHaveLength(2);
    expect(saved.find((s: any) => s.retryOf).previousAttempt.transcript).toBe(
      first,
    );
    expect(saved.find((s: any) => !s.retryOf).transcript).toBe(first);
    await page
      .getByRole("button", { name: "查看练习记录", exact: true })
      .click();
    await page.locator(".history-card").first().click();
    await expect(
      page.getByRole("button", { name: "针对这一点再练" }),
    ).toBeVisible();
    await expect(page.getByLabel("修改前后对比")).toContainText(
      "需完善 → 已做到",
    );
    await page
      .getByRole("button", { name: "重新生成 AI 点评", exact: true })
      .click();
    await expect(page.getByLabel("修改前后对比")).toContainText(
      "模型或检查标准不同",
    );
    await expect(page.getByLabel("修改前后对比")).not.toContainText(
      "需完善 → 已做到",
    );
  });

test("missing retry record never silently starts an unrelated question", async ({
  page,
}) => {
  await page.goto("/#/practice/logic?retry=missing-record");
  await expect(
    page.getByText("找不到上次练习，请从练习记录重新进入。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "开始表达", exact: true }),
  ).toHaveCount(0);
});

test("saved-record analysis failure retains edited words across restart", async ({
  page,
}) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { ai: true, asr: false } }),
  );
  await page.route("**/api/analyze", (r) =>
    r.fulfill({ status: 502, json: { error: "暂时无法连接，请重试。" } }),
  );
  await page.goto("/#/practice/improv");
  await page.getByRole("button", { name: "也可以用文字练习" }).click();
  await page.getByLabel("我的表达", { exact: true }).fill(first);
  await page.getByRole("button", { name: "仅保存练习" }).click();
  await page.locator(".history-card").click();
  await page.locator("#saved-transcript").fill(second);
  await page.getByRole("button", { name: "生成 AI 点评", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("请重试");
  await expect(
    page.getByRole("button", { name: "重试 AI 点评", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("#saved-transcript")).toHaveValue(second);
  expect(await records(page)).toHaveLength(1);
  await page.getByRole("button", { name: "同题重新练习", exact: true }).click();
  await expect(page.getByText("同一道题，再试一次")).toBeVisible();
});

test('feedback save failure stays unsaved and can save the received result without another AI call', async ({page}) => {
  await page.route('**/api/status', r => r.fulfill({json: {ai: true, asr: false}}));
  let calls = 0;
  await page.route('**/api/analyze', r => { calls++; return r.fulfill({json: report(first)}); });
  await page.goto('/#/practice/improv');
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; let count = 0; IDBObjectStore.prototype.put = function(...args: Parameters<typeof put>) { if (++count === 2) throw new Error('本机写入暂时失败'); return put.apply(this, args); }; });
  await page.getByRole('button', {name: '也可以用文字练习'}).click();
  await page.getByLabel('我的表达', {exact: true}).fill(first);
  await page.getByRole('button', {name: '生成 AI 点评', exact: true}).click();
  await expect(page.getByText('本次反馈尚未保存', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: '针对这一点再练'})).toBeDisabled();
  await expect(page.getByText('Agnes · 多维表达点评')).toBeVisible();
  await page.getByRole('button', {name: '保存本次练习', exact: true}).click();
  await expect(page.locator('.history-card')).toHaveCount(1);
  expect((await records(page))[0].feedback.source).toBe('ai');
  expect(calls).toBe(1);
});

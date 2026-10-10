import { test, expect, type Page, type Route } from "@playwright/test";

const original = "合成测试甲：提前准备可以节省沟通时间。";
const edited = "合成测试乙：先听清问题，再给出具体例子。";
const feedback = {
  source: "ai",
  summary: "合成点评成功",
  dimensions: [],
  improvements: ["补充例子"],
  rewrite: "",
  metrics: { characters: 20, duration: 0, fillers: 0 },
};

async function openPractice(page: Page, saved: boolean) {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { ai: false, asr: false } }),
  );
  await page.goto("/#/practice/improv");
  await page.getByRole("button", { name: "也可以用文字练习" }).click();
  await page.locator("#transcript").fill(original);
  if (saved) {
    await page.getByRole("button", { name: "仅保存练习" }).click();
    await page.locator(".history-card").click();
  }
  await expect(
    page.getByRole("button", { name: "生成 AI 点评", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "查看基础反馈", exact: true }),
  ).toBeVisible();
}

async function records(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any[]>((resolve, reject) => {
        const open = indexedDB.open("kaikou-practice", 1);
        open.onsuccess = () => {
          const db = open.result;
          const read = db
            .transaction("sessions")
            .objectStore("sessions")
            .getAll();
          read.onsuccess = () => {
            resolve(read.result);
            db.close();
          };
          read.onerror = () => reject(read.error);
        };
      }),
  );
}

for (const saved of [false, true]) {
  for (const interruption of ["edit", "leave", "repeat", "success"] as const) {
    test(`${saved ? "saved" : "fresh"} recovery owns its draft and lifecycle: ${interruption}`, async ({
      page,
    }) => {
      await openPractice(page, saved);
      const calls: { transcript: string; ai: string | undefined }[] = [];
      await page.route("**/api/analyze", (r) => {
        calls.push({
          transcript: r.request().postDataJSON().transcript,
          ai: r.request().headers()["x-kaikou-require-ai"],
        });
        return r.fulfill({ json: feedback });
      });
      const pending: Route[] = [];
      await page.route("**/api/status", (r) => {
        pending.push(r);
      });
      const generate = page.getByRole("button", {
        name: "生成 AI 点评",
        exact: true,
      });
      await generate.click();
      await expect.poll(() => pending.length).toBe(1);
      if (interruption === "edit") {
        await page
          .locator(saved ? "#saved-transcript" : "#transcript")
          .fill(edited);
      } else if (interruption === "leave") {
        page.on("dialog", (dialog) => dialog.accept());
        await page.evaluate(() => {
          location.hash = "#/";
        });
        await expect(
          page.locator(saved ? "#saved-transcript" : "#transcript"),
        ).toHaveCount(0);
      } else if (interruption === "repeat") {
        await generate.click();
        await expect.poll(() => pending.length).toBe(2);
        // Newest intent resolves first; the superseded check must never replay it.
        await pending[1].fulfill({ json: { ai: true, asr: false } });
        await expect(
          page.getByText("合成点评成功", { exact: true }).first(),
        ).toBeVisible();
      }
      await pending[0].fulfill({ json: { ai: true, asr: false } });
      if (interruption === "success") {
        await expect(
          page.getByText("合成点评成功", { exact: true }).first(),
        ).toBeVisible();
      }
      // Drain the status continuation and any IndexedDB tasks before negative assertions.
      await page.waitForTimeout(250);
      if (interruption === "edit" || interruption === "leave") {
        expect(calls).toEqual([]);
        const stored = await records(page);
        expect(stored).toHaveLength(saved ? 1 : 0);
        if (saved) expect(stored[0].transcript).toBe(original);
        if (interruption === "edit") {
          await expect(
            page.locator(saved ? "#saved-transcript" : "#transcript"),
          ).toHaveValue(edited);
          await generate.click();
          await expect.poll(() => pending.length).toBe(2);
          await pending[1].fulfill({ json: { ai: true, asr: false } });
          await expect(
            page.getByText("合成点评成功", { exact: true }).first(),
          ).toBeVisible();
          expect(calls).toEqual([{ transcript: edited, ai: "1" }]);
        }
      } else {
        expect(calls).toEqual([{ transcript: original, ai: "1" }]);
        const stored = await records(page);
        expect(stored).toHaveLength(1);
        expect(stored[0].feedback.source).toBe("ai");
      }
    });
  }
}

for (const saved of [false, true]) {
  test(`${saved ? "saved" : "fresh"} leaving while draft persistence completes never starts analysis`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const descriptor = Object.getOwnPropertyDescriptor(
        IDBTransaction.prototype,
        "oncomplete",
      )!;
      Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
        ...descriptor,
        set(handler) {
          descriptor.set!.call(
            this,
            function (this: IDBTransaction, event: Event) {
              const w = window as any;
              if (this.mode === "readwrite" && w.holdSaveCompletion) {
                w.releaseSaveCompletion = () => handler.call(this, event);
              } else handler.call(this, event);
            },
          );
        },
      });
    });
    await openPractice(page, saved);
    let calls = 0;
    await page.route("**/api/analyze", (r) => {
      calls++;
      return r.fulfill({ json: feedback });
    });
    await page.route("**/api/status", (r) =>
      r.fulfill({ json: { ai: true, asr: false } }),
    );
    await page.evaluate(() => {
      (window as any).holdSaveCompletion = true;
    });
    await page
      .getByRole("button", { name: "生成 AI 点评", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => Boolean((window as any).releaseSaveCompletion)),
      )
      .toBe(true);
    page.on("dialog", (dialog) => dialog.accept());
    await page.evaluate(() => {
      location.hash = "#/";
    });
    await expect(
      page.locator(saved ? "#saved-transcript" : "#transcript"),
    ).toHaveCount(0);
    await page.evaluate(() => {
      (window as any).releaseSaveCompletion();
    });
    await page.waitForTimeout(250);
    expect(calls).toBe(0);
  });
}

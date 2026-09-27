import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/status', route => route.fulfill({ json: { ai: false, asr: true, asrMode: 'local' } }));
  await page.route('**/api/transcribe', route => route.fulfill({ json: { text: '这是实际录音转写的测试文字，与准备的提纲不同。' } }));
});

for (const width of [390, 1280]) {
  test(`SBI task handoff and completion reflect a saved exercise at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/thinking?model=sbi');
    await page.getByRole('button', { name: '用这个框架说 60 秒', exact: true }).click();
    await expect(page).toHaveURL(/thinking=sbi/);
    await expect(page.locator('.question-card')).toContainText('正向反馈');
    await expect(page.locator('.mini-steps')).toContainText('行为');
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: '← 全部思维框架' }).click();
    await page.getByLabel('搜索思维框架').fill('SBI');
    await expect(page.locator('.thinking-card')).not.toContainText('已练');
    await page.locator('.thinking-card a').click();
    await page.getByRole('button', { name: '用这个框架说 60 秒', exact: true }).click();
    await page.getByLabel('表达时长').getByRole('button', { name: '90' }).click();
    await page.locator('.preparation-draft summary').click();
    await page.getByLabel('我的表达提纲').fill('今天聚会前你发了入口照片，我很快就找到了，谢谢你提前准备。');
    await page.screenshot({ path: `.reference-analysis/practice-upgrade-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '用这份提纲进行文字练习' }).click();
    await expect(page.getByLabel('我的表达')).toHaveValue(/入口照片/);
    await page.getByRole('button', { name: '仅保存练习', exact: true }).click();
    await page.goto('/#/thinking');
    await page.getByLabel('搜索思维框架').fill('SBI');
    await expect(page.locator('.thinking-card')).toContainText('已练');
    const records = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('kaikou-practice', 1); r.onsuccess = () => resolve(r.result); });
      return new Promise<any[]>(resolve => { const r = db.transaction('sessions').objectStore('sessions').getAll(); r.onsuccess = () => { db.close(); resolve(r.result); }; });
    });
    expect(records[0].thinkingModelId).toBe('sbi');
    expect(records[0].targetDuration).toBe(90);
    expect(records[0].duration).toBe(0);
    expect(records[0].preparationDraft).toContain('入口照片');
  });
}

for (const limit of [30, 90, 180]) {
  test(`recording respects ${limit}s and never submits preparation as transcript`, async ({ page }) => {
    await page.clock.install();
    await page.goto('/#/practice/logic?thinking=sbi');
    await page.getByLabel('表达时长').getByRole('button', { name: String(limit), exact: false }).click();
    await page.locator('.preparation-draft summary').click();
    await page.getByLabel('我的表达提纲').fill('这是一份准备提纲，不应该被当成说过的话。');
    await page.getByRole('button', { name: '开始表达', exact: true }).click();
    await expect(page.locator('.countdown-circle')).toBeVisible();
    await page.clock.runFor(3100);
    await expect(page.getByRole('button', { name: '结束录音', exact: true })).toBeVisible({ timeout: 15000 });
    await page.clock.fastForward((limit - 2) * 1000);
    await expect(page.getByRole('button', { name: '结束录音', exact: true })).toBeVisible();
    await page.clock.fastForward(3000);
    await expect(page.getByLabel('我的表达')).toHaveValue('这是实际录音转写的测试文字，与准备的提纲不同。', { timeout: 15000 });
    await expect(page.locator('audio')).toBeVisible();
  });
}

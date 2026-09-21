import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 1280, height: 720 } });
test('feedback action stays visible above the fold after recording or text practice', async ({ page }) => {
  await page.goto('/#/practice/improv');
  await page.getByRole('button', { name: '也可以用文字练习' }).click();
  await expect(page.getByRole('button', { name: '查看基础反馈' })).toBeInViewport({ ratio: 1 });
  await page.getByLabel('我的表达').fill('这是准备保存的练习内容，用来检查历史记录的点评功能。');
  await page.getByRole('button', { name: '仅保存练习' }).click();
  await page.locator('.history-card').click();
  await expect(page.getByRole('button', { name: '查看基础反馈' })).toBeVisible();
  await page.locator('#saved-transcript').fill('我认为开会前明确主题很重要，因为这样可以节省讨论时间。例如提前共享问题清单，最后确定下一步行动。');
  await page.getByRole('button', { name: '查看基础反馈' }).click();
  await expect(page.getByText('点评已保存到这条练习记录。')).toBeVisible();
  await page.reload();
  await expect(page.locator('#saved-transcript')).toHaveValue(/明确主题/);
  await expect(page.getByText('基础反馈 · 非 AI 点评')).toBeVisible();
  await page.goto('/#/history');
  await expect(page.locator('.history-card')).toHaveCount(1);
});
test('saved audio can be transcribed, edited and receive AI feedback without losing audio', async ({ page }) => {
  await page.route('**/api/status', route => route.fulfill({ json: { ai: true, asr: true } }));
  await page.route('**/api/transcribe', route => route.fulfill({ json: { text: '我认为提前准备很重要，因为明确重点可以减少沟通时间。' } }));
  await page.route('**/api/analyze', async route => {
    expect(route.request().postDataJSON().transcript).toContain('具体例子');
    await route.fulfill({ json: { source: 'ai', summary: '观点清晰，可以进一步补充例子。', dimensions: [], improvements: ['补充细节'], rewrite: '测试改写', metrics: { characters: 35, duration: 12, fillers: 0 } } });
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('kaikou-practice', 1); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put({ id: 'saved-audio-test', mode: 'improv', topic: '为什么要提前准备？', transcript: '', duration: 12, createdAt: '2026-09-20T00:00:00Z', audio: new Blob(['test-audio'], { type: 'audio/wav' }) }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.goto('/#/record/saved-audio-test');
  await page.reload();
  await page.getByRole('button', { name: '转写录音', exact: true }).click();
  await expect(page.locator('#saved-transcript')).toHaveValue(/提前准备/);
  await page.locator('#saved-transcript').fill('我认为提前准备很重要，因为明确重点可以减少沟通时间。这里补充一个具体例子。');
  await page.getByRole('button', { name: '生成 AI 点评', exact: true }).click();
  await expect(page.getByText('点评已保存到这条练习记录。')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '重新生成 AI 点评' })).toBeVisible();
  await expect(page.locator('audio')).toBeVisible();
  await expect(page.locator('#saved-transcript')).toHaveValue(/具体例子/);
  await expect(page.getByText('观点清晰，可以进一步补充例子。')).toBeVisible();
});

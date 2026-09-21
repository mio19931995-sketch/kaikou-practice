import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const live = JSON.parse(fs.readFileSync('tests/fixtures/jev-report.json', 'utf8'));
test('Jev real response visualization persists and supports keyboard selection', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async ({ input, feedback }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('kaikou-practice', 1); r.onupgradeneeded = () => r.result.createObjectStore('sessions', { keyPath: 'id' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put({ ...input, feedback, id: 'jev-visual-test', createdAt: new Date().toISOString() }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, live);
  await page.goto('/#/record/jev-visual-test'); await page.reload();
  await expect(page.getByLabel('Jev 评估可视化')).toBeVisible();
  await expect(page.locator('.jev-card')).toHaveCount(4);
  await page.getByRole('button', { name: /02 · 表达结构/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.jev-detail')).toContainText('表达结构 · 判断标准');
  await expect(page.locator('.jev-detail')).toContainText('不代表结论的准确率');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1420, height: 1080 });
  await page.reload();
  await expect(page.locator('.jev-card')).toHaveCount(4);
  await page.getByLabel('Jev 评估可视化').screenshot({ path: '.reference-analysis/jev-visual-preview.png' });
});


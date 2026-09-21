import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/agnes-coach.json','utf8'));
test('Agnes six-dimensional guidance displays source quotes, standards and priorities',async({page})=>{
 await page.route('**/api/status',r=>r.fulfill({json:{ai:true,asr:false}}));
 await page.route('**/api/analyze',r=>r.fulfill({json:fixture.feedback}));
 await page.goto('/#/practice/improv');await page.getByRole('button',{name:'也可以用文字练习'}).click();
 await page.getByLabel('我的表达',{exact:true}).fill(fixture.input.transcript);
 await page.getByRole('button',{name:'仅保存练习'}).click();await page.locator('.history-card').click();
 await page.getByLabel('点评场景').selectOption('report');await page.getByRole('button',{name:'生成 AI 点评',exact:true}).click();
 await expect(page.getByText('Agnes · 多维表达点评')).toBeVisible();await expect(page.locator('.dimension-list article')).toHaveCount(6);
 await page.getByText('查看本题参考标准 · 工作汇报 / 问题解决').click();await expect(page.locator('.coaching-guide')).toContainText('[负责人]');
 await expect(page.locator('.coaching-quote').first()).toHaveText('项目要延期了');
 await page.reload();await expect(page.getByText('Agnes · 多维表达点评')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

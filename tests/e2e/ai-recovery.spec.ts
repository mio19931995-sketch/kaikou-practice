import { test, expect } from '@playwright/test';
for (const saved of [false, true]) test(`AI remains discoverable and rechecks configuration in ${saved ? 'history' : 'practice'}`, async ({page}) => {
  let enabled = false, calls = 0;
  await page.route('**/api/status', r => r.fulfill({json: {ai:enabled,asr:false}}));
  await page.route('**/api/analyze', r => {
    calls++;
    expect(r.request().headers()['x-kaikou-require-ai']).toBe('1');
    return r.fulfill({json:{source:'ai',summary:'观点明确。',dimensions:[],improvements:['补充一个例子。'],rewrite:'',metrics:{characters:20,duration:0,fillers:0}}});
  });
  await page.goto('/#/practice/improv');
  await page.getByRole('button',{name:'也可以用文字练习'}).click();
  const original = '我建议提前准备，因为明确主题可以节省沟通时间。';
  await page.getByLabel('我的表达',{exact:true}).fill(original);
  if(saved) { await page.getByRole('button',{name:'仅保存练习'}).click(); await page.locator('.history-card').click(); }
  await expect(page.getByRole('button',{name:'查看基础反馈',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'生成 AI 点评',exact:true}).click();
  await expect(page.getByLabel('AI 点评连接')).toContainText('尚未配置完整');
  expect(calls).toBe(0);
  await expect(page.locator(saved ? '#saved-transcript' : '#transcript')).toHaveValue(original);
  await page.screenshot({path:`.reference-analysis/ai-recovery-${saved ? 'history' : 'practice'}.png`});
  enabled = true;
  await page.getByRole('button',{name:'生成 AI 点评',exact:true}).click();
  await expect(page.getByText('观点明确。',{exact:true}).first()).toBeVisible();
  expect(calls).toBe(1);
});

test('desktop can configure AI inline without losing the practice text', async ({page}) => {
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(() => { const w=window as any; w.aiReady=false; const value={baseUrl:'https://apihub.agnes-ai.com/v1',model:'agnes-2.5-flash',hasKey:false}; w.desktopApp={platform:'win32',getServiceSettings:async()=>({success:true,value}),saveServiceSettings:async()=>{w.aiReady=true;return {success:true,value:{...value,hasKey:true}};},testServiceSettings:async()=>({success:true,value:{ok:true,message:'测试通过'}})}; });
 await page.route('**/api/status', async r => r.fulfill({json:{ai:await page.evaluate(()=>(window as any).aiReady),asr:false}}));
 await page.goto('/#/practice/improv');
 await page.getByRole('button',{name:'也可以用文字练习'}).click();
 await page.getByLabel('我的表达',{exact:true}).fill('保存配置的时候不要丢失我已经写好的表达内容。');
 await page.getByRole('button',{name:'生成 AI 点评',exact:true}).click();
 await expect(page.getByRole('heading',{name:'AI 服务配置'})).toBeVisible();
 await page.getByLabel('API Key',{exact:true}).fill('test-placeholder');
 await page.getByRole('button',{name:'保存并生效'}).click();
 await expect(page.locator('.ai-recovery')).toHaveCount(0);
 await expect(page.getByLabel('我的表达',{exact:true})).toHaveValue('保存配置的时候不要丢失我已经写好的表达内容。');
 await expect(page.getByRole('button',{name:'生成 AI 点评',exact:true})).toBeVisible();
});

for (const failure of ['offline','config-error','starting']) for (const saved of [false,true]) test(`AI entry survives ${failure} in ${saved ? 'history' : 'practice'}`, async ({page}) => {
 await page.route('**/api/status', r=>r.fulfill({json:{ai:true,asr:false}}));
 await page.goto('/#/practice/improv');
 await page.getByRole('button',{name:'也可以用文字练习'}).click();
 await page.getByLabel('我的表达',{exact:true}).fill('状态暂时失败也应该保留点评入口和我的文字。');
 if(saved){ await page.getByRole('button',{name:'仅保存练习'}).click(); await page.locator('.history-card').click(); }
 await page.route('**/api/status', async r => {
  if(failure==='offline') return r.abort('connectionfailed');
  if(failure==='config-error') return r.fulfill({status:503,json:{error:'配置暂时不可读'}});
  await new Promise(resolve=>setTimeout(resolve,5500));
  await r.fulfill({json:{ai:true,asr:false}}).catch(()=>{});
 });
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('button',{name:'生成 AI 点评',exact:true})).toBeVisible();
 await expect(page.getByLabel('AI 点评连接')).toBeVisible({timeout:10000});
 await expect(page.getByRole('button',{name:'生成 AI 点评',exact:true})).toBeEnabled();
 await expect(page.locator(saved?'#saved-transcript':'#transcript')).toHaveValue('状态暂时失败也应该保留点评入口和我的文字。');
});

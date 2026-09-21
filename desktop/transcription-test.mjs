import { _electron, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const userData = path.join(root, '.reference-analysis', `transcription-test-${Date.now()}`);
fs.mkdirSync(userData, { recursive: true });
const env = { ...process.env, KAIKOU_TEST_USER_DATA: userData, KAIKOU_TEST_PORT: process.env.KAIKOU_TEST_PORT || '47933', KAIKOU_TEST_HIDE_WINDOW: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.argv[2];
const app = await _electron.launch({ executablePath, args: [...(executablePath ? [] : ['.']), '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${path.join(root, '.reference-analysis', 'speech-fixture.wav')}`], cwd: root, env, timeout: 60000 });
try {
  const page = await app.firstWindow();
  await page.getByRole('button', { name: '开始一分钟练习' }).click();
  await expect(page.getByText('录音结束后自动在本机转成文字，音频不会上传。')).toBeVisible();
  await page.getByRole('button', { name: '开始表达', exact: true }).click();
  await expect(page.getByRole('button', { name: '结束录音' })).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(10000);
  await page.getByRole('button', { name: '结束录音' }).click();
  await expect(page.locator('.transcription-status')).toContainText(/正在识别|文字已就绪/, { timeout: 15000 });
  await expect(page.getByLabel('我的表达')).toHaveValue(/例如|明[确確]/, { timeout: 90000 });
  await expect(page.getByLabel('我的表达')).toBeEnabled();
  const transcript = await page.getByLabel('我的表达').inputValue();
  assert.ok(transcript.length >= 5);
  await page.getByRole('button', { name: '查看基础反馈' }).click();
  await expect(page.getByText('已保存到练习记录', { exact: false })).toBeVisible();
  console.log('PASS: captured spoken Chinese, automatic offline transcription below audio, editable transcript, feedback and saved record.');
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }



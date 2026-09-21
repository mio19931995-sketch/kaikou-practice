import { _electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";

const root = process.cwd();
const userData = path.join(
  root,
  ".reference-analysis",
  `desktop-smoke-${Date.now()}`,
);
fs.mkdirSync(userData, { recursive: true });
const env = {
  ...process.env,
  KAIKOU_TEST_USER_DATA: userData,
  KAIKOU_TEST_PORT: "47931",
  KAIKOU_TEST_HIDE_WINDOW: "1",
};
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.argv[2];
const args = [
  ...(executablePath ? [] : ["."]),
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
];
const launch = () =>
  _electron.launch({ executablePath, args, cwd: root, env, timeout: 45000 });
let instance;
try {
  instance = await launch();
  const page = await instance.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    page.getByRole("heading", { name: "今天，也向前一步。" }),
  ).toBeVisible();
  const preferences = await instance.evaluate(({ BrowserWindow }) => {
    const p =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: p.sandbox,
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
    };
  });
  assert.deepEqual(preferences, {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
  });
  await expect(
    page.getByRole("navigation", { name: "桌面导航" }),
  ).toBeVisible();
  if (!executablePath) await page.screenshot({
    path: path.join(root, ".reference-analysis", "desktop-app-home.png"),
  });
  await page.getByRole("button", { name: "开始一分钟练习" }).click();
  await expect(page.locator(".practice-guide")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "开始表达", exact: true }).click();
  await expect(page.getByRole("button", { name: "结束录音" })).toBeVisible({
    timeout: 15000,
  });
  await page.waitForTimeout(1400);
  if (!executablePath) await page.screenshot({
    path: path.join(root, ".reference-analysis", "desktop-app-recording.png"),
  });
  await page.getByRole("button", { name: "结束录音" }).click();
  await expect(page.locator("audio")).toBeVisible();
  assert.equal(
    await page.locator("audio").evaluate(async (audio) => {
      await audio.play();
      return !audio.paused;
    }),
    true,
  );
  await page
    .getByLabel("我的表达")
    .fill(
      "我认为准备很重要。因为明确重点可以减少绕弯，例如开会前先写下需要讨论的问题。最后再用一句话总结自己的想法。",
    );
  await page.getByRole("button", { name: "查看基础反馈" }).click();
  await expect(
    page.getByText("已保存到练习记录", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看练习记录" }).click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  assert.deepEqual(errors, []);
  await instance.close();
  instance = undefined;
  instance = await launch();
  const reopened = await instance.firstWindow();
  await reopened.getByRole("link", { name: /我的练习/ }).click();
  await expect(reopened.locator(".history-card")).toHaveCount(1);
  await reopened.locator(".history-card").click();
  await expect(reopened.locator("audio")).toBeVisible();
  assert.equal(
    await reopened.locator("audio").evaluate(async (audio) => {
      await audio.play();
      return !audio.paused;
    }),
    true,
  );
  console.log(
    "PASS: independent window, isolated renderer, desktop navigation, microphone recording, playback, feedback, storage across app restarts.",
  );
} finally {
  if (instance) await instance.close();
}

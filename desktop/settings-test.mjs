import { _electron, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
const root = process.cwd();
const userData = path.join(
  process.env.KAIKOU_SETTINGS_TEST_ROOT ||
    path.join(root, ".reference-analysis"),
  `settings-test-${Date.now()}`,
);
fs.mkdirSync(userData, { recursive: true });
let calls = 0;
const mock = http.createServer(async (req, res) => {
  calls++;
  assert.equal(req.url, "/v1/chat/completions");
  assert.equal(req.headers.authorization, "Bearer settings-test-key");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
});
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const env = {
  ...process.env,
  KAIKOU_TEST_USER_DATA: userData,
  KAIKOU_TEST_PORT: "47932",
  KAIKOU_TEST_HIDE_WINDOW: "1",
};
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.argv[2];
const launch = () =>
  _electron.launch({
    executablePath,
    args: executablePath ? [] : ["."],
    cwd: root,
    env,
  });
let app;
try {
  app = await launch();
  let page = await app.firstWindow({ timeout: 120000 });
  await page.getByRole("link", { name: "设置与说明" }).click();
  await expect(page.getByLabel("模型服务", { exact: true })).toHaveValue(
    "agnes",
  );
  await expect(
    page.getByRole("button", { name: "打开服务配置文件" }),
  ).toHaveCount(0);
  await page.getByLabel("模型服务", { exact: true }).selectOption("jev");
  await expect(page.getByLabel("接口地址（Base URL）")).toHaveValue("https://api.typesafe.ai/v1");
  await expect(page.getByLabel("模型名称", { exact: true })).toHaveValue("jev-latest");
  await page.getByLabel("模型服务", { exact: true }).selectOption("custom");
  await page
    .getByLabel("接口地址（Base URL）")
    .fill(`http://127.0.0.1:${mock.address().port}/v1`);
  await page.getByLabel("模型名称", { exact: true }).fill("test-model");
  await page.getByLabel("API Key", { exact: true }).fill("settings-test-key");
  await expect(page.getByLabel("API Key", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("连接成功");
  assert.equal(calls, 1);
  await page.getByRole("button", { name: "保存并生效", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存并生效");
  assert.equal(
    await page.evaluate(
      async () => (await (await fetch("/api/status")).json()).ai,
    ),
    true,
  );
  assert.equal(
    fs
      .readFileSync(path.join(userData, "ai-service.json"), "utf8")
      .includes("settings-test-key"),
    false,
  );
  await app.close();
  app = await launch();
  page = await app.firstWindow({ timeout: 120000 });
  await page.getByRole("link", { name: "设置与说明" }).click();
  await expect(page.getByLabel("API Key", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("连接成功");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "停用并清除密钥" }).click();
  await expect(page.getByRole("status")).toContainText("已停用");
  assert.equal(
    await page.evaluate(
      async () => (await (await fetch("/api/status")).json()).ai,
    ),
    false,
  );
  console.log(
    "PASS: native in-app settings, model test, encrypted persistence, immediate activation, restart reuse, clear key.",
  );
} finally {
  if (app) await app.close();
  mock.close();
}

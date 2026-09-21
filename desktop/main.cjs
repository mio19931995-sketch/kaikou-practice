const {
  app,
  BrowserWindow,
  Menu,
  session,
  ipcMain,
  safeStorage,
  dialog,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { createServiceSettings } = require("./service-settings.cjs");
const { createLocalTranscription } = require("./local-transcription.cjs");

app.setName("开口练习");
app.setAppUserModelId("studio.kaikou.practice");
app.setPath(
  "userData",
  process.env.KAIKOU_TEST_USER_DATA ||
    path.join(app.getPath("appData"), "KaikouPractice"),
);
const port = Number(process.env.KAIKOU_TEST_PORT || 47921);
const origin = `http://127.0.0.1:${port}`;
const locked = app.requestSingleInstanceLock();
let mainWindow;
let server;
let localTranscription;
let allowClose = false;
let closingPrompt = false;

if (!locked) app.quit();
else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app
    .whenReady()
    .then(start)
    .catch((error) => {
      dialog.showErrorBox(
        "开口练习未能启动",
        error.code === "EADDRINUSE"
          ? `本机端口 ${port} 已被其他程序占用，请关闭冲突程序后重新打开。`
          : `启动时遇到问题：${error.message}`,
      );
      app.quit();
    });
}

async function start() {
  Menu.setApplicationMenu(null);
  const root = path.join(__dirname, "..");
  const settingsPath = path.join(app.getPath("userData"), "services.env");
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  if (!fs.existsSync(settingsPath))
    fs.copyFileSync(path.join(root, ".env.example"), settingsPath);
  const dotenv = require("dotenv");
  const settings = dotenv.parse(fs.readFileSync(settingsPath));
  const services = createServiceSettings({
    settings,
    file: path.join(app.getPath("userData"), "ai-service.json"),
    encrypt: (value) => {
      if (!safeStorage.isEncryptionAvailable())
        throw new Error("系统密钥保护暂不可用，未保存密钥。");
      return safeStorage.encryptString(value);
    },
    decrypt: (value) => safeStorage.decryptString(value),
  });
  const { createApp } = await import(
    pathToFileURL(path.join(root, "server", "app.mjs")).href
  );
  const express = require("express");
  localTranscription = createLocalTranscription({
    script: path.join(
      app.isPackaged ? process.resourcesPath : __dirname,
      "transcribe.py",
    ),
  });
  await localTranscription.check();
  const backend = createApp({
    env: settings,
    localTranscription,
    refreshConfig: () => services.reload(),
  });
  backend.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    next();
  });
  backend.use(express.static(path.join(root, "dist")));
  backend.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
  await new Promise((resolve, reject) => {
    server = backend.listen(port, "127.0.0.1", resolve);
    server.once("error", reject);
  });

  const partition = session.fromPartition("persist:kaikou");
  const isLocal = (url) => {
    try {
      return new URL(url).origin === origin;
    } catch {
      return false;
    }
  };
  partition.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin, details) =>
      permission === "media" &&
      isLocal(requestingOrigin) &&
      details.mediaType !== "video",
  );
  partition.setPermissionRequestHandler(
    (webContents, permission, callback, details) =>
      callback(
        Boolean(
          webContents &&
          isLocal(webContents.getURL()) &&
          permission === "media" &&
          details.mediaTypes?.length &&
          details.mediaTypes.every((type) => type === "audio"),
        ),
      ),
  );
  const size = { width: 1420, height: 960 };
  mainWindow = new BrowserWindow({
    ...size,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    title: "开口 · 表达练习室",
    backgroundColor: "#f7f9f5",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      partition: "persist:kaikou",
      spellcheck: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isLocal(url)) event.preventDefault();
  });
  mainWindow.webContents.on("will-prevent-unload", (event) => {
    if (allowClose) {
      event.preventDefault();
      return;
    }
    if (closingPrompt) return;
    closingPrompt = true;
    dialog
      .showMessageBox(mainWindow, {
        type: "question",
        buttons: ["继续练习", "离开"],
        defaultId: 0,
        cancelId: 0,
        title: "还没有保存本次练习",
        message: "本次练习尚未保存。确定离开吗？",
      })
      .then(({ response }) => {
        closingPrompt = false;
        if (response === 1) {
          allowClose = true;
          mainWindow.close();
        }
      });
  });
  mainWindow.once("ready-to-show", () => {
    if (!process.env.KAIKOU_TEST_HIDE_WINDOW) mainWindow.show();
  });
  const verifySender = (event) => {
    if (
      event.sender !== mainWindow.webContents ||
      !isLocal(event.senderFrame?.url || "")
    )
      throw new Error("Untrusted sender");
  };
  for (const action of ["read", "save", "test"]) {
    ipcMain.handle(`kaikou:service-${action}`, async (event, input) => {
      verifySender(event);
      try {
        return { success: true, value: await services[action](input) };
      } catch (error) {
        return {
          success: false,
          message:
            action === "read"
              ? "无法读取配置。"
              : error.code
                ? {
                    ENOSPC: "磁盘空间不足，配置未保存。",
                    EACCES: "应用数据目录无写入权限，配置未保存。",
                    EPERM: "配置文件被占用或禁止写入，请稍后重试。",
                    EXDEV: "应用数据目录跨设备写入失败，配置未保存。",
                  }[error.code] ||
                  "本机配置写入失败，原有配置保持不变，请稍后重试。"
                : error.message,
        };
      }
    });
  }
  ipcMain.handle("kaikou:restart", (event) => {
    verifySender(event);
    app.relaunch();
    app.quit();
  });
  await mainWindow.loadURL(origin);
}
app.on("window-all-closed", () => {
  server?.close();
  app.quit();
});
app.on("before-quit", () => {
  localTranscription?.close();
  server?.close();
});

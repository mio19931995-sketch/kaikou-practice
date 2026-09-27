import { buildAgnesMessages, parseAgnes } from "./agnes.mjs";
import { jevRequest, parseJev } from "./jev.mjs";
import express from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import {
  analysisInput,
  basicFeedback,
  buildMessages,
  parseReport,
} from "./feedback.mjs";

export function createApp({
  env = process.env,
  fetcher = fetch,
  localTranscription,
  refreshConfig,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    const origin = req.get("origin");
    if (req.path.startsWith("/api") && origin) {
      try {
        if (new URL(origin).host !== req.get("host"))
          return res.status(403).json({ error: "不允许跨站请求。" });
      } catch {
        return res.status(403).json({ error: "请求来源无效。" });
      }
    }
    next();
  });
  app.use("/api", express.json({ limit: "64kb" }));
  app.use("/api", (_req, res, next) => {
    try {
      refreshConfig?.();
      next();
    } catch {
      res.status(503).json({
        error:
          "已保存的 AI 配置暂时无法读取，请在设置中重新检查；本次不会改用基础反馈。",
      });
    }
  });
  app.get("/api/status", (_req, res) =>
    res.json({
      ai: Boolean(env.AI_API_KEY && env.AI_BASE_URL && env.AI_MODEL),
      asr: Boolean(
        localTranscription?.available() ||
        (env.ASR_API_KEY && env.ASR_BASE_URL && env.ASR_MODEL),
      ),
      ...(localTranscription
        ? { asrMode: localTranscription.available() ? "local" : "unavailable" }
        : {}),
    }),
  );
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "练习请求比较频繁，请稍后再试。录音仍可保存在本机。" },
  });
  app.use(["/api/analyze", "/api/transcribe"], limiter);
  app.post("/api/analyze", async (req, res) => {
    const parsed = analysisInput.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.issues[0].message });
    const input = parsed.data;
    if (!env.AI_API_KEY || !env.AI_BASE_URL || !env.AI_MODEL)
      return res.json(basicFeedback(input));
    try {
      // DeepSeek's current API defaults to thinking mode. For a short, structured
      // coaching response, explicitly disable it and request JSON output.
      const isAgnes =
        new URL(env.AI_BASE_URL).hostname === "apihub.agnes-ai.com";
      const isJev = new URL(env.AI_BASE_URL).hostname === "api.typesafe.ai";
      if (isJev && input.thinkingModelId)
        return res.status(422).json({
          error:
            "当前 Jev 规则尚未覆盖思维框架应用练习，请在设置中选择 Agnes 或兼容模型；也可以先保存练习。",
        });
      const isDeepSeek =
        new URL(env.AI_BASE_URL).hostname === "api.deepseek.com";
      const upstream = await fetcher(
        `${env.AI_BASE_URL.replace(/\/$/, "")}/${isJev ? "systemone" : "chat/completions"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.AI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isJev
              ? jevRequest(input, env.AI_MODEL)
              : {
                  model: env.AI_MODEL,
                  messages: isAgnes
                    ? buildAgnesMessages(input)
                    : buildMessages(input),
                  stream: false,
                  max_tokens: 2500,
                  temperature: 0.5,
                  ...(isDeepSeek
                    ? {
                        thinking: { type: "disabled" },
                        response_format: { type: "json_object" },
                      }
                    : {}),
                },
          ),
          signal: AbortSignal.timeout(90000),
        },
      );
      if (!upstream.ok)
        return res.status(502).json({
          error:
            upstream.status === 401 || upstream.status === 403
              ? "AI 服务授权失败，请检查服务端配置。你的录音没有丢失。"
              : upstream.status === 429
                ? "AI 服务暂时繁忙，请稍后重试。"
                : "AI 服务暂时不可用，请稍后重试。",
        });
      const data = await upstream.json();
      if (isJev) return res.json(parseJev(data, input));
      if (data.choices?.[0]?.finish_reason === "length")
        throw new Error("Incomplete provider response");
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string")
        throw new Error("Invalid provider response");
      res.json({
        ...(isAgnes ? parseAgnes(content, input) : parseReport(content, input)),
        model: env.AI_MODEL,
      });
    } catch (error) {
      res.status(502).json({
        error:
          error.name === "TimeoutError"
            ? "AI 分析超时了，请稍后重试。你的内容仍保留在页面中。"
            : error.name === "TypeError"
              ? "未能连接 AI 服务，请检查网络后重试。已保存的录音和文字不受影响。"
              : "AI 返回的点评未通过完整性或原文校验，请重试。已保存的内容仍保留，不会用基础反馈替代。",
      });
    }
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 0 },
    fileFilter: (_req, file, cb) =>
      cb(
        null,
        [
          "audio/wav",
          "audio/x-wav",
          "audio/webm",
          "audio/mp4",
          "audio/mpeg",
          "audio/ogg",
        ].includes(file.mimetype),
      ),
  });
  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    if (localTranscription?.available()) {
      if (!req.file)
        return res.status(400).json({ error: "请选择受支持的音频文件。" });
      try {
        return res.json({
          text: await localTranscription.transcribe(req.file.buffer),
        });
      } catch (error) {
        return res.status(503).json({ error: error.message });
      }
    }
    if (!env.ASR_API_KEY || !env.ASR_BASE_URL || !env.ASR_MODEL)
      return res.status(503).json({
        error: "云端转写尚未启用。你可以使用浏览器转写，或手动填写表达内容。",
      });
    if (!req.file)
      return res.status(400).json({ error: "请选择受支持的音频文件。" });
    try {
      const body = new FormData();
      body.append(
        "file",
        new Blob([req.file.buffer], { type: req.file.mimetype }),
        req.file.originalname,
      );
      body.append("model", env.ASR_MODEL);
      const upstream = await fetcher(
        `${env.ASR_BASE_URL.replace(/\/$/, "")}/audio/transcriptions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${env.ASR_API_KEY}` },
          body,
          signal: AbortSignal.timeout(90000),
        },
      );
      if (!upstream.ok)
        return res
          .status(502)
          .json({ error: "语音转写服务暂时不可用。请重试，或手动填写内容。" });
      const data = await upstream.json();
      if (typeof data.text !== "string")
        throw new Error("Invalid transcription response");
      res.json({ text: data.text.slice(0, 6000) });
    } catch {
      res
        .status(502)
        .json({ error: "语音转写未完成。录音仍在，可以稍后重试。" });
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "接口不存在。" }),
  );
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "音频超过 12 MB，请缩短录音后重试。"
          : "请求格式不正确，请检查后重试。",
    });
  });
  return app;
}

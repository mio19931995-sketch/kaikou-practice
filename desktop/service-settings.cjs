const fs = require("node:fs");

function persistRecord(file, record, io = fs) {
  const temp = `${file}.tmp`;
  io.writeFileSync(temp, JSON.stringify(record), { mode: 0o600 });
  try {
    io.renameSync(temp, file);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    // Some redirected Windows profiles report EXDEV even within one directory.
    // Keep the previous encrypted bytes until the replacement has completed.
    const previous = io.existsSync(file) ? io.readFileSync(file) : null;
    try {
      io.copyFileSync(temp, file);
    } catch (copyError) {
      if (previous) io.writeFileSync(file, previous);
      else if (io.existsSync(file)) io.unlinkSync(file);
      throw copyError;
    }
    // A cleanup error must not report a successfully saved configuration as lost.
    try {
      io.unlinkSync(temp);
    } catch {
      /* encrypted temporary copy only */
    }
  }
}

function createServiceSettings({
  settings,
  file,
  encrypt,
  decrypt,
  fetcher = fetch,
}) {
  function reload() {
    const recoverPending = !fs.existsSync(file) && fs.existsSync(`${file}.tmp`);
    if (fs.existsSync(file) || recoverPending) {
      const saved = JSON.parse(
        fs.readFileSync(recoverPending ? `${file}.tmp` : file, "utf8"),
      );
      const key = saved.key ? decrypt(Buffer.from(saved.key, "base64")) : "";
      Object.assign(settings, {
        AI_BASE_URL: saved.baseUrl,
        AI_MODEL: saved.model,
        AI_API_KEY: key,
      });
      if (recoverPending) persistRecord(file, saved);
    }
  }
  reload();
  const read = () => ({
    baseUrl: settings.AI_BASE_URL || "",
    model: settings.AI_MODEL || "",
    hasKey: Boolean(settings.AI_API_KEY),
  });
  function validate(input) {
    if (!input || typeof input !== "object")
      throw new Error("配置格式不正确。");
    const { baseUrl, model, apiKey = "", clearKey = false } = input;
    if (
      [baseUrl, model, apiKey].some(
        (v) => typeof v !== "string" || v.length > 4096 || /[\r\n\0]/.test(v),
      )
    )
      throw new Error("请填写有效的地址、模型和密钥。");
    let url;
    try {
      url = new URL(baseUrl.trim());
    } catch {
      throw new Error("接口地址格式不正确。");
    }
    if (
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        )) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "请使用 HTTPS 接口地址（本机服务可使用 HTTP），不要包含密码或查询参数。",
      );
    const normalized = url.href.replace(/\/+$/, "");
    if (!model.trim() || model.trim().length > 150)
      throw new Error("请填写模型名称。");
    const key = clearKey
      ? ""
      : apiKey.trim() ||
        (normalized === (settings.AI_BASE_URL || "").replace(/\/+$/, "")
          ? settings.AI_API_KEY
          : "");
    if (!key && !clearKey)
      throw new Error("请粘贴 API Key。切换接口地址后需要重新填写密钥。");
    return { baseUrl: normalized, model: model.trim(), key };
  }
  function save(input) {
    const value = validate(input);
    const record = {
      baseUrl: value.baseUrl,
      model: value.model,
      key: value.key ? encrypt(value.key).toString("base64") : "",
    };
    persistRecord(file, record);
    Object.assign(settings, {
      AI_BASE_URL: value.baseUrl,
      AI_MODEL: value.model,
      AI_API_KEY: value.key,
    });
    return read();
  }
  async function test(input) {
    const value = validate(input);
    if (!value.key) throw new Error("请先填写 API Key。");
    try {
      const isJev = new URL(value.baseUrl).hostname === "api.typesafe.ai";
      const response = await fetcher(`${value.baseUrl}/${isJev ? "systemone" : "chat/completions"}`, {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${value.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(isJev ? { model: value.model, state: "连接测试", questions: { connection: { type: "choice", instructions: "判断输入是否为连接测试。", criteria: { yes: "输入是连接测试", no: "输入不是连接测试" } } } } : {
          model: value.model,
          messages: [{ role: "user", content: "只回复 OK。" }],
          max_tokens: 256,
          stream: false,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        const messages = {
          401: "密钥无效或已过期。",
          403: "当前账号没有访问权限。",
          404: "接口地址或模型名称不存在。",
          429: "请求受限，请检查额度或稍后重试。",
        };
        return {
          ok: false,
          message:
            messages[response.status] ||
            `服务返回错误（${response.status}），请检查配置。`,
        };
      }
      const body = await response.json();
      if (isJev) {
        const a = body.answers?.connection;
        const ok = a?.type === "choice" && ["yes", "no"].includes(a.choice) && typeof a.probabilities?.yes === "number" && typeof a.probabilities?.no === "number";
        return { ok, message: ok ? "Jev 连接成功。保存后将用于结构化评估。" : "服务未返回有效的 Jev 判断结果，请检查接口和模型。" };
      }
      if (
        typeof body.choices?.[0]?.message?.content !== "string" ||
        !body.choices[0].message.content.trim()
      )
        return {
          ok: false,
          message:
            "服务已响应，但没有返回有效文本，请检查模型是否支持对话接口。",
        };
      return {
        ok: true,
        message: "连接成功，模型已响应。点击“保存并生效”后用于表达点评。",
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error.name === "TimeoutError"
            ? "连接超时，请检查网络或接口地址。"
            : "未能连接服务，请检查网络、接口地址和模型设置。",
      };
    }
  }
  return { read, save, test, reload };
}
module.exports = { createServiceSettings, persistRecord };

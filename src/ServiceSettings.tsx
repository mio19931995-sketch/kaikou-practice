import { useEffect, useState } from "react";
import type { ServiceConfig } from "./desktop-env";

const presets = {
  agnes: {
    name: "Agnes AI",
    baseUrl: "https://apihub.agnes-ai.com/v1",
    model: "agnes-2.5-flash",
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
  },
  jev: { name: "TypeSafe / Jev", baseUrl: "https://api.typesafe.ai/v1", model: "jev-latest" },
  custom: { name: "其他兼容服务", baseUrl: "", model: "" },
};
type Provider = keyof typeof presets;
export function ServiceSettings({ refresh }: { refresh: () => Promise<void> }) {
  const [provider, setProvider] = useState<Provider>("agnes");
  const [baseUrl, setBaseUrl] = useState(presets.agnes.baseUrl);
  const [model, setModel] = useState(presets.agnes.model);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState<ServiceConfig>();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState({ ok: false, text: "" });
  const reusable =
    saved?.hasKey &&
    saved.baseUrl.replace(/\/+$/, "") === baseUrl.trim().replace(/\/+$/, "");
  useEffect(() => {
    let active = true;
    window
      .desktopApp!.getServiceSettings()
      .then((result) => {
        if (!active) return;
        if (!result.success) throw new Error(result.message);
        setSaved(result.value);
        if (result.value.hasKey) {
          setBaseUrl(result.value.baseUrl);
          setModel(result.value.model);
          setProvider(
            result.value.baseUrl === presets.agnes.baseUrl
              ? "agnes"
              : result.value.baseUrl === presets.deepseek.baseUrl
                ? "deepseek"
                : result.value.baseUrl === presets.jev.baseUrl ? "jev" : "custom",
          );
        }
      })
      .catch(() => {
        if (active)
          setNotice({
            ok: false,
            text: "无法读取服务配置，请重新打开设置页。",
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function act(action: "test" | "save" | "clear") {
    setBusy(action);
    setNotice({ ok: false, text: "" });
    try {
      const input = { baseUrl, model, apiKey, clearKey: action === "clear" };
      if (action === "test") {
        const result = await window.desktopApp!.testServiceSettings(input);
        if (!result.success) throw new Error(result.message);
        setNotice({ ok: result.value.ok, text: result.value.message });
      } else {
        const result = await window.desktopApp!.saveServiceSettings(input);
        if (!result.success) throw new Error(result.message);
        setSaved(result.value);
        setApiKey("");
        setShow(false);
        await refresh();
        setNotice({
          ok: true,
          text:
            action === "clear"
              ? "已停用 AI 点评并清除当前保存的密钥。"
              : "已保存并生效，下次点评将使用此配置。连接是否可用请以测试结果为准。",
        });
      }
    } catch (error) {
      setNotice({
        ok: false,
        text: error instanceof Error ? error.message : "操作失败，请重试。",
      });
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="settings-section service-config">
      <h2>AI 服务配置</h2>
      <p>选择模型服务，粘贴你的 API Key。保存后立即生效。</p>
      <fieldset disabled={loading || Boolean(busy)}>
        <label htmlFor="ai-provider">模型服务</label>
        <select
          id="ai-provider"
          value={provider}
          onChange={(event) => {
            const next = event.target.value as Provider;
            setProvider(next);
            setBaseUrl(presets[next].baseUrl);
            setModel(presets[next].model);
            setApiKey("");
            setNotice({ ok: false, text: "" });
          }}
        >
          {Object.entries(presets).map(([key, value]) => (
            <option key={key} value={key}>
              {value.name}
            </option>
          ))}
        </select>
        {provider === "jev" && <p>Jev 按汇报、面试、说服、复述等场景检查具体要点，定位原话并提供针对性练习。不生成长篇点评或改写。请填写 TypeSafe 平台的 API Key。</p>}
        <div className="service-fields">
          <div>
            <label htmlFor="ai-base">接口地址（Base URL）</label>
            <input
              id="ai-base"
              type="url"
              value={baseUrl}
              onChange={(event) => {
                setBaseUrl(event.target.value);
                setNotice({ ok: false, text: "" });
              }}
              spellCheck={false}
            />
          </div>
          <div>
            <label htmlFor="ai-model">模型名称</label>
            <input
              id="ai-model"
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setNotice({ ok: false, text: "" });
              }}
              spellCheck={false}
            />
          </div>
        </div>
        <label htmlFor="ai-key">API Key</label>
        <div className="service-key">
          <input
            id="ai-key"
            type={show ? "text" : "password"}
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              setNotice({ ok: false, text: "" });
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder={
              reusable
                ? "已保存密钥；留空继续使用，粘贴新密钥可替换"
                : "在这里粘贴你的 API Key"
            }
          />
          <button
            type="button"
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            {show ? "隐藏密钥" : "显示密钥"}
          </button>
        </div>
        <small>
          密钥经 Windows
          本机加密保存，不会回填显示。测试会向所填地址发送一次简短请求，可能消耗少量额度，不会发送练习记录。
        </small>
        <div className="service-actions">
          <button className="button secondary" onClick={() => void act("test")}>
            {busy === "test" ? "正在测试连接…" : "测试连接"}
          </button>
          <button className="button primary" onClick={() => void act("save")}>
            {busy === "save" ? "正在保存…" : "保存并生效"}
          </button>
          {saved?.hasKey && (
            <button
              className="text-button"
              onClick={() => {
                if (
                  window.confirm(
                    "停用 AI 点评并清除当前保存的密钥？练习记录不会删除。",
                  )
                )
                  void act("clear");
              }}
            >
              停用并清除密钥
            </button>
          )}
        </div>
      </fieldset>
      {notice.text && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={`service-notice ${notice.ok ? "success" : "failure"}`}
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}

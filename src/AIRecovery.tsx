import { useEffect, useRef, useState } from "react";
import { getStatus } from "./api";
import { ServiceSettings } from "./ServiceSettings";

export function AIRecovery({
  disabled,
  onReady,
  checkLabel = "生成 AI 点评",
  requested = 0,
}: {
  disabled: boolean;
  onReady: () => void;
  checkLabel?: string;
  requested?: number;
}) {
  const [checking, setChecking] = useState(false);
  const [opened, setOpened] = useState(false);
  const [message, setMessage] = useState("");
  const previousRequest = useRef(requested);
  async function check(start = true) {
    setChecking(true);
    const status = await getStatus();
    setChecking(false);
    window.dispatchEvent(new Event("focus"));
    if (status.ai) {
      setOpened(false);
      setMessage("AI 服务已就绪，可以生成点评。");
      if (start) onReady();
    } else {
      setOpened(true);
      setMessage(
        status.reachable
          ? "AI 服务尚未配置完整。可在下方连接模型，当前文字和录音会保留。"
          : "暂时无法读取 AI 服务状态，请重新检查。当前文字和录音会保留。",
      );
    }
  }
  useEffect(() => {
    if (requested !== previousRequest.current) {
      previousRequest.current = requested;
      void check();
    }
  }, [requested]);
  return (
    <section className="ai-recovery" aria-label="AI 点评连接">
      <button
        className="button primary"
        disabled={disabled || checking}
        onClick={() => void check()}
      >
        {checking ? "正在检查 AI 服务…" : checkLabel}
      </button>
      <p>AI 点评需要连接模型；基础反馈只提供固定自查，不代替 AI 点评。</p>
      {message && <p role="status">{message}</p>}
      {opened && (
        <>
          <button
            className="button secondary"
            disabled={checking || disabled}
            onClick={() => void check(false)}
          >
            重新检查 AI 服务
          </button>
          {window.desktopApp ? (
            <ServiceSettings refresh={() => check(false)} />
          ) : (
            <p>网页版请在服务配置中填写模型地址、模型名和密钥，再重新检查。</p>
          )}
        </>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { go } from "./components";
import type { Session } from "./types";

export function PracticeNext({
  session,
  disabled = false,
}: {
  session: Session;
  disabled?: boolean;
}) {
  const tasks = session.feedback?.improvements.slice(0, 2) || [];
  const [selected, setSelected] = useState(0);
  if (!session.feedback) return null;
  return (
    <section className="practice-next" aria-label="下一次怎么练">
      <h3>这次先改一个地方</h3>
      <p>选一个重点，用同一道题再说一次。两次练习会分别保存。</p>
      {tasks.length ? (
        <fieldset>
          <legend>下一次的练习重点</legend>
          {tasks.map((task, i) => (
            <label key={i}>
              <input
                type="radio"
                name={`focus-${session.id}`}
                checked={selected === i}
                onChange={() => setSelected(i)}
              />{" "}
              <span>{task}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p>保留已有优点，尝试把同一个意思说得更清楚。</p>
      )}
      <button
        className="button primary"
        disabled={disabled}
        onClick={() =>
          go(
            `/practice/${session.mode}?retry=${encodeURIComponent(session.id)}&focus=${selected}${session.thinkingModelId ? `&thinking=${encodeURIComponent(session.thinkingModelId)}` : ""}`,
          )
        }
      >
        针对这一点再练
      </button>
      {disabled && <p>先保存本次点评，再开始下一次。</p>}
    </section>
  );
}

export function AnalysisProgress({ message }: { message: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="analysis-progress" role="status">
      <strong>{message}</strong>
      <p>
        {seconds < 20
          ? "正在等待分析结果，请勿重复提交。"
          : "还在等待模型返回；耗时较长不代表内容丢失。"}{" "}
        已等待 {seconds} 秒。
      </p>
      <small>完成后会自动显示；如失败，可保留内容重试。</small>
    </div>
  );
}

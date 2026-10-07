import { useEffect, useId, useState } from "react";
import { ArrowRight, ArrowUpRight, CheckCircle } from "@phosphor-icons/react";
import { AudioPlayer, Report, go } from "./components";
import { AttemptComparison } from "./ScenarioReport";
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
  const selectedFocus = Math.min(selected, Math.max(0, tasks.length - 1));
  if (!session.feedback) return null;
  return (
    <section className="practice-next" aria-label="下一次怎么练">
      <span className="next-eyebrow">把反馈变成下一次表达</span>
      <h3>这次先改一个地方</h3>
      <p>不用重写全部内容。选一个重点，用同一道题再说一次。</p>
      {tasks.length ? (
        <fieldset>
          <legend>下一次的练习重点</legend>
          {tasks.map((task, i) => (
            <label key={i}>
              <input
                type="radio"
                name={`focus-${session.id}`}
                checked={selectedFocus === i}
                onChange={() => setSelected(i)}
              />
              <span>{task}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p>保留已有优点，尝试把同一个意思说得更清楚。</p>
      )}
      {session.feedback.rewrite && (
        <div className="next-example">
          <span>
            参考表达 ·{" "}
            {session.feedback.rewrite.length > 180 ? "节选" : "仅供参考"}
          </span>
          <blockquote>
            {session.feedback.rewrite.length > 180
              ? `${session.feedback.rewrite.slice(0, 180)}…`
              : session.feedback.rewrite}
          </blockquote>
          <small>示例是提示，不必逐字照读；事实需自己确认</small>
        </div>
      )}
      <button
        className="button primary"
        disabled={disabled}
        onClick={() =>
          go(
            `/practice/${session.mode}?retry=${encodeURIComponent(session.id)}&focus=${selectedFocus}${session.thinkingModelId ? `&thinking=${encodeURIComponent(session.thinkingModelId)}` : ""}`,
          )
        }
      >
        针对这一点再练 <ArrowRight size={18} />
      </button>
      <small className="next-duration">
        同题再练 {session.targetDuration || 60} 秒 · 两次练习分别保存
      </small>
      <small>保留话题、结构与本轮改进重点，练完后对照两次表达</small>
      {disabled && (
        <p className="next-disabled">
          先保存本次点评或文字修改，再开始下一次。
        </p>
      )}
    </section>
  );
}

export function FeedbackReview({
  session,
  disabled = false,
  onEdit,
  onViewTranscript,
}: {
  session: Session;
  disabled?: boolean;
  onEdit?: () => void;
  onViewTranscript?: () => void;
}) {
  const id = useId();
  const [section, setSection] = useState("feedback");
  const feedback = session.feedback;
  if (!feedback) return null;
  const target =
    feedback.checks?.find((c) => c.id === feedback.practiceTarget) ||
    feedback.checks?.find((c) => c.outcome === "needs_work");
  const dimension =
    feedback.dimensions.find(
      (d) => d.status === "partial" || d.status === "missing",
    ) || feedback.dimensions.find((d) => d.advice);
  const priority =
    feedback.improvements[0] || target?.task || dimension?.advice;
  const evidence = [
    ...new Set([
      ...(target?.evidence ? [target.evidence] : []),
      ...(dimension?.evidence || []),
      ...feedback.dimensions.flatMap((d) => d.evidence || []),
      ...(feedback.checks?.map((c) => c.evidence).filter(Boolean) || []),
    ]),
  ].slice(0, 2);
  const strengths = feedback.dimensions
    .filter((d) => d.status === "good")
    .map((d) => d.text);
  const clearChecks =
    feedback.checks?.filter((c) => c.outcome === "clear").map((c) => c.text) ||
    [];
  const keep = [...strengths, ...clearChecks].filter(Boolean).slice(0, 2);
  function showSection(name: string) {
    setSection(name);
    if (name === "transcript" && onViewTranscript) {
      onViewTranscript();
      return;
    }
    const element = document.getElementById(`${id}-${name}`);
    if (element instanceof HTMLDetailsElement) element.open = true;
    element?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  return (
    <div className="feedback-redesign">
      <nav className="feedback-tabs" aria-label="反馈内容导航">
        <button
          className={section === "feedback" ? "is-active" : ""}
          aria-current={section === "feedback" ? "location" : undefined}
          onClick={() => showSection("feedback")}
        >
          练习反馈
        </button>
        <button
          className={section === "transcript" ? "is-active" : ""}
          aria-current={section === "transcript" ? "location" : undefined}
          onClick={() => showSection("transcript")}
        >
          原文与录音
        </button>
        <button
          className={section === "comparison" ? "is-active" : ""}
          aria-current={section === "comparison" ? "location" : undefined}
          onClick={() => showSection("comparison")}
        >
          同题对比
        </button>
      </nav>
      <div className="feedback-coaching-grid" id={`${id}-feedback`}>
        <div className="feedback-coaching-content">
          <section className="feedback-priority">
            <span className="feedback-chip">
              {priority ? "本轮只改这一点" : "回顾这一次表达"}
            </span>
            <h2>{priority || feedback.summary}</h2>
            {priority && <p>{feedback.summary}</p>}
            {(target?.text || dimension?.text) && (
              <p className="feedback-grounding">
                {target?.text || dimension?.text}
              </p>
            )}
          </section>
          <section className="feedback-evidence">
            <h3>从你的表达里看到的</h3>
            {evidence.length ? (
              evidence.map((quote, i) => (
                <blockquote key={i}>{quote}</blockquote>
              ))
            ) : (
              <p className="feedback-empty-evidence">
                这份反馈没有定位到相关原话。可以回看完整文字，结合实际沟通目的判断。
              </p>
            )}
            <button
              className="text-button"
              onClick={() => showSection("transcript")}
            >
              查看我的完整表达 <ArrowUpRight size={15} />
            </button>
          </section>
          {keep.length > 0 && (
            <section className="feedback-strengths">
              <h3>
                <CheckCircle size={19} />
                值得保留
              </h3>
              {keep.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </section>
          )}
        </div>
        <PracticeNext session={session} disabled={disabled} />
      </div>
      <footer className="feedback-model-footer">
        <span className="feedback-chip">
          {feedback.provider === "agnes"
            ? "Agnes · 支持式反馈"
            : feedback.provider === "jev"
              ? "Jev · 场景规则判断"
              : feedback.source === "ai"
                ? "AI 表达反馈"
                : "基础自查"}
        </span>
        <button className="text-button" onClick={() => go("/settings")}>
          {window.desktopApp ? "切换 Agnes / Jev" : "查看服务配置说明"}{" "}
          <ArrowRight size={15} />
        </button>
        <span>
          {feedback.profileName
            ? `依据：${feedback.profileName}`
            : "根据本次表达文字生成"}
        </span>
        <button className="text-button" onClick={() => showSection("analysis")}>
          查看详细分析 ＋
        </button>
      </footer>
      <section id={`${id}-analysis`} className="feedback-full-analysis">
        <Report feedback={feedback} />
      </section>
      {!onViewTranscript && (
        <details
          id={`${id}-transcript`}
          className="feedback-transcript reference-details"
        >
          <summary>原文与录音</summary>
          <p>{session.transcript || "这条练习暂无转写文字。"}</p>
          <AudioPlayer blob={session.audio} />
          {session.preparationDraft && (
            <details>
              <summary>准备时的提纲</summary>
              <p>{session.preparationDraft}</p>
            </details>
          )}
          {onEdit && (
            <button
              className="button secondary"
              disabled={disabled}
              onClick={onEdit}
            >
              修改文字，再获取反馈
            </button>
          )}
        </details>
      )}
      <section id={`${id}-comparison`} className="feedback-comparison-section">
        {session.previousAttempt ? (
          <AttemptComparison session={session} />
        ) : (
          <div className="feedback-no-comparison">
            <h3>下一次，看看有什么变化</h3>
            <p>
              完成同题再练后，这里会展示两次真实表达。当前还没有上一轮可供对照。
            </p>
          </div>
        )}
      </section>
    </div>
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
          ? "正在等待处理结果，请勿重复提交。"
          : "还在等待服务返回；耗时较长不代表内容丢失。"}{" "}
        已等待 {seconds} 秒。
      </p>
      <small>完成后会自动显示；如失败，可保留内容重试。</small>
    </div>
  );
}

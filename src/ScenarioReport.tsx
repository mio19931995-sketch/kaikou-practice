import { useState } from "react";
import type { Feedback, Session } from "./types";
const labels: Record<string, string> = {
  clear: "已体现",
  needs_work: "待补充",
  insufficient: "需确认",
};
export function ScenarioReport({ feedback }: { feedback: Feedback }) {
  const checks = feedback.checks || [];
  const [selected, setSelected] = useState(
    feedback.practiceTarget || checks[0]?.id,
  );
  const active = checks.find((c) => c.id === selected) || checks[0];
  if (!active) return null;
  return (
    <section className="jev-visual" aria-label="Jev 场景检查">
      <header className="jev-heading">
        <div>
          <span className="jev-eyebrow">JEV · 场景训练</span>
          <h3>{feedback.profileName}</h3>
        </div>
        <small>
          {feedback.model} · {feedback.ruleVersion}
        </small>
      </header>
      <p className="jev-help">
        选中一项，查看相关原话和练习方向。未提及的内容不会自动补全。
      </p>
      <div className="jev-grid">
        {checks.map((c) => (
          <button
            type="button"
            key={c.id}
            aria-pressed={active.id === c.id}
            className={`jev-card ${active.id === c.id ? "is-selected" : ""}`}
            onClick={() => setSelected(c.id)}
          >
            <span className="jev-card-top">
              {c.title}
              <strong className={`jev-${c.outcome}`}>
                {labels[c.outcome]}
              </strong>
            </span>
          </button>
        ))}
      </div>
      <div className="jev-detail" aria-live="polite">
        <h4>{active.title}</h4>
        <p>{active.text}</p>
        <strong>模型定位的相关原话</strong>
        {active.evidence ? (
          <blockquote>{active.evidence}</blockquote>
        ) : (
          <p>未定位到相关原话。可回看全文确认；这本身不证明该要点缺失。</p>
        )}
        {active.outcome === "needs_work" && (
          <>
            <h4>这一项怎么练</h4>
            <p>{active.task}</p>
          </>
        )}
        <details>
          <summary>查看模型判断分布</summary>
          {Object.entries(
            feedback.judgments?.[active.id]?.probabilities || {},
          ).map(([id, p]) => (
            <p key={id}>
              {labels[id]}：{Math.round(p * 100)}%
            </p>
          ))}
          <small>概率表示判断倾向，不是表达分数，也不保证结论正确。</small>
        </details>
      </div>
      <p className="jev-help">
        检查结论与原话定位由模型判断；标准和训练提示来自应用规则。优先完成下方的一项任务，再修改文字生成点评。
      </p>
    </section>
  );
}
export function AttemptComparison({ session }: { session: Session }) {
  const old = session.previousAttempt,
    current = session.feedback;
  if (!old || !current) return null;
  const same =
    old.feedback.source === "ai" &&
    current.source === "ai" &&
    old.feedback.provider === current.provider &&
    old.feedback.model === current.model &&
    old.feedback.ruleVersion === current.ruleVersion &&
    old.feedback.ruleProfile === current.ruleProfile &&
    old.feedback.profileName === current.profileName;
  const dimensionsMatch =
    current.provider === "agnes" &&
    current.dimensions.every((d) =>
      old.feedback.dimensions.some(
        (o) => o.id === d.id && o.standard === d.standard,
      ),
    );
  const canCompare =
    same && (dimensionsMatch || Boolean(old.feedback.checks && current.checks));
  const statusLabels: Record<string, string> = {
    good: "已做到",
    partial: "需完善",
    missing: "未体现",
    unsure: "需确认",
    ...labels,
  };
  const rows = current.checks
    ? current.checks
        .map((c) => ({
          id: c.id,
          title: c.title,
          status: c.outcome,
          evidence: c.evidence ? [c.evidence] : [],
          text: c.text,
          previous: old.feedback.checks?.find((o) => o.id === c.id),
        }))
        .map((c) => ({
          ...c,
          beforeStatus: c.previous?.outcome,
          beforeEvidence: c.previous?.evidence ? [c.previous.evidence] : [],
          beforeText: c.previous?.text,
        }))
    : current.dimensions.map((c) => {
        const before = old.feedback.dimensions.find((o) => o.id === c.id);
        return {
          ...c,
          beforeStatus: before?.status,
          beforeEvidence: before?.evidence || [],
          beforeText: before?.text,
        };
      });
  return (
    <section className="attempt-comparison" aria-label="修改前后对比">
      <h3>{session.retryOf ? "同题再练 · 前后对比" : "修改前后 · 点评对比"}</h3>
      <p>
        {canCompare
          ? "同一套标准下的两次模型判断。变化不等于能力评分，也不代表声音表现。"
          : "模型或检查标准不同，暂不直接比较判断；可以对照两次文字。"}
      </p>
      {session.practiceFocus && (
        <p>
          <strong>这次练习重点：</strong>
          {session.practiceFocus}
        </p>
      )}
      {canCompare &&
        rows.map((d, i) => (
          <details key={d.id || i} open={i === 0}>
            <summary>
              {d.title}：{statusLabels[d.beforeStatus || "unsure"]} →{" "}
              {statusLabels[d.status || "unsure"]}
            </summary>
            <div className="comparison-columns">
              <div>
                <h4>上一次</h4>
                {d.beforeEvidence.length ? (
                  d.beforeEvidence.map((q, n) => (
                    <blockquote key={n}>{q}</blockquote>
                  ))
                ) : (
                  <p>未定位到相关原话，请结合全文判断。</p>
                )}
                <p>{d.beforeText}</p>
              </div>
              <div>
                <h4>这一次</h4>
                {d.evidence?.length ? (
                  d.evidence.map((q, n) => <blockquote key={n}>{q}</blockquote>)
                ) : (
                  <p>未定位到相关原话，请结合全文判断。</p>
                )}
                <p>{d.text}</p>
              </div>
            </div>
          </details>
        ))}
      <details>
        <summary>对照两次完整文字</summary>
        <div className="comparison-columns">
          <div>
            <h4>上一次</h4>
            <p>{old.transcript}</p>
          </div>
          <div>
            <h4>这一次</h4>
            <p>{session.transcript}</p>
          </div>
        </div>
      </details>
    </section>
  );
}

import { useState } from "react";
import type { Feedback, Session } from "./types";
const labels: Record<string, string> = { clear: "已体现", needs_work: "待补充", insufficient: "需确认" };
export function ScenarioReport({ feedback }: { feedback: Feedback }) {
  const checks = feedback.checks || [];
  const [selected, setSelected] = useState(feedback.practiceTarget || checks[0]?.id);
  const active = checks.find(c => c.id === selected) || checks[0];
  if (!active) return null;
  return <section className="jev-visual" aria-label="Jev 场景检查">
    <header className="jev-heading"><div><span className="jev-eyebrow">JEV · 场景训练</span><h3>{feedback.profileName}</h3></div><small>{feedback.model} · {feedback.ruleVersion}</small></header>
    <p className="jev-help">选中一项，查看相关原话和练习方向。未提及的内容不会自动补全。</p>
    <div className="jev-grid">{checks.map(c => <button type="button" key={c.id} aria-pressed={active.id === c.id} className={`jev-card ${active.id === c.id ? "is-selected" : ""}`} onClick={() => setSelected(c.id)}><span className="jev-card-top">{c.title}<strong className={`jev-${c.outcome}`}>{labels[c.outcome]}</strong></span></button>)}</div>
    <div className="jev-detail" aria-live="polite"><h4>{active.title}</h4><p>{active.text}</p><strong>模型定位的相关原话</strong>{active.evidence ? <blockquote>{active.evidence}</blockquote> : <p>未定位到相关原话。可回看全文确认；这本身不证明该要点缺失。</p>}
      {active.outcome === "needs_work" && <><h4>这一项怎么练</h4><p>{active.task}</p></>}
      <details><summary>查看模型判断分布</summary>{Object.entries(feedback.judgments?.[active.id]?.probabilities || {}).map(([id, p]) => <p key={id}>{labels[id]}：{Math.round(p * 100)}%</p>)}<small>概率表示判断倾向，不是表达分数，也不保证结论正确。</small></details>
    </div><p className="jev-help">检查结论与原话定位由模型判断；标准和训练提示来自应用规则。优先完成下方的一项任务，再修改文字生成点评。</p>
  </section>;
}
export function AttemptComparison({ session }: { session: Session }) {
  const old = session.previousAttempt, current = session.feedback;
  if (!old?.feedback.checks || !current?.checks || old.transcript === session.transcript) return null;
  if (old.feedback.ruleVersion !== current.ruleVersion || old.feedback.ruleProfile !== current.ruleProfile) return <p>检查标准已变化，本次不与上一版直接比较。</p>;
  return <section className="jev-visual" aria-label="修改前后对比"><h3>修改前后 · 同一套标准</h3><p>仅比较两版文字的模型判断，不代表录音表现或已经掌握。</p><div className="attempt-rows">{current.checks.map(c => <p key={c.id}><strong>{c.title}</strong><span>{labels[old.feedback.checks?.find(o => o.id === c.id)?.outcome || "insufficient"]} → {labels[c.outcome]}</span></p>)}</div><details><summary>回看上一版文字</summary><p>{old.transcript}</p></details></section>;
}

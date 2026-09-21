import { ScenarioReport } from "./ScenarioReport";
import { useState } from "react";
import type { Feedback } from "./types";

const dimensions = [ ["focus", "切题程度"], ["structure", "表达结构"], ["support", "内容支撑"], ["clarity", "文字清晰度"] ];
const options = [ ["clear", "较清楚"], ["needs_work", "建议加强"], ["insufficient", "信息不足"] ];
const percent = (value: number) => `${Math.round(value * 100)}%`;

export function JevReport({ feedback }: { feedback: Feedback }) {
  const [selected, setSelected] = useState("focus");
  const judgments = feedback.judgments;
  if (feedback.checks) return <ScenarioReport feedback={feedback} />;
  if (!judgments || dimensions.some(([id]) => !judgments[id])) return null;
  const index = dimensions.findIndex(([id]) => id === selected);
  const answer = judgments[selected];
  return <section className="jev-visual" aria-label="Jev 评估可视化">
    <header className="jev-heading"><div><span className="jev-eyebrow">JEV · 表达观察</span><h3>看见这一次的表达</h3></div><small>{feedback.model || "Jev"}</small></header>
    <div className="jev-counts">{options.map(([id, label]) => <span key={id} className={`jev-${id}`}><strong>{dimensions.filter(([key]) => judgments[key].choice === id).length}</strong> 项{label}</span>)}</div>
    <p className="jev-help">点击一个维度，查看模型判断与对应标准。</p>
    <div className="jev-grid">{dimensions.map(([id, title], i) => {
      const a = judgments[id];
      return <button key={id} type="button" className={`jev-card ${id === selected ? "is-selected" : ""}`} aria-pressed={id === selected} onClick={() => setSelected(id)}>
        <span className="jev-card-top"><span>0{i + 1} · {title}</span><strong className={`jev-${a.choice}`}>{options.find(([key]) => key === a.choice)?.[1]}</strong></span>
        <span className="jev-bar" role="img" aria-label={options.map(([key, label]) => `${label} ${percent(a.probabilities[key])}`).join("，")}>{options.map(([key]) => <span key={key} className={`jev-fill-${key}`} style={{ width: `${a.probabilities[key] * 100}%` }} />)}</span>
        <span className="jev-distribution">{options.map(([key, label]) => <span key={key}>{label}<b>{percent(a.probabilities[key])}</b></span>)}</span>
      </button>;
    })}</div>
    <div className="jev-detail" aria-live="polite"><h4>{dimensions[index][1]} · 判断标准</h4><p>{feedback.dimensions[index]?.text}</p><small>模型置信度 {percent(answer.confidence)}：表示选项分布的集中程度，不代表结论的准确率。</small></div>
    <p className="jev-help">色条展示三种判断的概率分布，不是表达得分。说明与练习建议由应用按固定标准提供。</p>
  </section>;
}

import type { RuleProfile } from "./types";
export function RuleSelector({ value, onChange, disabled }: { value: RuleProfile; onChange: (v: RuleProfile) => void; disabled?: boolean }) {
  return <label className="rule-selector">点评场景<select value={value} disabled={disabled} onChange={e => onChange(e.target.value as RuleProfile)}>
    <option value="auto">按题目匹配（复述练习使用复述标准）</option><option value="report">工作汇报 / 问题解决</option><option value="interview">面试 / 经历介绍</option><option value="persuade">观点表达 / 说服</option><option value="general">通用表达</option><option value="retell">复述原文（需要参考原文）</option>
  </select><small>Agnes 与 Jev 按此场景使用对应标准；复述需对照原文。</small></label>;
}

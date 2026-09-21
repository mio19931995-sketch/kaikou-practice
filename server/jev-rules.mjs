export const ruleVersion = "scenario-1";
const r = (id, title, met, missing, task) => ({ id, title, met, missing, task });
const focus = r("focus", "直接回答题目", "已点明题目涉及的事件或自己的观点。例如题目问项目延期，说“项目要延期了”即满足本项；原因和方案的完整性由其他项判断", "完全偏题，或没有说出事件或观点。不能因为原因或方案不充分就判本项缺失", "用一句话直接回答题目，再补充背景。");
const reason = r("reason", "解释具体原因", "给出具体原因，并解释它与结果的联系", "只说情况复杂、事情多等笼统理由，没有解释具体原因怎样导致结果", "补充一个具体原因，并说明它怎样影响结果；不确定的原因明确说待确认。");
const action = r("action", "提出可执行行动", "明确说出要做的具体事情，例如重新安排某项任务或协调某项资源。行动可被执行和检查", "没有具体行动，或只有再努力、加强沟通、尽快解决等口号；提到方案不等于有方案", "把“再努力一下”之类的意愿换成一个可执行动作。用真实信息补全：接下来准备做……。");
const owner = r("owner", "明确行动负责人", "明确说明哪个人、岗位或团队承担具体行动；与具体行动关联的我或我们也可以", "没有负责主体，或只有未关联具体行动的大家、相关人员", "补充谁负责这项行动；尚未落实就说明需要与谁确认。");
const time = r("time", "交代时间安排", "给出行动或交付的时间，或明确说明何时反馈尚未确定的时间", "未说明时间；尽快、以后、争取早点不算明确时间安排", "说明何时完成；不能确定完成日期时，说明何时提供下一次进度更新，不编造日期。");
const example = r("example", "提供具体支撑", "包含能支持观点的具体事件、事实、数据或例子，不要求必须有数字", "只有观点或泛泛理由，没有具体事实或例子支撑", "补充一个真实例子，说明它如何支持你的观点。");
const close = r("close", "收束核心观点", "结尾回到核心观点，或说明希望对方采取的下一步行动", "结尾停在细节中，没有回到主旨或明确下一步", "用一句话收住重点，或明确希望对方做什么。");
export const profiles = {
 report: { name: "工作汇报 / 问题解决", rules: [focus, reason, action, owner, time] },
 interview: { name: "面试 / 经历介绍", rules: [r("context", "交代情境与任务", "说明具体情境及需要完成的任务", "没有情境或任务，难以理解经历", "先说明面对什么任务或困难。"), r("action", "说清个人行动", "明确描述本人做了什么具体行动", "只有团队成果或努力等口号，未交代本人行动", "用“我做了……”说清自己的具体贡献。"), r("result", "说明实际结果", "说明可观察的结果，可以是成功、失败或尚无结果，不强求数字", "只有过程，没有说明结果", "补充行动后发生了什么，不确定的结果如实说明。"), r("reflection", "提炼经验", "指出学到的具体方法或教训", "没有总结，或只有受益匪浅等空话", "补充下次会继续采用或调整的一项做法。")] },
 persuade: { name: "观点表达 / 说服", rules: [focus, reason, example, r("concern", "回应对方顾虑", "指出相关成本、风险或对方顾虑，并给出回应", "只有自己观点，未考虑对方顾虑", "站在对方角度提出一个顾虑，再说明如何应对。"), close] },
 retell: { name: "复述原文", rules: [r("main", "保留原文主旨", "准确保留 material 的中心意思", "遗漏或歪曲原文中心意思", "先用一句话复述原文的中心意思。"), r("facts", "保留关键事实", "保留理解原文所需的关键事实和关系，不要求保留所有细节", "遗漏会改变理解的关键事实或关系", "对照原文补全关键人物、事件和因果关系。"), r("faithful", "没有添加无依据信息", "没有引入 material 未支持的事实、日期或因果关系", "添加原文未支持的信息，或把不确定信息说成确定事实", "删除原文没有依据的细节，区分原文内容与自己的推测。"), r("concise", "压缩重复内容", "保留必要信息且没有明显重复", "多次重复同一信息而没有增加意义", "合并重复信息，保留主旨和必要事实。")] },
 general: { name: "通用表达", rules: [focus, reason, example, close] },
};
export function profileFor(input) {
 if (input.mode === "retell") return "retell";
 if (input.ruleProfile && input.ruleProfile !== "auto") return input.ruleProfile;
 if (/汇报|延期|进度|项目|故障|问题解决/.test(input.topic)) return "report";
 if (/面试|介绍自己|自我介绍|经历/.test(input.topic)) return "interview";
 if (/说服|建议|观点|支持|反对/.test(input.topic)) return "persuade";
 return "general";
}
export function segmentsFor(text) {
 const parts = text.match(/[^。！？\n]+[。！？\n]*/gu) || [text];
 const size = Math.max(1, Math.ceil(parts.length / 40));
 const segments = {};
 for (let i = 0; i < parts.length; i += size) segments[`s${Object.keys(segments).length + 1}`] = parts.slice(i, i + size).join("");
 return segments;
}

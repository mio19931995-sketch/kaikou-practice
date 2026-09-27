import { thinkingPractice } from "./thinkingPractice";

export function EverydayCase({ id }: { id: string }) {
  const lesson = thinkingPractice[id];
  if (!lesson) return null;
  const example = lesson.everyday;
  return (
    <section id="lesson-everyday" className="lesson-everyday">
      <span className="lesson-kicker">看例子 · 生活</span>
      <h2>{example.title}</h2>
      <p className="lesson-background">原创教学情境：{example.setup}</p>
      <dl className="everyday-steps">
        {example.steps.map(([title, detail]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>
      <p className="lesson-takeaway">
        <strong>什么时候要换个判断： </strong>
        {example.boundary}
      </p>
    </section>
  );
}

export function ThinkingPractice({ id }: { id: string }) {
  const lesson = thinkingPractice[id];
  if (!lesson) return null;
  return (
    <section id="lesson-practice" className="lesson-practice">
      <span className="lesson-kicker">自己试 · 独立做一次（写）</span>
      <h2>从看懂，到自己能用</h2>
      <p>
        先写自己的判断，再展开参考思路。练习为教学情境，参考解法不是唯一答案。
      </p>
      <div className="practice-task">
        <strong>这次的任务</strong>
        <p>{lesson.task}</p>
      </div>
      <h3>按这些问题写下来</h3>
      <ol className="practice-prompts">
        {lesson.template.map((prompt) => (
          <li key={prompt}>{prompt.replace(/：$/, "")}</li>
        ))}
      </ol>
      <button
        className="button secondary"
        onClick={() => {
          const editor = document.getElementById("thinking-note");
          editor?.scrollIntoView({ behavior: "smooth", block: "center" });
          editor?.focus({ preventScroll: true });
        }}
      >
        去笔记里作答
      </button>
      <p className="practice-note">
        笔记区可加入本课模板；写完请点击“保存笔记”。
      </p>
      <details className="practice-solution">
        <summary>写完后，查看参考思路</summary>
        <p>{lesson.solution}</p>
      </details>
      <h3>怎样检查自己是否用对了</h3>
      <ul className="lesson-checklist">
        {lesson.criteria.map((criterion) => (
          <li key={criterion}>{criterion}</li>
        ))}
      </ul>
      <p>
        如果只写了“加强沟通”“多考虑一下”，还需要补上具体对象、依据和动作。此处提供自查依据，不会自动判定你已掌握。
      </p>
      <p className="practice-note">
        写完之后，到本课末尾「用这个框架说 60 秒」把它说出来。
      </p>
    </section>
  );
}

export function ThinkingSources({ id }: { id: string }) {
  const lesson = thinkingPractice[id];
  if (!lesson) return null;
  return (
    <footer id="lesson-sources" className="thinking-source">
      <h2>依据与延伸阅读</h2>
      <p>
        核对日期：2026-09-25。来源用于核对概念；案例、数字、模板和参考解法为本应用的教学改编，不是原作者案例或实际效果数据。
      </p>
      <ul>
        {lesson.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title} ↗
            </a>
            <p>{source.note}</p>
          </li>
        ))}
      </ul>
      <p>
        本库是入门选编，并非“芒格官方模型清单”。会做本课练习不等于能熟练处理所有真实问题。
      </p>
    </footer>
  );
}

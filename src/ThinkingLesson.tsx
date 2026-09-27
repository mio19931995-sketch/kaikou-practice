import { useState } from "react";
import { thinkingLessons } from "./thinkingLessons";
import { ThinkingIllustration } from "./ThinkingIllustration";
import { thinkingPractice } from "./thinkingPractice";
import { EverydayCase, ThinkingPractice } from "./ThinkingApplications";

// 展开对应的折叠区，再滚动到目标位置
export function openGroup(group: string, anchor?: string) {
  const details = document.getElementById(
    group === "sources" ? "lesson-sources-group" : `lesson-group-${group}`,
  );
  if (details instanceof HTMLDetailsElement) details.open = true;
  requestAnimationFrame(() =>
    document
      .getElementById(anchor ? `lesson-${anchor}` : `lesson-group-${group}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
}

export function ThinkingLesson({ id }: { id: string }) {
  const lesson = thinkingLessons[id];
  const [selected, setSelected] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [caseTab, setCaseTab] = useState<"life" | "work">("life");
  if (!lesson) return null;
  return (
    <div className="thinking-lesson">
      <div className="lesson-deep-heading">
        <span className="thinking-eyebrow">深入了解 · 按需展开</span>
        <h2>看懂 → 看例子 → 自己试 → 过几天复习</h2>
      </div>
      <nav className="lesson-index" aria-label="本课目录">
        {(
          [
            ["picture", "知识图", "understand"],
            ["understand", "理解原理", "understand"],
            ["diagram", "看图理解", "understand"],
            ["case", "案例拆解", "examples"],
            ["everyday", "生活案例", "examples"],
            ["quiz", "检验理解", "try"],
            ["practice", "动手练习", "try"],
            ["sources", "资料依据", "sources"],
          ] as const
        ).map(([anchor, label, group]) => (
          <button
            key={anchor}
            onClick={() => {
              if (anchor === "case") setCaseTab("work");
              if (anchor === "everyday") setCaseTab("life");
              openGroup(group, anchor);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="lesson-outcome">
        <strong>学完这课，你要能做到</strong>
        <p>{thinkingPractice[id]?.outcome}</p>
        <span>先用上面的速用卡 → 需要时展开下面四步 → 用这个框架说 60 秒</span>
      </div>
      <details className="lesson-group" id="lesson-group-understand">
        <summary>
          <span>① 看懂</span>原理、比喻、易混概念与交互图解
        </summary>
        <ThinkingIllustration key={id} id={id} />
        <section id="lesson-understand">
          <span className="lesson-kicker">看懂 · 理解原理</span>
          <h2>它到底在帮你做什么？</h2>
          <p>{lesson.intro}</p>
          <div className="lesson-distinction">
            <strong>容易混淆的概念</strong>
            <p>{thinkingPractice[id]?.distinction}</p>
          </div>
          <div className="lesson-analogy">
            <strong>用一个比喻理解</strong>
            <p>{lesson.analogy}</p>
          </div>
        </section>
        <section id="lesson-diagram">
          <span className="lesson-kicker">看懂 · 交互图解</span>
          <h2>点一点，把思路看清楚</h2>
          <figure className="lesson-figure">
            <div
              className={`lesson-visual visual-${lesson.visual}`}
              aria-label="框架图解步骤"
            >
              {lesson.nodes.map(([name], index) => (
                <button
                  key={name}
                  className={`visual-node node-${index}`}
                  aria-pressed={selected === index}
                  aria-controls="lesson-node-explanation"
                  onClick={() => setSelected(index)}
                >
                  <span className="visual-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{name}</strong>
                  {lesson.visual === "flow" &&
                    index < lesson.nodes.length - 1 && (
                      <span className="visual-arrow" aria-hidden="true">
                        →
                      </span>
                    )}
                </button>
              ))}
              {lesson.visual === "cycle" && (
                <div className="cycle-center" aria-hidden="true">
                  ↻<span>循环影响</span>
                </div>
              )}
            </div>
            <figcaption>{lesson.caption}</figcaption>
          </figure>
          <div
            id="lesson-node-explanation"
            className="lesson-explanation"
            aria-live="polite"
          >
            <strong>{lesson.nodes[selected][0]}</strong>
            <p>{lesson.nodes[selected][1]}</p>
          </div>
        </section>
      </details>
      <details className="lesson-group" id="lesson-group-examples">
        <summary>
          <span>② 看例子</span>生活案例 / 职场案例，二选一看
        </summary>
        <div className="lesson-tabs" role="tablist" aria-label="案例类型">
          <button
            role="tab"
            aria-selected={caseTab === "life"}
            onClick={() => setCaseTab("life")}
          >
            生活中的例子
          </button>
          <button
            role="tab"
            aria-selected={caseTab === "work"}
            onClick={() => setCaseTab("work")}
          >
            职场中的例子
          </button>
        </div>
        {caseTab === "life" ? (
          <EverydayCase id={id} />
        ) : (
          <section id="lesson-case">
            <span className="lesson-kicker">看例子 · 职场</span>
            <h2>{lesson.caseTitle}</h2>
            <p className="lesson-background">{lesson.background}</p>
            <ol className="lesson-walkthrough">
              {lesson.walkthrough.map(([title, detail], index) => (
                <li key={title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="lesson-comparison">
              <div>
                <span>常见的想法</span>
                <p>{lesson.before}</p>
              </div>
              <div>
                <span>运用框架后</span>
                <p>{lesson.after}</p>
              </div>
            </div>
            <p className="lesson-takeaway">
              <strong>这个案例要带走的： </strong>
              {lesson.takeaway}
            </p>
          </section>
        )}
      </details>
      <details className="lesson-group" id="lesson-group-try">
        <summary>
          <span>③ 自己试</span>检验理解、换个问题、独立写一次
        </summary>
        <section id="lesson-quiz">
          <span className="lesson-kicker">自己试 · 检验理解</span>
          <h2>你会怎么判断？</h2>
          <p>{lesson.quiz.question}</p>
          <div className="lesson-options">
            {lesson.quiz.options.map((option, index) => (
              <button
                key={option}
                aria-pressed={answer === index}
                onClick={() => setAnswer(index)}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                {option}
              </button>
            ))}
          </div>
          {answer !== null && (
            <div
              className={`lesson-answer ${answer === lesson.quiz.correct ? "is-correct" : "try-again"}`}
              role="status"
            >
              <strong>
                {answer === lesson.quiz.correct ? "理解到位" : "再想一步"}
              </strong>
              <p>{lesson.quiz.reasons[answer]}</p>
              {answer !== lesson.quiz.correct && (
                <small>可以重新选择，比较不同答案的理由。</small>
              )}
            </div>
          )}
        </section>
        <section>
          <span className="lesson-kicker">自己试 · 迁移应用</span>
          <h2>换个问题，你还会用吗？</h2>
          <p>{lesson.transfer}</p>
          <h3>应用前自查</h3>
          <ul className="lesson-checklist">
            {lesson.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            把自己的问题和判断写进「我的思考笔记」，检查上面三点是否都有具体答案。自测选对不等于已经掌握，试着在真实问题中应用一次。
          </p>
        </section>
        <ThinkingPractice id={id} />
      </details>
    </div>
  );
}

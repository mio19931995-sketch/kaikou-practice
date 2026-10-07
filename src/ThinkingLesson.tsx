import { useState } from "react";
import type { KeyboardEvent } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { go } from "./components";
import { thinkingModels } from "./thinkingData";
import { thinkingLessons } from "./thinkingLessons";
import { ThinkingIllustration } from "./ThinkingIllustration";
import { thinkingPractice } from "./thinkingPractice";
import { EverydayCase, ThinkingPractice } from "./ThinkingApplications";

// Open only the requested deeper section; the diagram and examples remain visible.
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

function handleTabKey(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const current = tabs.indexOf(event.target as HTMLButtonElement);
  if (current < 0) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
  tabs[next]?.focus();
  tabs[next]?.click();
}

export function ThinkingLesson({ id }: { id: string }) {
  const lesson = thinkingLessons[id];
  const model = thinkingModels.find((item) => item.id === id);
  const practice = thinkingPractice[id];
  const [selected, setSelected] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [preview, setPreview] = useState<"work" | "life" | "principle">("work");
  const [caseTab, setCaseTab] = useState<"life" | "work">("work");
  if (!lesson || !model) return null;
  return (
    <div className="thinking-lesson">
      <section id="lesson-diagram" className="lesson-diagram-card">
        <h2>
          {lesson.visual === "pyramid"
            ? "把信息放进一个清楚的结构"
            : "把思路一步步看清楚"}
        </h2>
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
          className={`lesson-explanation ${selected === null ? "is-hint" : ""}`}
          aria-live="polite"
        >
          {selected === null ? (
            <p>点击任一节点，查看这一步在整个方法中的作用</p>
          ) : (
            <>
              <strong>{lesson.nodes[selected][0]}</strong>
              <p>{lesson.nodes[selected][1]}</p>
            </>
          )}
        </div>
      </section>
      <section className="lesson-example-card">
        <div
          className="lesson-tabs"
          role="tablist"
          aria-label="快速理解"
          onKeyDown={handleTabKey}
        >
          {(
            [
              ["work", "工作例子"],
              ["life", "生活例子"],
              ["principle", "深入了解"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              id={`preview-tab-${value}`}
              role="tab"
              aria-selected={preview === value}
              tabIndex={preview === value ? 0 : -1}
              aria-controls="lesson-preview-panel"
              onClick={() => setPreview(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          id="lesson-preview-panel"
          role="tabpanel"
          aria-labelledby={`preview-tab-${preview}`}
        >
          <p className="lesson-preview-text">
            {preview === "work"
              ? `“${lesson.after}”`
              : preview === "life"
                ? practice?.everyday.setup
                : lesson.intro}
          </p>
        </div>
        <button
          className="lesson-question-link"
          onClick={() => openGroup("try", "quiz")}
        >
          想一想：{lesson.quiz.question} <ArrowRight size={17} />
        </button>
      </section>
      <div className="lesson-next" id="lesson-speak">
        <button
          className="button primary"
          onClick={() => go(`/practice/logic?thinking=${id}`)}
        >
          用这个框架说 60 秒 <ArrowRight size={18} />
        </button>
        <button
          className="lesson-next-step"
          onClick={() => openGroup("try", "quiz")}
        >
          继续：选择题 → 迁移练习
        </button>
      </div>
      <p className="lesson-practice-disclosure">
        进入练习后可调整时长。保存有效练习后才记为「已练」，笔记不会自动提交
        AI。
      </p>
      <div className="lesson-deep-heading">
        <h2>想再了解一点？</h2>
        <span>按需展开，把方法用在自己的问题上</span>
      </div>
      <nav className="lesson-index" aria-label="本课目录">
        {(
          [
            ["picture", "知识图", "understand"],
            ["understand", "理解原理", "understand"],
            ["diagram", "看图理解", "diagram"],
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
        <p>{practice?.outcome}</p>
      </div>
      <details className="lesson-group" id="lesson-group-understand">
        <summary>
          <span>① 看懂</span>原理、知识图与使用步骤
        </summary>
        <ThinkingIllustration key={id} id={id} />
        <section id="lesson-understand">
          <span className="lesson-kicker">理解原理</span>
          <h2>它到底在帮你做什么？</h2>
          <p>{lesson.intro}</p>
          <div className="lesson-distinction">
            <strong>容易混淆的概念</strong>
            <p>{practice?.distinction}</p>
          </div>
          <div className="lesson-analogy">
            <strong>用一个比喻理解</strong>
            <p>{lesson.analogy}</p>
          </div>
          <h3>{model.steps.length} 步用起来</h3>
          <ol className="thinking-steps">
            {model.steps.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <h3>填空模板</h3>
          <ul className="quick-template">
            {practice?.template.map((prompt) => (
              <li key={prompt}>{prompt.replace(/[：:]$/, "")}：＿＿＿＿</li>
            ))}
          </ul>
          <h3>再看一个例子</h3>
          <p className="quick-example">{model.example}</p>
        </section>
      </details>
      <details className="lesson-group" id="lesson-group-examples">
        <summary>
          <span>② 看例子</span>生活与工作中的完整拆解
        </summary>
        <div
          className="lesson-tabs"
          role="tablist"
          aria-label="案例类型"
          onKeyDown={handleTabKey}
        >
          <button
            role="tab"
            id="case-work-tab"
            aria-controls="case-panel"
            aria-selected={caseTab === "work"}
            tabIndex={caseTab === "work" ? 0 : -1}
            onClick={() => setCaseTab("work")}
          >
            职场中的例子
          </button>
          <button
            role="tab"
            id="case-life-tab"
            aria-controls="case-panel"
            aria-selected={caseTab === "life"}
            tabIndex={caseTab === "life" ? 0 : -1}
            onClick={() => setCaseTab("life")}
          >
            生活中的例子
          </button>
        </div>
        <div
          id="case-panel"
          role="tabpanel"
          aria-labelledby={`case-${caseTab}-tab`}
        >
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
        </div>
      </details>
      <details className="lesson-group" id="lesson-group-try">
        <summary>
          <span>③ 自己试</span>检验理解，再换个问题用一次
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
            把自己的问题和判断写进「我的学习笔记」。自测选对不等于已经掌握，试着在真实问题中应用一次。
          </p>
        </section>
        <ThinkingPractice id={id} />
      </details>
    </div>
  );
}

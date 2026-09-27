import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookmarkSimple,
  MagnifyingGlass,
  BookOpen,
} from "@phosphor-icons/react";
import { BottomNav, Header, go, setNavigationGuard } from "./components";
import { thinkingCategories, thinkingModels } from "./thinkingData";
import "./thinking.css";
import { ThinkingLesson } from "./ThinkingLesson";
import { frameworks } from "./data";
import {
  advancedIds,
  isProgress,
  learningPath,
  reviewState,
  sayLayer,
  stateLabel,
  thinkLayer,
  type Progress,
} from "./thinkingPath";
import { thinkingPractice } from "./thinkingPractice";
import { ThinkingSources } from "./ThinkingApplications";
import type { Session } from "./types";

const storageKey = "kaikou.thinking.v1";
type Notebook = {
  favorites: string[];
  notes: Record<string, string>;
  progress?: Record<string, Progress>;
};
const structureName = (id: string) =>
  frameworks.find((f) => f.id === id)?.name || id;
const baseStructures = frameworks.slice(0, 8);
function readNotebook(): { value: Notebook; error: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { value: { favorites: [], notes: {} }, error: "" };
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed.favorites) ||
      !parsed.favorites.every((x: unknown) => typeof x === "string") ||
      !parsed.notes ||
      typeof parsed.notes !== "object" ||
      Array.isArray(parsed.notes) ||
      !Object.values(parsed.notes).every((x) => typeof x === "string") ||
      (parsed.progress !== undefined &&
        (!parsed.progress ||
          typeof parsed.progress !== "object" ||
          Array.isArray(parsed.progress) ||
          !Object.values(parsed.progress).every(isProgress)))
    )
      throw new Error("invalid");
    return { value: parsed, error: "" };
  } catch {
    return {
      value: { favorites: [], notes: {} },
      error:
        "本机笔记暂时无法读取。仍可浏览框架；请先备份现有浏览器数据，再尝试保存。",
    };
  }
}

export function ThinkingLibrary({
  modelId,
  sessions,
}: {
  modelId: string | null;
  sessions: Session[];
}) {
  const [initial] = useState(readNotebook);
  const [notebook, setNotebook] = useState(initial.value);
  const [error, setError] = useState(initial.error);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const model = thinkingModels.find((m) => m.id === modelId);
  const update = (next: Notebook): boolean => {
    try {
      if (initial.error) throw new Error("unreadable");
      localStorage.setItem(storageKey, JSON.stringify(next));
      setNotebook(next);
      setError("");
      return true;
    } catch {
      setError(
        "未能保存到本机，输入内容仍保留在当前页面。请复制笔记备份，并检查存储权限或空间后重试。",
      );
      return false;
    }
  };
  const favorite = (id: string) =>
    update({
      ...notebook,
      favorites: notebook.favorites.includes(id)
        ? notebook.favorites.filter((x) => x !== id)
        : [...notebook.favorites, id],
    });
  const progress = notebook.progress || {};
  const setProgress = (id: string, next: Progress) =>
    update({ ...notebook, progress: { ...progress, [id]: next } });
  const statusOf = (id: string) => reviewState(progress[id]);
  const dueModels = thinkingModels.filter(
    (m) => statusOf(m.id).state === "due",
  );
  const filtered =
    Boolean(query.trim()) || category !== "全部" || onlyFavorites;
  const card = (m: (typeof thinkingModels)[number]) => {
    const st = statusOf(m.id).state;
    return (
      <article className="thinking-card" key={m.id}>
        <div className="thinking-card-top">
          <span>{m.category}</span>
          <span className="thinking-card-status">
            {sessions.some(
              (s) =>
                s.thinkingModelId === m.id &&
                (s.audio || s.transcript.trim().length >= 5),
            ) && <em className="status-chip">已练</em>}
            <em className={`status-chip is-${st}`}>{stateLabel[st]}</em>
            <button
              aria-label={`${notebook.favorites.includes(m.id) ? "取消收藏" : "收藏"}${m.name}`}
              aria-pressed={notebook.favorites.includes(m.id)}
              onClick={() => favorite(m.id)}
            >
              <BookmarkSimple
                size={22}
                weight={notebook.favorites.includes(m.id) ? "fill" : "regular"}
              />
            </button>
          </span>
        </div>
        <a
          href={`#/thinking?model=${m.id}`}
          onClick={(e) => {
            e.preventDefault();
            go(`/thinking?model=${m.id}`);
          }}
        >
          <h2>{m.question}</h2>
          <p>{m.summary}</p>
          <div className="thinking-card-bottom">
            <strong>{m.name}</strong>
            <ArrowRight size={20} />
          </div>
        </a>
      </article>
    );
  };
  const byId = (ids: string[]) =>
    ids
      .map((id) => thinkingModels.find((m) => m.id === id))
      .filter((m): m is (typeof thinkingModels)[number] => Boolean(m));
  const needle = query.trim().toLocaleLowerCase();
  const matches = thinkingModels.filter(
    (m) =>
      (category === "全部" || m.category === category) &&
      (!onlyFavorites || notebook.favorites.includes(m.id)) &&
      [m.name, m.category, m.question, m.summary, m.when, m.example]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
  );
  return (
    <>
      <Header title="思维框架" back={modelId ? "/thinking" : "/"} />
      <main className="thinking-page">
        {error && (
          <p className="thinking-error" role="alert">
            {error}
          </p>
        )}
        {modelId && !model ? (
          <section className="thinking-empty">
            <h1>没有找到这个框架</h1>
            <button
              className="button secondary"
              onClick={() => go("/thinking")}
            >
              返回框架库
            </button>
          </section>
        ) : model ? (
          <>
            <button className="thinking-back" onClick={() => go("/thinking")}>
              ← 全部思维框架
            </button>
            <div className="thinking-detail-heading">
              <div>
                <span className="thinking-eyebrow">
                  {model.category} · 方法指南
                </span>
                <h1>{model.name}</h1>
                <p>{model.summary}</p>
              </div>
              <button
                className="thinking-save"
                aria-pressed={notebook.favorites.includes(model.id)}
                onClick={() => favorite(model.id)}
              >
                <BookmarkSimple
                  size={20}
                  weight={
                    notebook.favorites.includes(model.id) ? "fill" : "regular"
                  }
                />
                {notebook.favorites.includes(model.id) ? "已收藏" : "收藏框架"}
              </button>
            </div>
            <div className="thinking-detail-grid">
              <article className="thinking-article">
                <section id="lesson-quick" className="quick-card">
                  <div className="quick-card-head">
                    <span className="thinking-eyebrow">
                      速用卡 · 先了解用法
                    </span>
                    <em
                      className={`status-chip is-${statusOf(model.id).state}`}
                    >
                      {stateLabel[statusOf(model.id).state]}
                    </em>
                  </div>
                  <h3>是什么</h3>
                  <p>{model.summary}</p>
                  <h2>什么时候用</h2>
                  <p>{model.when}</p>
                  <h3>{model.steps.length} 步用起来</h3>
                  <ol className="thinking-steps">
                    {model.steps.map((step, i) => (
                      <li key={step}>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <p>{step}</p>
                      </li>
                    ))}
                  </ol>
                  {!!thinkingPractice[model.id]?.template.length && (
                    <>
                      <h3>填空模板</h3>
                      <ul className="quick-template">
                        {thinkingPractice[model.id].template.map((t) => (
                          <li key={t}>{t.replace(/[：:]$/, "")}：＿＿＿＿</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <h3>一个例子</h3>
                  <p className="quick-example">{model.example}</p>
                  <div className="thinking-boundary">
                    <strong>使用边界</strong>
                    <p>{model.limit}</p>
                  </div>
                  {!progress[model.id]?.learnedAt && (
                    <button
                      className="button secondary quick-learned"
                      onClick={() =>
                        setProgress(model.id, {
                          ...progress[model.id],
                          learnedAt: new Date().toISOString(),
                        })
                      }
                    >
                      我看懂了，3 天后提醒我复习
                    </button>
                  )}
                </section>
                <ThinkingLesson key={model.id} id={model.id} />
                <details className="lesson-group" id="lesson-group-mistake">
                  <summary>
                    <span>补充</span>随用随查：容易用错的地方
                  </summary>
                  <p>{model.mistake}</p>
                </details>
                <details className="lesson-group" id="lesson-sources-group">
                  <summary>
                    <span>补充</span>资料依据与延伸阅读
                  </summary>
                  <ThinkingSources id={model.id} />
                </details>
                <ReviewBlock
                  progress={progress[model.id]}
                  revisit={thinkingPractice[model.id]?.revisit || ""}
                  save={(next) => setProgress(model.id, next)}
                />
                <section className="speak-entry" id="lesson-speak">
                  <span className="thinking-eyebrow">
                    ④ 说出来 · 想清楚之后
                  </span>
                  <h2>用这个框架说 60 秒</h2>
                  <p>
                    带着本课的应用题和步骤开口。Agnes 将检查「{model.name}
                    」的运用依据与适用条件，思考笔记不会自动提交。
                  </p>
                  <button
                    className="button primary"
                    onClick={() => {
                      go(`/practice/logic?thinking=${model.id}`);
                    }}
                  >
                    用这个框架说 60 秒
                  </button>
                  <small>
                    默认 60 秒，可选择 30 / 90 / 180
                    秒。保存完成的练习后才显示“已练”；也可继续只做书面学习。
                  </small>
                </section>
              </article>
              <aside className="thinking-notebook">
                <span className="thinking-eyebrow">把方法用在自己的事情上</span>
                <h2>我的思考笔记</h2>
                <p>{model.prompt}</p>
                <ModelNote
                  key={model.id}
                  template={thinkingPractice[model.id]?.template || []}
                  saved={notebook.notes[model.id] || ""}
                  save={(note) =>
                    update({
                      ...notebook,
                      notes: { ...notebook.notes, [model.id]: note },
                    })
                  }
                />
                <small>
                  仅保存到此设备，不会发送给 AI。可独立学习，无需录音。
                </small>
              </aside>
            </div>
          </>
        ) : (
          <>
            <section className="thinking-hero">
              <div>
                <span className="thinking-eyebrow">
                  想清楚 → 说清楚 → 说出来
                </span>
                <h1>
                  遇到问题，
                  <br />
                  换一种思考方式。
                </h1>
                <p>
                  从你正在面对的事出发，找到适合的方法。
                  <br />
                  每课先给一张速用卡，学完直接用它说 60 秒，过几天再回来复习。
                </p>
              </div>
              <div className="thinking-hero-note">
                <BookOpen size={30} />
                <strong>{thinkingModels.length} 个精选框架</strong>
                <span>主路径 6 个 · 进阶 6 个</span>
                <small>每课含填写模板、参考思路与资料依据。</small>
              </div>
            </section>
            <div className="thinking-tools">
              <label className="thinking-search">
                <MagnifyingGlass size={22} />
                <input
                  aria-label="搜索思维框架"
                  placeholder="搜问题或方法，例如：决策、风险、反馈"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button
                className="thinking-save"
                aria-pressed={onlyFavorites}
                onClick={() => setOnlyFavorites(!onlyFavorites)}
              >
                <BookmarkSimple size={20} />
                我的收藏 {notebook.favorites.length}
              </button>
            </div>
            <div className="thinking-filters" aria-label="框架分类">
              {thinkingCategories.map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="thinking-count" role="status">
              {matches.length} 个框架
              {onlyFavorites
                ? " · 仅显示已收藏"
                : filtered
                  ? " · 选择一个你正在遇到的问题"
                  : " · 按「想清楚 → 说清楚 → 说出来」排列"}
            </p>
            {filtered ? (
              <div className="thinking-cards">
                {matches.map((m) => card(m))}
              </div>
            ) : (
              <>
                {dueModels.length > 0 && (
                  <section className="review-banner" role="status">
                    <strong>今天该复习 {dueModels.length} 个</strong>
                    {dueModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => go(`/thinking?model=${m.id}`)}
                      >
                        {m.name} →
                      </button>
                    ))}
                  </section>
                )}
                <section className="thinking-path" aria-label="学习路径">
                  <h2>学习路径 · 从最常用开始</h2>
                  <ol>
                    {learningPath.map((unit, i) => (
                      <li key={unit.title} className="path-unit">
                        <span className="path-no">单元 {i + 1}</span>
                        <h3>{unit.title}</h3>
                        <div className="path-nodes">
                          {byId(unit.models).map((m) => (
                            <button
                              key={m.id}
                              className="path-node"
                              onClick={() => go(`/thinking?model=${m.id}`)}
                            >
                              {m.name}
                              <em>{stateLabel[statusOf(m.id).state]}</em>
                            </button>
                          ))}
                          {unit.structures.map((id) => (
                            <button
                              key={id}
                              className="path-node is-structure"
                              onClick={() => go("/logic")}
                            >
                              {structureName(id)}
                              <em>表达结构</em>
                            </button>
                          ))}
                          <button
                            className="path-node is-practice"
                            onClick={() =>
                              go(`/practice/logic?thinking=${unit.models[0]}`)
                            }
                          >
                            说 60 秒<em>练习</em>
                          </button>
                          <span className="path-node is-review">
                            复习
                            <em>
                              {unit.models.some(
                                (id) => statusOf(id).state === "due",
                              )
                                ? "有待复习"
                                : "学完 3 天后"}
                            </em>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
                <section className="thinking-layer">
                  <div className="layer-head">
                    <span>第 1 层</span>
                    <h2>想清楚 · 思维框架</h2>
                    <p>先弄明白问题和选择，再决定要说什么。</p>
                  </div>
                  <div className="thinking-cards">
                    {byId(thinkLayer).map((m) => card(m))}
                  </div>
                </section>
                <section className="thinking-layer">
                  <div className="layer-head">
                    <span>第 2 层</span>
                    <h2>说清楚 · 表达结构</h2>
                    <p>
                      思维方法与表达结构各有用途。可以按任务选择，它们并非一一对应，也不需要每次套同一种格式。
                    </p>
                  </div>
                  <div className="thinking-cards">
                    {byId(sayLayer).map((m) => card(m))}
                  </div>
                  <div className="layer-structures" aria-label="逻辑表达结构">
                    {baseStructures.map((f) => (
                      <button key={f.id} onClick={() => go("/logic")}>
                        {f.name}
                        <small>{f.steps.join(" → ")}</small>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="thinking-layer is-speak">
                  <div className="layer-head">
                    <span>第 3 层</span>
                    <h2>说出来 · 开口练习</h2>
                    <p>
                      每课末尾都有「用这个框架说 60
                      秒」：自动带入对应的表达结构进入练习，点评按结构逐项检查。
                    </p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => go("/practice/logic")}
                  >
                    直接去说 60 秒
                  </button>
                </section>
                <details className="thinking-advanced">
                  <summary>
                    进阶 / 延伸 · {advancedIds.length} 个
                    <small>保留完整内容，不在新手路径里强推</small>
                  </summary>
                  <div className="thinking-cards">
                    {byId(advancedIds).map((m) => card(m))}
                  </div>
                </details>
              </>
            )}
            {!matches.length && (
              <div className="thinking-empty">
                <h2>
                  {onlyFavorites ? "没有符合条件的收藏" : "暂时没有匹配的框架"}
                </h2>
                <p>试试更短的关键词，或清除筛选查看全部方法。</p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setQuery("");
                    setCategory("全部");
                    setOnlyFavorites(false);
                  }}
                >
                  查看全部框架
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav active="/thinking" />
    </>
  );
}

function ModelNote({
  saved,
  save,
  template,
}: {
  saved: string;
  save: (note: string) => boolean;
  template: string[];
}) {
  const [note, setNote] = useState(saved);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (note === saved) return;
    setNavigationGuard(() => window.confirm("笔记尚未保存，确定离开吗？"));
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => {
      setNavigationGuard(undefined);
      window.removeEventListener("beforeunload", preventLoss);
    };
  }, [note, saved]);
  return (
    <>
      <button
        className="button secondary note-template"
        onClick={() => {
          const addition = "【本课应用模板】\n" + template.join("\n") + "\n";
          const next = note ? `${note}\n\n${addition}` : addition;
          if (next.length > 6000) {
            setMessage("剩余空间不足，模板尚未加入；请先整理或备份笔记。");
            return;
          }
          setNote(next);
          setMessage("模板已加入，原有文字已保留。填写后请保存。");
          document.getElementById("thinking-note")?.focus();
        }}
      >
        将本课模板加入笔记
      </button>
      <label htmlFor="thinking-note">我的问题与下一步</label>
      <textarea
        id="thinking-note"
        value={note}
        maxLength={6000}
        placeholder={"我遇到的问题是……\n我可以先尝试……\n还需要确认……"}
        onChange={(e) => {
          setNote(e.target.value);
          setMessage("尚未保存");
        }}
      />
      <div className="thinking-note-actions">
        <button
          className="button primary"
          onClick={() =>
            setMessage(
              save(note) ? "已保存到本机" : "保存失败，请保留此页面并复制备份",
            )
          }
        >
          保存笔记
        </button>
        <span>{note.length}/6000</span>
      </div>
      <p className="thinking-note-status" role="status">
        {message || (saved ? "已有本地笔记" : "写下想法后，点击保存笔记。")}
      </p>
    </>
  );
}

function ReviewBlock({
  progress,
  revisit,
  save,
}: {
  progress?: Progress;
  revisit: string;
  save: (next: Progress) => boolean;
}) {
  const { state, dueAt } = reviewState(progress);
  const reviews = progress?.reviews || [];
  return (
    <section className="review-block" id="lesson-review">
      <span className="thinking-eyebrow">过几天复习</span>
      <h2>过几天，带着结果再回来</h2>
      <p>{revisit}</p>
      <p className="review-state">
        状态：<em className={`status-chip is-${state}`}>{stateLabel[state]}</em>
        {state === "new" && " · 看懂速用卡后点「我看懂了」，3 天后提醒复习。"}
        {(state === "learned" || state === "reviewed") &&
          ` · 下次复习：${new Date(dueAt).toLocaleDateString("zh-CN")}`}
        {state === "mastered" &&
          " · 这是复习记录，不代表已经掌握；可以随时再练。"}
      </p>
      {state === "due" && progress && (
        <button
          className="button secondary"
          onClick={() =>
            save({
              ...progress,
              reviews: [...reviews, new Date().toISOString()],
            })
          }
        >
          我复习过了（用它再说一次后点这里）
        </button>
      )}
    </section>
  );
}

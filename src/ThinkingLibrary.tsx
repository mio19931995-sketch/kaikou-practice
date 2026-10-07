import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookmarkSimple,
  Check,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { BottomNav, Header, go, setNavigationGuard } from "./components";
import { thinkingCategories, thinkingModels } from "./thinkingData";
import { ThinkingLesson, openGroup } from "./ThinkingLesson";
import { frameworks } from "./data";
import {
  advancedIds,
  isProgress,
  learningPath,
  reviewState,
  stateLabel,
  type Progress,
} from "./thinkingPath";
import { thinkingPractice } from "./thinkingPractice";
import { ThinkingSources } from "./ThinkingApplications";
import type { Session } from "./types";
import "./thinking.css";

const storageKey = "kaikou.thinking.v1";
const coreIds = [
  "first-principles",
  "pyramid",
  "opportunity",
  "inversion",
  "second-order",
  "sbi",
];
type Notebook = {
  favorites: string[];
  notes: Record<string, string>;
  progress?: Record<string, Progress>;
  lastOpened?: string;
};
const structureName = (id: string) =>
  frameworks.find((f) => f.id === id)?.name || id;
const modelsById = (ids: string[]) =>
  ids
    .map((id) => thinkingModels.find((m) => m.id === id))
    .filter((m): m is (typeof thinkingModels)[number] => Boolean(m));
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
          !Object.values(parsed.progress).every(isProgress))) ||
      (parsed.lastOpened !== undefined && typeof parsed.lastOpened !== "string")
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
  navigation,
}: {
  modelId: string | null;
  sessions: Session[];
  navigation?: ReactNode;
}) {
  const [initial] = useState(readNotebook);
  const [notebook, setNotebook] = useState(initial.value);
  const [error, setError] = useState(initial.error);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [path, setPath] = useState<string | null>(null);
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
  const openModel = (id: string) => {
    // Visiting is recorded separately from learning, practice, and review.
    update({ ...notebook, lastOpened: id });
    go(`/thinking?model=${id}`);
  };
  const progress = notebook.progress || {};
  const setProgress = (id: string, next: Progress) =>
    update({ ...notebook, progress: { ...progress, [id]: next } });
  const practiced = (id: string) =>
    sessions.some(
      (s) =>
        s.thinkingModelId === id &&
        (s.audio || s.transcript.trim().length >= 5),
    );
  const statusOf = (id: string) => reviewState(progress[id]);
  const dueModels = thinkingModels.filter(
    (m) => statusOf(m.id).state === "due",
  );
  const selectedPath = learningPath.find((unit) => unit.title === path);
  const needle = query.trim().toLocaleLowerCase();
  const filtered =
    Boolean(needle) ||
    category !== "全部" ||
    onlyFavorites ||
    Boolean(selectedPath);
  const matches = thinkingModels.filter(
    (m) =>
      (category === "全部" || m.category === category) &&
      (!selectedPath || selectedPath.models.includes(m.id)) &&
      (!onlyFavorites || notebook.favorites.includes(m.id)) &&
      [m.name, m.category, m.question, m.summary, m.when, m.example]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
  );
  const recommendation =
    dueModels[0] ||
    thinkingModels.find((m) => m.id === notebook.lastOpened) ||
    thinkingModels.find((m) => m.id === "pyramid")!;
  const recommendationPath = learningPath.find((unit) =>
    unit.models.includes(recommendation.id),
  );
  const recommendationDue = statusOf(recommendation.id).state === "due";
  const continued = notebook.lastOpened === recommendation.id;
  const displayStatus = (id: string) => {
    const state = statusOf(id).state;
    const count = progress[id]?.reviews?.length || 0;
    return state === "reviewed" || state === "mastered"
      ? `已复习 ${count} 次`
      : stateLabel[state];
  };
  const card = (m: (typeof thinkingModels)[number]) => (
    <article className="thinking-card" key={m.id}>
      <a
        href={`#/thinking?model=${m.id}`}
        onClick={(event) => {
          event.preventDefault();
          openModel(m.id);
        }}
      >
        <div className="thinking-card-heading">
          <span className="thinking-card-number">
            {String(
              (coreIds.includes(m.id) ? coreIds : advancedIds).indexOf(m.id) +
                (coreIds.includes(m.id) ? 1 : 7),
            ).padStart(2, "0")}
          </span>
          <h2>{m.name}</h2>
        </div>
        <p>{m.summary}</p>
        <span className="thinking-card-bottom">
          {m.category} · 快速理解 + 开口迁移 <ArrowRight size={15} />
        </span>
      </a>
      <div className="thinking-card-meta">
        <span className="thinking-card-status">
          {progress[m.id]?.learnedAt && (
            <em className="status-chip is-learned">已学</em>
          )}
          {practiced(m.id) && <em className="status-chip">已练</em>}
          {(statusOf(m.id).state === "due" ||
            (progress[m.id]?.reviews?.length || 0) > 0) && (
            <em className={`status-chip is-${statusOf(m.id).state}`}>
              {displayStatus(m.id)}
            </em>
          )}
        </span>
        <button
          className="thinking-bookmark"
          aria-label={`${notebook.favorites.includes(m.id) ? "取消收藏" : "收藏"}${m.name}`}
          aria-pressed={notebook.favorites.includes(m.id)}
          onClick={() => favorite(m.id)}
        >
          <BookmarkSimple
            size={19}
            weight={notebook.favorites.includes(m.id) ? "fill" : "regular"}
          />
        </button>
      </div>
    </article>
  );
  return (
    <>
      <Header
        title={model ? model.name : "方法学习"}
        back={modelId ? "/thinking" : "/"}
      />
      <main className={`thinking-page ${model ? "is-lesson" : "is-library"}`}>
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
            <div className="thinking-detail-heading">
              <h1>{model.name}</h1>
              <div className="thinking-breadcrumb">
                <button
                  className="thinking-back"
                  aria-label="← 全部思维框架"
                  onClick={() => go("/thinking")}
                >
                  方法学习
                </button>
                <span>/</span>
                <button onClick={() => go("/thinking")}>思维框架</button>
                <span>/</span>
                <span>
                  {learningPath.find((unit) => unit.models.includes(model.id))
                    ?.title || model.category}
                </span>
              </div>
            </div>
            <div className="thinking-detail-grid">
              <article className="thinking-article">
                <section id="lesson-quick" className="quick-card">
                  <span className="thinking-eyebrow">一句话理解</span>
                  <h2>{model.summary}</h2>
                  <div className="quick-when">
                    <h3>什么时候用</h3>
                    <p>{model.when}</p>
                  </div>
                </section>
                <ThinkingLesson key={model.id} id={model.id} />
                <details className="lesson-group" id="lesson-group-mistake">
                  <summary>
                    <span>使用边界</span>哪些时候需要多想一步
                  </summary>
                  <p>{model.limit}</p>
                  <div className="thinking-boundary">
                    <strong>容易用错的地方</strong>
                    <p>{model.mistake}</p>
                  </div>
                </details>
                <details className="lesson-group" id="lesson-sources-group">
                  <summary>
                    <span>参考来源</span>资料依据与延伸阅读
                  </summary>
                  <ThinkingSources id={model.id} />
                </details>
              </article>
              <aside className="thinking-notebook" aria-label="学习笔记与复习">
                <h2>我的学习笔记</h2>
                <p className="notebook-privacy">
                  笔记只保存在本机，不自动提交 AI
                </p>
                <div className="notebook-divider" />
                <p className="notebook-prompt">{model.prompt}</p>
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
                <div className="notebook-actions">
                  <button
                    className="thinking-save"
                    aria-pressed={notebook.favorites.includes(model.id)}
                    onClick={() => favorite(model.id)}
                  >
                    <BookmarkSimple
                      size={16}
                      weight={
                        notebook.favorites.includes(model.id)
                          ? "fill"
                          : "regular"
                      }
                    />
                    {notebook.favorites.includes(model.id)
                      ? "已收藏"
                      : "收藏框架"}
                  </button>
                  <button
                    className="thinking-save"
                    aria-pressed={Boolean(progress[model.id]?.learnedAt)}
                    disabled={Boolean(progress[model.id]?.learnedAt)}
                    onClick={() =>
                      setProgress(model.id, {
                        ...progress[model.id],
                        learnedAt: new Date().toISOString(),
                      })
                    }
                  >
                    <Check size={16} />
                    {progress[model.id]?.learnedAt ? "已标为已学" : "标为已学"}
                  </button>
                </div>
                <ReviewBlock
                  progress={progress[model.id]}
                  practiced={practiced(model.id)}
                  revisit={thinkingPractice[model.id]?.revisit || ""}
                  save={(next) => setProgress(model.id, next)}
                />
                <div className="notebook-sources">
                  <h3>参考来源</h3>
                  <a href={model.url} target="_blank" rel="noreferrer">
                    {model.source} ↗
                  </a>
                  <button onClick={() => openGroup("sources", "sources")}>
                    查看出处与适用边界 →
                  </button>
                </div>
              </aside>
            </div>
          </>
        ) : (
          <>
            <section className="thinking-hero">
              <h1>把方法学会，也把它说出来</h1>
              <p>不是记住更多名词，而是在真实问题里用上一个方法</p>
            </section>
            {navigation}
            <div className="thinking-path-filters" aria-label="学习路径">
              <button aria-pressed={!path} onClick={() => setPath(null)}>
                全部框架
              </button>
              {learningPath.map((unit) => (
                <button
                  key={unit.title}
                  aria-pressed={path === unit.title}
                  onClick={() => setPath(unit.title)}
                >
                  {unit.title}
                </button>
              ))}
            </div>
            {!filtered && (
              <section className="thinking-continue">
                <div>
                  <span className="thinking-eyebrow">
                    {recommendationDue
                      ? "在遗忘前，再用一次"
                      : continued
                        ? "继续学习"
                        : "从这里开始"}{" "}
                    / {recommendationPath?.title || recommendation.category}
                  </span>
                  <h2>
                    {recommendation.name}：{recommendation.question}
                  </h2>
                  <p>
                    {recommendationDue
                      ? `已有 ${progress[recommendation.id]?.reviews?.length || 0} 次复习记录 · 这次带着一个真实问题再用一次`
                      : continued
                        ? "上次打开的框架 · 看一个例子，再试一道判断题"
                        : "从一条清楚的结论开始 · 看例子、做判断，再开口练一次"}
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => openModel(recommendation.id)}
                >
                  {recommendationDue
                    ? "去复习"
                    : continued
                      ? "继续学习"
                      : "开始学习"}
                  <ArrowRight size={18} />
                </button>
              </section>
            )}
            {dueModels.length > 0 && (
              <section className="review-banner" role="status">
                <strong>{dueModels.length} 个框架待复习</strong>
                {dueModels.map((m) => (
                  <button key={m.id} onClick={() => openModel(m.id)}>
                    {m.name} →
                  </button>
                ))}
              </section>
            )}
            <div className="thinking-list-heading">
              <h2>
                {filtered
                  ? selectedPath?.title || "找到适合你的方法"
                  : "六个常用框架"}
              </h2>
              <div className="thinking-tools">
                <label className="thinking-search">
                  <MagnifyingGlass size={17} />
                  <input
                    aria-label="搜索思维框架"
                    placeholder="搜索方法或问题"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <button
                  className="thinking-save"
                  aria-pressed={onlyFavorites}
                  onClick={() => setOnlyFavorites(!onlyFavorites)}
                >
                  <BookmarkSimple size={17} />
                  我的收藏 {notebook.favorites.length}
                </button>
              </div>
            </div>
            {selectedPath && (
              <section className="thinking-path-detail">
                <p>
                  先理解方法，再按你的沟通目的选择表达结构，最后说一次、过几天再复习。
                </p>
                <div className="path-nodes">
                  {selectedPath.structures.map((id) => (
                    <button
                      key={id}
                      className="path-node"
                      onClick={() => go(`/structures?framework=${id}`)}
                    >
                      {structureName(id)}
                      <span>表达结构 ↗</span>
                    </button>
                  ))}
                  <button
                    className="path-node is-practice"
                    onClick={() =>
                      go(`/practice/logic?thinking=${selectedPath.models[0]}`)
                    }
                  >
                    用本单元框架说 60 秒 <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            )}
            {filtered ? (
              <>
                <p className="thinking-count" role="status">
                  找到 {matches.length} 个框架
                  {onlyFavorites ? " · 仅显示已收藏" : ""}
                </p>
                <div className="thinking-cards">{matches.map(card)}</div>
              </>
            ) : (
              <>
                <div className="thinking-cards">
                  {modelsById(coreIds).map(card)}
                </div>
                <details className="thinking-advanced">
                  <summary>
                    <span>
                      进阶框架 · 继续探索 <ArrowRight size={17} />
                    </span>
                    <small>
                      {modelsById(advancedIds)
                        .map((m) => m.name)
                        .join(" / ")}
                    </small>
                  </summary>
                  <div className="thinking-cards">
                    {modelsById(advancedIds).map(card)}
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
                    setPath(null);
                    setOnlyFavorites(false);
                  }}
                >
                  查看全部框架
                </button>
              </div>
            )}
            <details className="thinking-category-filter">
              <summary>按问题分类筛选</summary>
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
            </details>
            <p className="thinking-library-footnote">
              12 个框架 · 4 条学习路径 · 学习、练习与复习分别记录在本机
            </p>
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
  const saveRef = useRef(save);
  saveRef.current = save;
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
      <label htmlFor="thinking-note">我的问题与下一步</label>
      <textarea
        id="thinking-note"
        value={note}
        maxLength={6000}
        placeholder={"记下一个你能用到的场景……\n先写自己的判断，再检查依据。"}
        onChange={(event) => {
          setNote(event.target.value);
          setMessage("尚未保存");
        }}
      />
      <div className="thinking-note-actions">
        <button
          className="note-save"
          onClick={() =>
            setMessage(
              saveRef.current(note)
                ? "已保存到本机"
                : "保存失败，请保留此页面并复制备份",
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
      <button
        className="note-template"
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
    </>
  );
}

function ReviewBlock({
  progress,
  practiced,
  revisit,
  save,
}: {
  progress?: Progress;
  practiced: boolean;
  revisit: string;
  save: (next: Progress) => boolean;
}) {
  const { state, dueAt } = reviewState(progress);
  const reviews = progress?.reviews || [];
  return (
    <section className="review-block" id="lesson-review">
      <h2>在遗忘前，再用一次</h2>
      <p>
        学完 3 天后：第一次复习
        <br />
        此后每次复习 7 天后：再次复习
      </p>
      <div className="review-state">
        <span
          className={`status-chip ${progress?.learnedAt ? "is-learned" : ""}`}
        >
          {progress?.learnedAt ? "已学" : "未学"}
        </span>
        <span className="status-chip">{practiced ? "已练" : "未练"}</span>
        <span className={`status-chip is-${state}`}>
          {reviews.length ? `已复习 ${reviews.length} 次` : "未复习"}
        </span>
      </div>
      {dueAt > 0 && (
        <p className={`review-next ${state === "due" ? "is-due" : ""}`}>
          {state === "due" ? "本次复习已到期" : "下次复习"} ·{" "}
          {new Date(dueAt).toLocaleDateString("zh-CN")}
        </p>
      )}
      {state === "new" && (
        <p className="review-note">
          点「标为已学」后记录首次复习日期；复习提醒显示在应用内。
        </p>
      )}
      {state === "due" && progress && (
        <>
          <p className="review-task">{revisit}</p>
          <button
            className="button secondary"
            onClick={() =>
              save({
                ...progress,
                reviews: [...reviews, new Date().toISOString()],
              })
            }
          >
            我复习过了
          </button>
        </>
      )}
      <small>已学、已练与复习次数分别记录，不代表已经掌握。</small>
    </section>
  );
}

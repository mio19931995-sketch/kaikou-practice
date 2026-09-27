import { ServiceSettings } from "./ServiceSettings";
import { ThinkingLibrary } from "./ThinkingLibrary";
import { SavedPractice } from "./SavedPractice";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  ChatCircleDots,
  Check,
  Clock,
  DownloadSimple,
  Fire,
  Flag,
  GearSix,
  Microphone,
  Path,
  Play,
  Sparkle,
  Stack,
  Target,
  Trash,
  PencilSimple,
  CaretRight,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  Brand,
  BottomNav,
  Empty,
  ErrorNote,
  Header,
  SectionTitle,
  AudioPlayer,
  go,
} from "./components";
import { frameworks, lessons, materials, modeNames } from "./data";
import { scenarios } from "./scenarios";
import {
  completedDays,
  dateKey,
  deleteSession,
  getSessions,
  streak,
} from "./storage";
import { getStatus } from "./api";
import type { Mode, ServiceStatus, Session } from "./types";
import { Practice } from "./Practice";
import { DesktopHome, DesktopShell, useDesktop } from "./Desktop";

function useRoute() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || "/");
  useEffect(() => {
    const handle = () => {
      setRoute(window.location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, []);
  return route;
}
function Home({ sessions }: { sessions: Session[] }) {
  const todayCount = sessions.filter(
    (s) => dateKey(new Date(s.createdAt)) === dateKey(),
  ).length;
  const done = completedDays(sessions);
  const next = lessons.find((l) => !done.has(l.day)) || lessons[20];
  return (
    <>
      <div className="home-content">
        <header className="home-header">
          <Brand />
          <button
            className="icon-button settings-button"
            aria-label="设置"
            onClick={() => go("/settings")}
          >
            <GearSix size={23} />
          </button>
        </header>
        <section className="greeting">
          <div className="greeting-label">
            <span className="tiny-line" />
            每天一点，表达更进一步
          </div>
          <h1>
            把想法，
            <br />
            <span>说清楚。</span>
          </h1>
          <span className="greeting-stamp">
            LET'S
            <br />
            SPEAK.
          </span>
          <p>不必一开口就完美。先从今天的一分钟开始。</p>
        </section>
        <div className="daily-progress">
          <div>
            <span className="progress-caption">今日练习</span>
            <strong>
              {todayCount}
              <small> / 3 次</small>
            </strong>
          </div>
          <div
            className="progress-bars"
            aria-label={`今日完成 ${todayCount} 次，目标 3 次`}
          >
            {Array.from({ length: 15 }, (_, i) => (
              <i
                key={i}
                className={i < Math.min(todayCount, 3) * 5 ? "filled" : ""}
              />
            ))}
          </div>
          <span className="progress-spark">
            <Sparkle size={28} weight="fill" />
          </span>
        </div>
        <div className="primary-cards">
          <button
            className="mode-card improv-card"
            onClick={() => go("/practice/improv")}
          >
            <span className="card-topline">
              随想随说
              <ArrowUpRight size={19} />
            </span>
            <h2>即兴表达</h2>
            <p>让想法，自然说出口</p>
            <div className="mode-art mic-art">
              <Microphone size={60} weight="duotone" />
            </div>
            <span className="mode-foot">
              60 秒小挑战
              <ArrowRight size={17} />
            </span>
          </button>
          <button className="mode-card logic-card" onClick={() => go("/logic")}>
            <span className="card-topline">
              有理有据
              <ArrowUpRight size={19} />
            </span>
            <h2>逻辑表达</h2>
            <p>给你的表达一点结构</p>
            <div className="mode-art stack-art">
              <Stack size={63} weight="duotone" />
            </div>
            <span className="mode-foot">
              8 种表达框架
              <ArrowRight size={17} />
            </span>
          </button>
        </div>
        <section className="retell-section">
          <SectionTitle
            title="读懂，再说出来"
            link="全部素材"
            onClick={() => go("/library")}
          />
          <div className="category-grid">
            {[
              { title: "职场表达", sub: "把事情说清楚", icon: Briefcase },
              { title: "概念解释", sub: "用自己的话理解", icon: BookOpen },
              {
                title: "社交沟通",
                sub: "让彼此更懂彼此",
                icon: ChatCircleDots,
              },
              { title: "自媒体", sub: "让故事被记住", icon: Play },
            ].map((c) => (
              <button
                key={c.title}
                onClick={() =>
                  go(`/library?category=${encodeURIComponent(c.title)}`)
                }
              >
                <span className="category-icon">
                  <c.icon size={23} />
                </span>
                <span>
                  <strong>{c.title}</strong>
                  <small>{c.sub}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
        <button className="course-banner" onClick={() => go("/plan")}>
          <span className="course-copy">
            <span className="course-eyebrow">每天一个小进步</span>
            <strong>
              21 天开口计划
              <ArrowUpRight size={21} />
            </strong>
            <small>
              {done.size
                ? `已经完成 ${done.size} 天，继续保持`
                : "从敢说，到说得清楚"}
            </small>
          </span>
          <span className="course-art">
            <Path size={64} weight="duotone" />
            <i>21</i>
          </span>
        </button>
        <section className="today-section">
          <SectionTitle title="今天，试试这个" />
          <button
            className="today-task"
            onClick={() => go(`/lesson/${next.day}`)}
          >
            <span className="task-day">
              DAY<strong>{String(next.day).padStart(2, "0")}</strong>
            </span>
            <span>
              <strong>{next.title}</strong>
              <small>{next.goal}</small>
            </span>
            <ArrowRight size={21} />
          </button>
        </section>
        <div className="home-note">
          <span />
          表达是一种能力，也是一种练习。
          <span />
        </div>
      </div>
      <BottomNav active="/" />
    </>
  );
}
function Logic() {
  const [tab, setTab] = useState<"scene" | "library">("scene");
  const [sceneId, setSceneId] = useState("update");
  const [selected, setSelected] = useState("SCQA");
  const scene = scenarios.find((s) => s.id === sceneId)!;
  const activeId =
    tab === "scene"
      ? selected === scene.alternative
        ? selected
        : scene.framework
      : selected;
  const frame = frameworks.find((f) => f.id === activeId)!;
  return (
    <>
      <Header title="逻辑表达" />
      <main className="page-content logic-content scene-content">
        <div className="page-intro">
          <span className="eyebrow">把话说得有条理</span>
          <h1>这一次，你想说什么？</h1>
          <p>从真实场景出发，找到适合这次表达的顺序。</p>
          <div className="scene-tabs" role="group" aria-label="浏览方式">
            <button
              aria-pressed={tab === "scene"}
              onClick={() => {
                setTab("scene");
                setSelected(scene.framework);
              }}
            >
              按场景练习
            </button>
            <button
              aria-pressed={tab === "library"}
              onClick={() => {
                setTab("library");
                setSelected(activeId);
              }}
            >
              结构库 · {frameworks.length}
            </button>
          </div>
        </div>
        <div
          className="framework-picker"
          role="group"
          aria-label="选择表达结构"
        >
          {tab === "scene"
            ? [...new Set(scenarios.map((s) => s.category))].map((category) => (
                <div className="scene-group" key={category}>
                  <span>{category}</span>
                  {scenarios
                    .filter((s) => s.category === category)
                    .map((s) => (
                      <button
                        key={s.id}
                        aria-pressed={sceneId === s.id}
                        className={sceneId === s.id ? "selected" : ""}
                        onClick={() => {
                          setSceneId(s.id);
                          setSelected(s.framework);
                        }}
                      >
                        {s.title}
                        {sceneId === s.id && <Check size={16} />}
                      </button>
                    ))}
                </div>
              ))
            : frameworks.map((f) => (
                <button
                  key={f.id}
                  className={selected === f.id ? "selected" : ""}
                  aria-pressed={selected === f.id}
                  onClick={() => setSelected(f.id)}
                >
                  {f.name}
                  {selected === f.id && <Check size={16} />}
                </button>
              ))}
        </div>
        <article className="framework-detail">
          <div className="detail-heading">
            <Stack size={25} />
            <span>
              {tab === "scene"
                ? `${scene.category} / ${scene.title}`
                : `认识 ${frame.name}`}
            </span>
          </div>
          {tab === "scene" && (
            <div className="scene-recommendation">
              <span>
                {activeId === scene.framework ? "首选结构" : "备选结构"} ·{" "}
                {frame.name}
              </span>
              <p>
                {activeId === scene.framework
                  ? scene.reason
                  : scene.alternativeReason}
              </p>
            </div>
          )}
          <h2>{frame.subtitle}</h2>
          <p>{frame.description}</p>
          <div className="structure-steps">
            {frame.steps.map((s, i) => (
              <span key={s}>
                <i>{String.fromCharCode(65 + i)}</i>
                {s}
              </span>
            ))}
          </div>
          <div className="example-block">
            <h3>看一个完整的例子</h3>
            {frame.example.map((text, i) => (
              <div className="example-row" key={i}>
                <span>{frame.steps[i]}</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
          {tab === "scene" && (
            <div className="scene-alternative">
              <h3>也可以这样组织</h3>
              <p>
                {activeId === scene.framework
                  ? scene.alternativeReason
                  : scene.reason}
              </p>
              <button
                className="button secondary"
                onClick={() =>
                  setSelected(
                    activeId === scene.framework
                      ? scene.alternative
                      : scene.framework,
                  )
                }
              >
                切换到
                {
                  frameworks.find(
                    (f) =>
                      f.id ===
                      (activeId === scene.framework
                        ? scene.alternative
                        : scene.framework),
                  )!.name
                }
              </button>
              <div className="scene-preview">
                <span>接下来练这一题</span>
                <p>{scene.prompts[0]}</p>
              </div>
            </div>
          )}
        </article>
        <div className="tip-line">
          <Sparkle size={20} />
          <p>结构是路标，不是台词。用你自己的话说出来。</p>
        </div>
      </main>
      <div className="sticky-actions">
        <button
          className="button primary"
          onClick={() =>
            go(
              `/practice/logic?framework=${activeId}${tab === "scene" ? `&scene=${scene.id}` : ""}`,
            )
          }
        >
          {tab === "scene" ? "开始这个场景的练习" : "用这个结构练一题"}
          <ArrowRight size={20} />
        </button>
      </div>
    </>
  );
}
function Library({ search }: { search: URLSearchParams }) {
  const initial = search.get("category") || "全部";
  const [category, setCategory] = useState(initial);
  const list = materials.filter(
    (m) => category === "全部" || m.category === category,
  );
  return (
    <>
      <Header title="复述素材" />
      <main className="page-content">
        <div className="page-intro">
          <span className="eyebrow">读懂，再说出来</span>
          <h1>
            把别人的观点，
            <br />
            变成自己的表达。
          </h1>
          <p>读一段短文，再用一分钟说清它的意思。</p>
        </div>
        <div className="filter-chips" aria-label="素材分类">
          {["全部", ...new Set(materials.map((m) => m.category))].map((c) => (
            <button
              key={c}
              aria-pressed={c === category}
              className={c === category ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="material-list">
          {list.map((m, i) => (
            <button
              className="material-card"
              key={m.id}
              onClick={() => go(`/practice/retell?material=${m.id}`)}
            >
              <span className="material-meta">
                <span>{m.category}</span>
                <span>约 1 分钟</span>
              </span>
              <h2>{m.title}</h2>
              <p>{m.text.slice(0, 58)}…</p>
              <span className="material-bottom">
                <span>0{i + 1} / 复述练习</span>
                <ArrowUpRight size={21} />
              </span>
            </button>
          ))}
        </div>
      </main>
    </>
  );
}
function Plan({ sessions }: { sessions: Session[] }) {
  const done = completedDays(sessions);
  const current = lessons.find((l) => !done.has(l.day))?.day || 21;
  return (
    <>
      <Header title="21 天开口计划" />
      <main className="page-content plan-content">
        <div className="plan-head">
          <span className="eyebrow">小步前进，也是在前进</span>
          <h1>
            让表达成为
            <br />
            你的日常。
          </h1>
          <div className="plan-stats">
            <span>
              <strong>{done.size}</strong> / 21 天已完成
            </span>
            <span>
              <Fire size={17} weight="fill" />
              连续练习 {streak(sessions)} 天
            </span>
          </div>
          <div className="progress-track">
            <i style={{ width: `${(done.size / 21) * 100}%` }} />
          </div>
        </div>
        <div className="journey">
          {lessons.map((lesson, i) => (
            <div
              key={lesson.day}
              className={`journey-item ${i % 2 ? "right" : "left"} ${lesson.day === current ? "current" : ""} ${done.has(lesson.day) ? "complete" : ""}`}
            >
              {i % 7 === 0 && (
                <div className="week-label">
                  第 {Math.floor(i / 7) + 1} 周 ·{" "}
                  {
                    ["找到开口的感觉", "让表达更有结构", "把练习带进生活"][
                      Math.floor(i / 7)
                    ]
                  }
                </div>
              )}
              <button
                className="journey-node"
                onClick={() => go(`/lesson/${lesson.day}`)}
                aria-label={`第 ${lesson.day} 天 ${lesson.title}${done.has(lesson.day) ? "，已完成" : ""}`}
              >
                {done.has(lesson.day) ? (
                  <Check size={26} weight="bold" />
                ) : lesson.day === 21 ? (
                  <Flag size={27} />
                ) : (
                  lesson.day
                )}
              </button>
              <span className="journey-caption">
                Day {lesson.day}
                <strong>{lesson.title}</strong>
                {lesson.day === current && <small>下一次练习</small>}
              </span>
            </div>
          ))}
        </div>
        <p className="center-note">
          可以按顺序练，也可以选择今天感兴趣的主题。
        </p>
      </main>
      <BottomNav active="/plan" />
    </>
  );
}
function Lesson({ day, sessions }: { day: number; sessions: Session[] }) {
  const lesson = lessons.find((l) => l.day === day);
  if (!lesson) return <NotFound />;
  const done = completedDays(sessions).has(day);
  const start = () => {
    const query = new URLSearchParams({ lesson: String(day) });
    if (lesson.mode === "logic")
      query.set("framework", day === 10 ? "STAR" : day === 9 ? "SCQA" : "PREP");
    if (lesson.mode === "retell")
      query.set("material", materials[day % materials.length].id);
    go(`/practice/${lesson.mode}?${query}`);
  };
  return (
    <>
      <Header title={`Day ${day} · ${lesson.title}`} back="/plan" />
      <main className="page-content lesson-content">
        <div className="lesson-number">
          DAY <strong>{String(day).padStart(2, "0")}</strong>
          <span>/ 21</span>
        </div>
        <span className="tag">
          {done ? "已完成，随时可以再练" : "今日任务"}
        </span>
        <h1>{lesson.goal}</h1>
        <p className="lesson-intro">
          不追求一次做到最好，留下一次真实的练习就很好。
        </p>
        <section className="lesson-section">
          <h2>
            <Target size={22} />
            今天练什么
          </h2>
          <p>{lesson.task}</p>
        </section>
        <section className="lesson-section">
          <h2>
            <Microphone size={22} />
            这样开始
          </h2>
          <ol className="lesson-steps">
            <li>
              <span>01</span>
              <div>
                <strong>留一点准备时间</strong>
                <p>找一个安静的位置，想清楚你最想说的一句话。</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>开口说一分钟</strong>
                <p>停顿、卡住都没有关系。先完整地表达你的意思。</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>回听，找一个小改进</strong>
                <p>
                  检查开头是否清楚，例子是否具体。保存练习即可记录本日完成。
                </p>
              </div>
            </li>
          </ol>
        </section>
        <div className="lesson-reflection">
          <PencilSimple size={22} />
          <div>
            <strong>练完问问自己</strong>
            <p>如果只改一个地方，下次我想怎么说？</p>
          </div>
        </div>
      </main>
      <div className="sticky-actions">
        <button className="button primary" onClick={start}>
          {done ? "再练一次" : "开始今天的练习"}
          <ArrowRight size={20} />
        </button>
      </div>
    </>
  );
}
function History({ sessions, error }: { sessions: Session[]; error: string }) {
  const [filter, setFilter] = useState("all");
  const list = sessions.filter((s) => filter === "all" || s.mode === filter);
  return (
    <>
      <Header title="我的练习" />
      <main className="page-content history-content">
        <div className="page-intro">
          <span className="eyebrow">每一次开口，都算数</span>
          <h1>看见自己的进步。</h1>
        </div>
        <div className="history-stats">
          <div>
            <strong>{sessions.length}</strong>
            <span>累计练习</span>
          </div>
          <div>
            <strong>
              {Math.round(sessions.reduce((n, s) => n + s.duration, 0) / 60)}
            </strong>
            <span>开口分钟</span>
          </div>
          <div>
            <strong>{streak(sessions)}</strong>
            <span>连续天数</span>
          </div>
        </div>
        <div className="filter-chips">
          {[["all", "全部"], ...Object.entries(modeNames)].map(
            ([value, label]) => (
              <button
                key={value}
                className={filter === value ? "selected" : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ),
          )}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        {list.length ? (
          <div className="history-list">
            {list.map((s) => (
              <button
                className="history-card"
                key={s.id}
                onClick={() => go(`/record/${s.id}`)}
              >
                <div className="history-card-top">
                  <span className="tag">{modeNames[s.mode]}</span>
                  <time>
                    {new Date(s.createdAt).toLocaleDateString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                    })}{" "}
                    {new Date(s.createdAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <h2>{s.topic}</h2>
                <div className="history-card-bottom">
                  <span>
                    <Clock size={15} />
                    {s.duration ? `${s.duration} 秒` : "文字练习"}
                  </span>
                  <span>
                    {s.feedback?.source === "ai"
                      ? "AI 点评"
                      : s.feedback
                        ? "基础反馈"
                        : "打开记录 · 生成点评"}
                    <CaretRight size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title={sessions.length ? "还没有这类练习" : "第一条记录，等你开口"}
            text="完成一次练习并保存，就能在这里回听和回顾。"
          >
            <button
              className="button primary"
              onClick={() => go("/practice/improv")}
            >
              开始一次练习
              <ArrowRight size={19} />
            </button>
          </Empty>
        )}
        <p className="center-note">
          {window.desktopApp
            ? "记录保存在当前电脑中，请及时下载重要录音。"
            : "记录保存在当前浏览器中，请及时下载重要录音。"}
        </p>
      </main>
      <BottomNav active="/history" />
    </>
  );
}
function RecordDetail({
  session,
  refresh,
  status,
}: {
  session?: Session;
  refresh: () => Promise<void>;
  status: ServiceStatus;
}) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);
  if (!session)
    return (
      <>
        <Header title="练习记录" back="/history" />
        <Empty
          title="没有找到这条记录"
          text="记录可能已被删除，或保存在其他浏览器中。"
        >
          <button className="button primary" onClick={() => go("/history")}>
            返回练习记录
          </button>
        </Empty>
      </>
    );
  const remove = async () => {
    if (!window.confirm("删除这次练习及录音？删除后无法恢复。")) return;
    setDeleting(true);
    try {
      await deleteSession(session.id);
      await refresh();
      go("/history");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <>
      <Header
        title="练习记录"
        back="/history"
        right={
          <button
            className="icon-button"
            aria-label="删除这条记录"
            disabled={deleting || processing}
            onClick={remove}
          >
            <Trash size={21} />
          </button>
        }
      />
      <main className="page-content">
        <span className="tag">
          {modeNames[session.mode]}
          {session.framework ? ` · ${session.framework}` : ""}
        </span>
        <h1 className="record-topic">{session.topic}</h1>
        <p className="muted">
          {new Date(session.createdAt).toLocaleString("zh-CN")}
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <AudioPlayer blob={session.audio} />
        <SavedPractice
          session={session}
          status={status}
          refresh={refresh}
          onBusy={setProcessing}
        />
        <button
          className="button secondary full"
          onClick={() =>
            go(
              `/practice/${session.mode}?retry=${encodeURIComponent(session.id)}`,
            )
          }
        >
          同题重新练习
          <ArrowRight size={20} />
        </button>
      </main>
    </>
  );
}
function Settings({
  status,
  refresh,
  sessions,
}: {
  status: ServiceStatus;
  refresh: () => Promise<void>;
  sessions: Session[];
}) {
  const [checking, setChecking] = useState(false);
  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          sessions.map(({ audio: _audio, ...rest }) => rest),
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `开口练习记录-${dateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <Header title="设置与说明" />
      <main className="page-content">
        <div className="page-intro">
          <Brand />
          <h1>安心地练习。</h1>
          <p>你的练习，由你掌握。</p>
        </div>
        <section className="settings-section">
          <h2>
            <Sparkle size={21} />
            表达反馈
          </h2>
          <div className="settings-row">
            <span>AI 点评</span>
            <span className={`status-tag ${status.ai ? "on" : ""}`}>
              {!status.reachable ? "连接中断" : status.ai ? "已启用" : "未启用"}
            </span>
          </div>
          <div className="settings-row">
            <span>
              {status.asrMode === "local" ? "本机语音转文字" : "语音转文字"}
            </span>
            <span className={`status-tag ${status.asr ? "on" : ""}`}>
              {!status.reachable
                ? "连接中断"
                : status.asr
                  ? "已启用"
                  : "未启用"}
            </span>
          </div>
          <p>
            {status.ai
              ? "提交分析时，表达文字会发送给已配置的模型服务。"
              : "目前可以录音、编辑文字和查看基础反馈。开启 AI 服务后，可以获得针对表达内容的具体点评。"}
          </p>
          <button
            className="button secondary full"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              await refresh();
              setChecking(false);
            }}
          >
            {checking ? "正在检查…" : "重新检查服务"}
          </button>
        </section>
        <section className="settings-section">
          <h2>
            <ShieldCheck size={21} />
            数据与隐私
          </h2>
          <p>
            {window.desktopApp
              ? "录音和练习记录保存在当前电脑的应用数据目录，不会自动同步到其他设备。卸载时请先导出重要记录。"
              : "录音和练习记录保存在当前浏览器，不会自动同步到其他设备。清除网站数据会删除这些记录。"}
          </p>
          <p>
            本机转写不上传录音；使用云端转写时会上传本次音频。AI
            点评会提交本次文字。浏览器转写可能使用浏览器厂商的在线服务，可以在练习前关闭。
          </p>
          <button
            className="button secondary full"
            disabled={!sessions.length}
            onClick={exportData}
          >
            <DownloadSimple size={20} />
            导出文字记录（不含音频）
          </button>
          <small>录音可在每条历史记录中单独下载。</small>
        </section>
        {window.desktopApp && <ServiceSettings refresh={refresh} />}
        <section className="settings-section">
          <h2>
            <BookOpen size={21} />
            关于开口
          </h2>
          <p>
            这是一个表达练习工具。课程与题目用于日常练习，AI
            反馈仅供参考，不构成专业能力评定。
          </p>
        </section>
      </main>
    </>
  );
}
function NotFound() {
  return (
    <>
      <Header title="页面未找到" />
      <Empty title="这条路暂时走不到" text="回到首页，开始一次新的练习。">
        <button className="button primary" onClick={() => go("/")}>
          回到首页
        </button>
      </Empty>
    </>
  );
}
export default function App() {
  const desktop = useDesktop();
  const route = useRoute();
  const [path, query = ""] = route.split("?");
  const search = new URLSearchParams(query);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [status, setStatus] = useState<ServiceStatus>({
    ai: false,
    asr: false,
    reachable: true,
  });
  const refresh = useCallback(async () => {
    try {
      setSessions(await getSessions());
      setStorageError("");
    } catch (e) {
      setStorageError((e as Error).message);
    } finally {
      setSessionsLoaded(true);
    }
  }, []);
  const refreshStatus = useCallback(
    async () => setStatus(await getStatus()),
    [],
  );
  useEffect(() => {
    void refresh();
    void refreshStatus();
  }, [refresh, refreshStatus]);
  useEffect(() => {
    const online = () => {
      void refreshStatus();
    };
    window.addEventListener("online", online);
    window.addEventListener("focus", online);
    const timer = window.setInterval(online, 15000);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("focus", online);
      window.clearInterval(timer);
    };
  }, [refreshStatus]);
  const dark = path.startsWith("/practice") || path === "/logic";
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#101c38" : "#f7f8f4");
  }, [dark]);
  let page;
  if (path === "/")
    page = desktop ? (
      <DesktopHome sessions={sessions} />
    ) : (
      <Home sessions={sessions} />
    );
  else if (path === "/logic") page = <Logic />;
  else if (path === "/thinking")
    page = (
      <ThinkingLibrary modelId={search.get("model")} sessions={sessions} />
    );
  else if (path === "/library") page = <Library key={route} search={search} />;
  else if (path === "/plan") page = <Plan sessions={sessions} />;
  else if (path.startsWith("/lesson/"))
    page = <Lesson day={Number(path.split("/")[2])} sessions={sessions} />;
  else if (path === "/history")
    page = <History sessions={sessions} error={storageError} />;
  else if (path.startsWith("/record/"))
    page = (
      <RecordDetail
        key={route}
        status={status}
        session={sessions.find((s) => s.id === path.split("/")[2])}
        refresh={refresh}
      />
    );
  else if (path === "/settings")
    page = (
      <Settings status={status} refresh={refreshStatus} sessions={sessions} />
    );
  else if (
    path.startsWith("/practice/") &&
    ["improv", "logic", "retell"].includes(path.split("/")[2])
  )
    page =
      search.has("retry") &&
      !sessions.some((s) => s.id === search.get("retry")) ? (
        <main className="page">
          <p role="status">
            {sessionsLoaded
              ? "找不到上次练习，请从练习记录重新进入。"
              : "正在读取上次练习…"}
          </p>
          <a href="#/history">返回练习记录</a>
        </main>
      ) : (
        <Practice
          key={route}
          mode={path.split("/")[2] as Mode}
          search={search}
          retrySession={sessions.find((s) => s.id === search.get("retry"))}
          status={status}
          onSaved={refresh}
        />
      );
  else page = <NotFound />;
  const content = (
    <div
      className={`app-shell ${dark ? "dark" : "light"} ${desktop ? "desktop-shell" : ""}`}
      data-route={path}
    >
      {page}
    </div>
  );
  return desktop ? (
    <DesktopShell path={path} sessions={sessions}>
      {content}
    </DesktopShell>
  ) : (
    content
  );
}

import { History } from "./History";
import { ServiceSettings } from "./ServiceSettings";
import { ThinkingLibrary } from "./ThinkingLibrary";
import { SavedPractice } from "./SavedPractice";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  DownloadSimple,
  Microphone,
  Sparkle,
  Stack,
  Target,
  Trash,
  PencilSimple,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  Brand,
  BottomNav,
  Empty,
  ErrorNote,
  Header,
  AudioPlayer,
  go,
  allowRouteChange,
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
import { MethodsTabs, TrainingTabs } from "./Navigation";

function useRoute() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || "/");
  const previousRoute = useRef(route);
  useEffect(() => {
    const handle = () => {
      const next = window.location.hash.slice(1) || "/";
      if (next === previousRoute.current) return;
      if (!allowRouteChange(next)) {
        window.history.replaceState(null, "", `#${previousRoute.current}`);
        return;
      }
      previousRoute.current = next;
      setRoute(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, []);
  return route;
}
function Logic({
  structures = false,
  initialFramework,
}: {
  structures?: boolean;
  initialFramework?: string | null;
}) {
  const [tab, setTab] = useState<"scene" | "library">(
    structures ? "library" : "scene",
  );
  const [sceneId, setSceneId] = useState("update");
  const [selected, setSelected] = useState(
    frameworks.some((frame) => frame.id === initialFramework)
      ? initialFramework!
      : "SCQA",
  );
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
      <Header
        title={structures ? "表达结构" : "场景表达"}
        back={structures ? "/thinking" : "/"}
      />
      <main className="page-content logic-content scene-content">
        <div className="page-intro">
          <span className="eyebrow">把话说得有条理</span>
          <h1>
            {structures ? "给表达一个清楚的顺序" : "这一次，你想说什么？"}
          </h1>
          <p>从真实场景出发，找到适合这次表达的顺序。</p>
          {structures ? (
            <MethodsTabs active="/structures" />
          ) : (
            <TrainingTabs active="/logic" />
          )}
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
        <TrainingTabs active="/library" />
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
  const next = lessons.find((lesson) => !done.has(lesson.day)) || lessons[20];
  return (
    <>
      <Header title="21 天开口计划" back="/thinking" />
      <main className="page-content plan-content redesigned-plan">
        <div className="page-intro">
          <h1>让练习持续，也让进步真实</h1>
          <p>每天一个小任务，练完再往前走</p>
        </div>
        <MethodsTabs active="/plan" />
        <section className="plan-hero">
          <div>
            <span>第 {next.day} 天 / 下一次练习</span>
            <h2>{next.title}</h2>
            <p>{next.goal}</p>
            <button
              className="button primary"
              onClick={() => go(`/lesson/${next.day}`)}
            >
              开始第 {next.day} 天 <ArrowRight size={18} />
            </button>
          </div>
          <aside className="plan-stats">
            <strong>{done.size} / 21</strong>
            <span>天已保存练习</span>
            <p>连续练习 {streak(sessions)} 天</p>
            <small>以已保存的练习记录为准，不代表能力评分</small>
          </aside>
        </section>
        <div className="journey">
          {[0, 1, 2].map((week) => (
            <section className="plan-week" key={week}>
              <div className="week-label">
                第 {week + 1} 周 ·{" "}
                {["找到开口的感觉", "让表达更有结构", "把练习带进生活"][week]}
              </div>
              {lessons.slice(week * 7, week * 7 + 7).map((lesson) => (
                <div
                  key={lesson.day}
                  className={`journey-item ${lesson.day === next.day ? "current" : ""} ${done.has(lesson.day) ? "complete" : ""}`}
                >
                  <button
                    className="journey-node"
                    onClick={() => go(`/lesson/${lesson.day}`)}
                    aria-label={`第 ${lesson.day} 天 ${lesson.title}${done.has(lesson.day) ? "，已完成" : ""}`}
                  >
                    <span className="plan-day">
                      {done.has(lesson.day) ? (
                        <Check size={20} />
                      ) : (
                        String(lesson.day).padStart(2, "0")
                      )}
                    </span>
                    <span>
                      <strong>{lesson.title}</strong>
                      <small>{lesson.goal}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>
        <p className="center-note">
          可以按顺序练，也可以选择今天感兴趣的主题。后续课程始终可以浏览，不用被连续天数绑住。
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
      <Header title="设置与服务状态" />
      <main className="page-content">
        <div className="page-intro">
          <Brand />
          <h1>安心地练习，清楚地掌握状态</h1>
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
        {window.desktopApp ? (
          <ServiceSettings refresh={refresh} />
        ) : (
          <section className="settings-section">
            <h2>
              <BookOpen size={21} />
              网页版服务配置
            </h2>
            <p>
              网页版使用本地服务端配置。请按项目 README 在 .env 中选择
              Agnes、Jev 或兼容模型，配置后重启服务；AI 点评和语音转写分别配置。
            </p>
            <p>
              这里的「重新检查服务」只刷新可用状态，不会发起付费模型测试。切换模型后，两次不同标准的判断不会直接比较。
            </p>
            <a
              className="text-button"
              href="https://github.com/mio19931995-sketch/kaikou-practice#源码运行"
              target="_blank"
              rel="noreferrer"
            >
              查看源码运行与配置说明 ↗
            </a>
          </section>
        )}
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
  const dark = false;
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#101c38" : "#f7f8f4");
  }, [dark]);
  let page;
  if (path === "/")
    page = (
      <>
        <DesktopHome sessions={sessions} error={storageError} />
        <BottomNav active="/" />
      </>
    );
  else if (path === "/logic" || path === "/structures")
    page = (
      <Logic
        key={route}
        initialFramework={search.get("framework")}
        structures={path === "/structures" || search.get("tab") === "library"}
      />
    );
  else if (path === "/thinking")
    page = (
      <ThinkingLibrary
        modelId={search.get("model")}
        sessions={sessions}
        navigation={<MethodsTabs active="/thinking" />}
      />
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
  // Keep the same tree while resizing so unsaved text and recording state survive.
  return (
    <DesktopShell path={path} sessions={sessions} desktop={desktop}>
      {content}
    </DesktopShell>
  );
}

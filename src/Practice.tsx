import { AIRecovery } from "./AIRecovery";
import { FeedbackReview, AnalysisProgress } from "./PracticeLoop";
import "./practice-redesign.css";
import { RuleSelector } from "./RuleSelector";
import type { RuleProfile } from "./types";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowClockwise,
  CheckCircle,
  Microphone,
  PencilSimple,
  Shuffle,
  Sparkle,
  Square,
  TextAlignLeft,
  Waveform,
} from "@phosphor-icons/react";
import { analyze, transcribe } from "./api";
import {
  AudioPlayer,
  ErrorNote,
  Header,
  WaveformCanvas,
  go,
  setNavigationGuard,
} from "./components";
import {
  frameworks,
  lessons,
  materials,
  modeNames,
  pick,
  topics,
  wordGroups,
} from "./data";
import { saveSession } from "./storage";
import { scenarios } from "./scenarios";
import type { Feedback, Mode, ServiceStatus, Session } from "./types";
import { speechSupported, useRecorder } from "./useRecorder";
import { thinkingModels } from "./thinkingData";
import { thinkingPractice } from "./thinkingPractice";
const clockText = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export function Practice({
  mode,
  search,
  status,
  onSaved,
  retrySession,
}: {
  retrySession?: Session;
  mode: Mode;
  search: URLSearchParams;
  status: ServiceStatus;
  onSaved: () => Promise<void>;
}) {
  const practiceFocus =
    retrySession?.feedback?.improvements[Number(search.get("focus")) || 0];
  const lesson = lessons.find((l) => l.day === Number(search.get("lesson")));
  const scene =
    mode === "logic"
      ? scenarios.find((s) => s.id === search.get("scene"))
      : undefined;
  const practiceTopics = scene?.prompts || topics;
  const thinking =
    mode === "logic"
      ? thinkingModels.find(
          (m) =>
            m.id === (retrySession?.thinkingModelId || search.get("thinking")),
        )
      : undefined;
  const baseFramework =
    frameworks.find(
      (f) =>
        retrySession?.framework?.startsWith(f.name) ||
        f.id === search.get("framework"),
    ) || frameworks[1];
  const framework = thinking
    ? {
        ...baseFramework,
        id: thinking.id,
        name: thinking.name,
        subtitle: "思维框架应用",
        description: thinking.summary,
        steps: thinking.steps,
      }
    : baseFramework;
  const material = retrySession?.material
    ? {
        ...materials[0],
        title: retrySession.topic,
        text: retrySession.material,
      }
    : materials.find((m) => m.id === search.get("material")) || materials[0];
  const [view, setView] = useState<"setup" | "session" | "review" | "report">(
    "setup",
  );
  const [topic, setTopic] = useState(
    retrySession?.topic ||
      (thinking
        ? thinkingPractice[thinking.id].task
        : lesson?.task || (scene ? scene.prompts[0] : pick(topics))),
  );
  const [kind, setKind] = useState("question");
  const [category, setCategory] = useState("全部");
  const [wordCount, setWordCount] = useState(2);
  const [words, setWords] = useState(["蜡烛", "机会"]);
  const [prepTime, setPrepTime] = useState(3);
  const [targetDuration, setTargetDuration] = useState(
    retrySession?.targetDuration || 60,
  );
  const [draft, setDraft] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [browserSpeech, setBrowserSpeech] = useState(
    !status.asr && speechSupported(),
  );
  const [ruleProfile, setRuleProfile] = useState<RuleProfile>(
    retrySession?.ruleProfile || "auto",
  );
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [aiCheckRequest, setAiCheckRequest] = useState(0);
  const [transcriptionState, setTranscriptionState] = useState<
    "idle" | "working" | "done" | "error"
  >("idle");
  const [feedback, setFeedback] = useState<Feedback>();
  const [saved, setSaved] = useState(false);
  const [analysisSeconds, setAnalysisSeconds] = useState<number>();
  const [previousAttempt, setPreviousAttempt] =
    useState<Session["previousAttempt"]>();
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const recorder = useRecorder(targetDuration);
  const autoTranscribed = useRef(false);
  const active = useRef(true);
  const operationPending = useRef(false);
  const question =
    retrySession?.topic ||
    (mode === "retell"
      ? material.title
      : mode === "improv" && kind === "words"
        ? `用“${words.join("、")}”讲一个故事或观点`
        : topic);
  useEffect(() => {
    const dirty =
      (view === "setup" && Boolean(draft) && !saved) ||
      view === "session" ||
      (view === "review" && Boolean(text || recorder.blob)) ||
      (view === "report" && !saved);
    if (!dirty) {
      setNavigationGuard(undefined);
      return;
    }
    setNavigationGuard(() =>
      window.confirm(
        working
          ? "本次处理尚未结束，确定离开吗？"
          : "离开本次练习？尚未保存的内容将丢失。",
      ),
    );
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      setNavigationGuard(undefined);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [view, text, draft, recorder.blob, saved, working]);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (countdown === null) return;
    const timeout = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        recorder.start(browserSpeech && !status.asr);
      } else setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [countdown]);
  useEffect(() => {
    if (recorder.phase === "done") {
      setView("review");
      setText(recorder.transcript);
    }
  }, [recorder.phase]);
  useEffect(() => {
    if (
      recorder.phase === "done" &&
      recorder.blob &&
      status.asr &&
      !autoTranscribed.current
    ) {
      autoTranscribed.current = true;
      void cloudTranscribe(recorder.blob);
    }
  }, [recorder.phase, recorder.blob, status.asr]);
  function shuffleWords(count = wordCount, group = category) {
    const pool = [
      ...(group === "全部"
        ? Object.values(wordGroups).flat()
        : wordGroups[group]),
    ];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setWords(pool.slice(0, count));
  }
  async function start() {
    setError("");
    if (await recorder.prepare()) {
      setView("session");
      setCountdown(prepTime);
    }
  }
  function reset() {
    recorder.reset();
    setView("setup");
    setCountdown(null);
    setFeedback(undefined);
    setText("");
    setError("");
    setSaved(false);
    setTranscriptionState("idle");
    setPreviousAttempt(undefined);
    setAnalysisSeconds(undefined);
    setSessionId(crypto.randomUUID());
    autoTranscribed.current = false;
  }
  function back() {
    go(
      lesson
        ? `/lesson/${lesson.day}`
        : thinking
          ? `/thinking?model=${thinking.id}`
          : mode === "logic"
            ? "/logic"
            : mode === "retell"
              ? "/library"
              : "/",
    );
  }
  function session(report?: Feedback): Session {
    return {
      id: sessionId,
      retryOf: retrySession?.id,
      practiceFocus,
      previousAttempt:
        previousAttempt ||
        (retrySession?.feedback
          ? {
              transcript: retrySession.transcript,
              feedback: retrySession.feedback,
            }
          : undefined),
      thinkingModelId: thinking?.id,
      targetDuration,
      preparationDraft: draft || undefined,
      createdAt: new Date().toISOString(),
      mode,
      topic: question,
      transcript: text.trim(),
      duration: recorder.blob ? recorder.seconds : 0,
      ruleProfile,
      framework:
        retrySession?.framework ||
        (mode === "logic"
          ? thinking
            ? thinking.name
            : `${framework.name}：${framework.steps.join(" → ")}`
          : undefined),
      material: mode === "retell" ? material.text : undefined,
      lessonDay: lesson?.day,
      audio: recorder.blob,
      feedback: report,
    };
  }
  async function persist(report?: Feedback) {
    if (!active.current) return;
    await saveSession(session(report));
    if (!active.current) return;
    setSaved(true);
    await onSaved();
  }
  async function submit(requireAI: boolean) {
    if (!active.current || working || operationPending.current) return;
    if (text.trim().length < 5) {
      setError(
        recorder.blob
          ? "录音还没有可用于点评的文字。请先完成语音转写，或在下方填写至少 5 个字。"
          : "请先填写至少 5 个字，再生成点评。",
      );
      document.getElementById("transcript")?.focus();
      return;
    }
    operationPending.current = true;
    const startedAt = Date.now();
    setAnalysisSeconds(undefined);
    setWorking(requireAI ? "正在阅读你的表达，生成点评…" : "正在整理本次练习…");
    setError("");
    try {
      await persist();
      if (!active.current) return;
      const result = await analyze(session(), requireAI);
      if (!active.current) return;
      setSaved(false);
      setFeedback(result);
      setView("report");
      window.scrollTo(0, 0);
      try {
        await persist(result);
      } catch (e) {
        if (active.current) setError((e as Error).message);
      }
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      operationPending.current = false;
      if (active.current) {
        setWorking("");
        setAnalysisSeconds(Math.round((Date.now() - startedAt) / 1000));
      }
    }
  }
  async function saveOnly() {
    if (!active.current || working || operationPending.current) return;
    operationPending.current = true;
    setWorking("正在保存…");
    setError("");
    try {
      await persist(feedback);
      if (!active.current) return;
      setNavigationGuard(undefined);
      go("/history");
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      operationPending.current = false;
      if (active.current) setWorking("");
    }
  }
  async function cloudTranscribe(blob: Blob) {
    if (!active.current || working || operationPending.current) return;
    operationPending.current = true;
    setTranscriptionState("working");
    setWorking(
      status.asrMode === "local"
        ? "正在本机识别录音，首次识别可能需要稍等…"
        : "正在把录音转成文字…",
    );
    setError("");
    try {
      const result = await transcribe(blob);
      if (active.current) {
        setText(result);
        setFeedback(undefined);
        setSaved(false);
        setTranscriptionState(result.trim() ? "done" : "error");
        if (!result.trim()) setError("没有识别到语音，请回听录音或手动填写。");
      }
    } catch (e) {
      if (active.current) {
        setError((e as Error).message);
        setTranscriptionState("error");
      }
    } finally {
      operationPending.current = false;
      if (active.current) setWorking("");
    }
  }
  const busy =
    Boolean(working) ||
    recorder.phase === "requesting" ||
    recorder.phase === "processing";
  const structureSteps =
    mode === "logic"
      ? framework.steps
      : mode === "retell"
        ? ["一句话概括主题", "保留关键理由与事实", "用自己的话重新组织"]
        : ["先说观点", "给出理由和例子", "用一句话收束"];
  const openTextPractice = (useDraft = false) => {
    setText(useDraft ? draft : "");
    setView("review");
    window.scrollTo(0, 0);
  };
  const title =
    view === "setup"
      ? "给想法一个清楚的开头"
      : view === "session"
        ? "专心表达，放心继续"
        : view === "review"
          ? "先确认，这是你想说的话"
          : "把这一次，变成下一次的进步";
  return (
    <div className={`practice-redesign practice-screen-${view}`}>
      <Header
        title={view === "report" ? "练习反馈" : modeNames[mode]}
        onBack={back}
        right={
          <span className="header-pill">
            {lesson ? `DAY ${lesson.day}` : `${targetDuration} 秒`}
          </span>
        }
      />
      <main className="practice-workspace">
        <header className="practice-masthead">
          <div>
            <h1>{title}</h1>
            <p>
              {mode === "logic" ? "场景表达" : modeNames[mode]}
              <span>/</span>
              {retrySession
                ? "同题再练"
                : view === "setup"
                  ? "准备这一轮"
                  : view === "session"
                    ? "正在开口"
                    : view === "review"
                      ? "校对表达内容"
                      : "练习复盘"}
              <span>/</span>
              {targetDuration} 秒
            </p>
          </div>
          <span className="practice-local-note">
            <CheckCircle size={15} /> 练习与录音保存在本机
          </span>
        </header>
        {view === "setup" && (
          <nav className="practice-mode-tabs" aria-label="练习类型">
            {(
              [
                ["improv", "即兴表达", "/practice/improv"],
                ["logic", "场景表达", "/logic"],
                ["retell", "复述练习", "/library"],
              ] as const
            ).map(([id, name, path]) => (
              <button
                key={id}
                className={mode === id ? "is-active" : ""}
                aria-current={mode === id ? "page" : undefined}
                onClick={() => {
                  if (mode !== id) go(path);
                }}
              >
                {name}
              </button>
            ))}
          </nav>
        )}
        <div className="practice-stepper" aria-label="练习进度">
          {["准备", "开口表达", "回顾内容", "练习反馈"].map((label, i) => {
            const current = ["setup", "session", "review", "report"].indexOf(
              view,
            );
            return (
              <span
                key={label}
                className={
                  i === current ? "current" : i < current ? "complete" : ""
                }
                aria-current={i === current ? "step" : undefined}
              >
                <i>{i < current ? <CheckCircle size={17} /> : i + 1}</i>
                {label}
              </span>
            );
          })}
        </div>
        {retrySession && view !== "report" && (
          <section className="practice-focus">
            <h3>同一道题，再试一次</h3>
            <p>{practiceFocus || "保留已有优点，把想法说得更清楚。"}</p>
            <small>题目和点评标准保持不变，上次练习不会被覆盖。</small>
          </section>
        )}
        {view === "setup" && (
          <>
            <div className="practice-setup-grid">
              <section className="practice-topic-panel">
                {mode === "improv" && !lesson && !retrySession && (
                  <div
                    className="segmented topic-kind"
                    role="group"
                    aria-label="出题方式"
                  >
                    <button
                      className={kind === "question" ? "selected" : ""}
                      aria-pressed={kind === "question"}
                      onClick={() => setKind("question")}
                    >
                      随机题目
                    </button>
                    <button
                      className={kind === "words" ? "selected" : ""}
                      aria-pressed={kind === "words"}
                      onClick={() => setKind("words")}
                    >
                      随机词语
                    </button>
                  </div>
                )}
                <div className="practice-topic-tags">
                  <span>
                    {scene?.category ||
                      (mode === "retell"
                        ? material.category
                        : mode === "logic"
                          ? "结构练习"
                          : "自由表达")}
                  </span>
                  {mode === "logic" && (
                    <span>
                      {framework.name} · {framework.subtitle}
                    </span>
                  )}
                </div>
                {mode === "improv" && kind === "words" ? (
                  <>
                    <div className="word-card">
                      {words.map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </div>
                    <div className="word-selects">
                      <label>
                        词语数量
                        <select
                          value={wordCount}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setWordCount(n);
                            shuffleWords(n);
                          }}
                        >
                          <option value={2}>2 个词语</option>
                          <option value={3}>3 个词语</option>
                        </select>
                      </label>
                      <label>
                        词语分类
                        <select
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value);
                            shuffleWords(wordCount, e.target.value);
                          }}
                        >
                          {["全部", ...Object.keys(wordGroups)].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="topic-instruction">
                      把这些词连成一个观点或故事，怎么讲都可以。
                    </p>
                  </>
                ) : (
                  <article
                    className={`question-card ${mode === "retell" ? "reading-card" : ""}`}
                  >
                    <h2>{question}</h2>
                    {mode === "retell" ? (
                      <p>{material.text}</p>
                    ) : (
                      <p className="topic-instruction">
                        {mode === "logic"
                          ? framework.description
                          : "没有标准答案。说出你的观点，再用一个真实的例子让人听懂。"}
                      </p>
                    )}
                  </article>
                )}
                <section className="practice-structure">
                  <h3>
                    {mode === "retell"
                      ? "读懂之后，可以这样复述"
                      : "可以这样组织"}
                  </h3>
                  <div className="mini-steps">
                    {structureSteps.map((step, i) => (
                      <span key={step}>
                        <i>{String(i + 1).padStart(2, "0")}</i>
                        {step}
                      </span>
                    ))}
                  </div>
                </section>
                <div className="preparation-draft">
                  <details>
                    <summary>先写提纲，再开口（可选）</summary>
                    <p>
                      只记关键词，不用写完整句子。提纲与转写分开，录音点评只使用实际转写。
                    </p>
                    {thinking && (
                      <p>{thinkingPractice[thinking.id].template.join("\n")}</p>
                    )}
                  </details>
                  <label htmlFor="preparation-draft">我的表达提纲</label>
                  <textarea
                    id="preparation-draft"
                    value={draft}
                    maxLength={3000}
                    placeholder="只记关键词，不用写完整句子……"
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                  />
                  {draft && (
                    <button
                      className="text-button draft-to-text"
                      onClick={() => openTextPractice(true)}
                    >
                      <PencilSimple size={15} />
                      用这份提纲进行文字练习
                    </button>
                  )}
                </div>
              </section>
              <aside className="practice-setup-panel" aria-label="这一轮怎么练">
                <h2>这一轮怎么练</h2>
                <div
                  className="practice-input-switch"
                  role="group"
                  aria-label="表达方式"
                >
                  <button
                    className="is-active"
                    aria-pressed="true"
                    disabled={busy}
                  >
                    <Microphone size={17} weight="fill" />
                    录音表达
                  </button>
                  <button
                    aria-label="也可以用文字练习"
                    aria-pressed="false"
                    disabled={busy}
                    onClick={() => openTextPractice()}
                  >
                    <PencilSimple size={17} />
                    文字输入
                  </button>
                </div>
                <section className="prep-section duration-section">
                  <h3>表达时长</h3>
                  <div className="prep-options" aria-label="表达时长">
                    {[30, 60, 90, 180].map((n) => (
                      <button
                        key={n}
                        aria-pressed={targetDuration === n}
                        className={targetDuration === n ? "selected" : ""}
                        onClick={() => setTargetDuration(n)}
                      >
                        {n}
                        <small>秒</small>
                      </button>
                    ))}
                  </div>
                  <p className="service-note">
                    可以提前结束，到所选时长自动收尾
                  </p>
                </section>
                <section className="prep-section">
                  <h3>准备时间</h3>
                  <div className="prep-options" aria-label="准备时间">
                    {[3, 10, 30].map((n) => (
                      <button
                        key={n}
                        className={prepTime === n ? "selected" : ""}
                        aria-pressed={prepTime === n}
                        onClick={() => setPrepTime(n)}
                      >
                        {n}
                        <small>秒</small>
                      </button>
                    ))}
                  </div>
                </section>
                <div className="practice-mic-note">
                  <Microphone size={21} />
                  <div>
                    <strong>使用系统默认麦克风</strong>
                    <p>开始时会请求麦克风权限，录音后可回听</p>
                  </div>
                </div>
                {speechSupported() && !status.asr && (
                  <label className="speech-switch">
                    <input
                      type="checkbox"
                      checked={browserSpeech}
                      onChange={(e) => setBrowserSpeech(e.target.checked)}
                    />
                    <span>
                      同时使用浏览器转写
                      <small>可能使用浏览器厂商的在线服务</small>
                    </span>
                  </label>
                )}
                {status.asr && (
                  <p className="service-note">
                    {status.asrMode === "local"
                      ? "录音结束后自动在本机转成文字，音频不会上传。"
                      : "录音结束后，将发送本次音频进行云端转写。"}
                  </p>
                )}
                {!status.ai && (
                  <p className="service-note service-availability">
                    <Sparkle size={16} />
                    {status.reachable
                      ? "AI 点评尚未启用，本次提供基础反馈。"
                      : "暂时无法连接服务，仍可录音并保存在本机。"}
                  </p>
                )}
                <div className="practice-start">
                  <button
                    className="button primary full"
                    disabled={busy}
                    onClick={start}
                  >
                    <Microphone size={20} />
                    {recorder.phase === "requesting"
                      ? "正在打开麦克风…"
                      : mode === "retell"
                        ? "读完了，开始复述"
                        : "开始表达"}
                    <ArrowRight size={19} />
                  </button>
                </div>
                {(error || recorder.error) && (
                  <ErrorNote>{error || recorder.error}</ErrorNote>
                )}
              </aside>
            </div>
            <footer className="practice-setup-footer">
              {mode !== "retell" && !lesson && !thinking && !retrySession && (
                <button
                  className="text-button"
                  onClick={() =>
                    kind === "words"
                      ? shuffleWords()
                      : setTopic(pick(practiceTopics, topic))
                  }
                >
                  <Shuffle size={17} />
                  {kind === "words" ? "换一组词" : "换一题"}
                  <ArrowRight size={17} />
                </button>
              )}
              <span>
                {practiceFocus
                  ? `本轮目标：${practiceFocus}`
                  : "每一次开口，都算数"}
              </span>
              <span>录音后可修改转写文字，再获取反馈</span>
            </footer>
          </>
        )}
        {view === "session" && (
          <section className="practice-recording-panel">
            <div className="session-topic">
              <span className="eyebrow">
                {countdown !== null
                  ? "准备开口"
                  : recorder.phase === "processing"
                    ? "正在整理录音"
                    : recorder.phase === "recording"
                      ? "正在录音"
                      : "录音暂未开始"}
              </span>
              <h2>{question}</h2>
              <p>
                {practiceFocus
                  ? `本轮目标：${practiceFocus}`
                  : structureSteps.join(" → ")}
              </p>
            </div>
            <div className="record-stage">
              {countdown !== null ? (
                <>
                  <span className="countdown-circle" key={countdown}>
                    {countdown}
                  </span>
                  <p>深呼吸，准备开口</p>
                </>
              ) : (
                <>
                  <div className="record-timer">
                    <span>{clockText(recorder.seconds)}</span>
                    <small>
                      已表达 {recorder.seconds} 秒 / 目标 {targetDuration} 秒
                    </small>
                  </div>
                  <WaveformCanvas
                    analyser={recorder.analyser}
                    active={recorder.phase === "recording"}
                  />
                  <p className="live-transcript" aria-live="off">
                    {recorder.transcript ||
                      (recorder.phase === "recording"
                        ? "正在收音 · 不用追求一次完美"
                        : recorder.phase === "processing"
                          ? "正在保留录音，请稍等"
                          : "检查麦克风后，可以返回准备页面重试")}
                  </p>
                  {recorder.phase === "recording" &&
                    targetDuration - recorder.seconds <= 5 && (
                      <p role="status">
                        还有 {targetDuration - recorder.seconds}{" "}
                        秒，可以用一句话收束。
                      </p>
                    )}
                </>
              )}
            </div>
            {recorder.phase === "recording" && (
              <div className="record-action">
                <button
                  className="button stop-record full"
                  aria-label="结束录音"
                  onClick={recorder.stop}
                >
                  <Square size={17} weight="fill" />
                  结束录音
                </button>
                <p>结束后可先校对文字，再获取反馈</p>
              </div>
            )}
            {recorder.phase === "processing" && (
              <div className="processing-label" role="status">
                正在整理你的录音…
              </div>
            )}
            {recorder.phase === "idle" && (
              <button
                className="button secondary full"
                onClick={() => setView("setup")}
              >
                返回准备页面
              </button>
            )}
            {draft && (
              <details className="recording-outline" open>
                <summary>我的提纲</summary>
                <p>{draft}</p>
              </details>
            )}
            {recorder.error && <ErrorNote>{recorder.error}</ErrorNote>}
          </section>
        )}
        {view === "review" && (
          <section className="practice-review-grid">
            <section className="practice-review-panel">
              <div className="review-topic">
                <span>
                  {recorder.blob ? "录音已完成，可以修正转写" : "文字练习"}
                </span>
                <h2>{question}</h2>
              </div>
              <AudioPlayer blob={recorder.blob} />
              <div className="transcript-editor">
                <label htmlFor="transcript">
                  <TextAlignLeft size={19} />
                  {recorder.blob ? "转写文本 · 我的表达" : "我的表达"}
                  <span>{text.length} / 6000</span>
                </label>
                {recorder.blob && (
                  <div className="transcription-status" role="status">
                    {transcriptionState === "working"
                      ? "正在识别录音，文字会自动显示在下方…"
                      : transcriptionState === "error"
                        ? "转写未完成。可以重试，或回听录音后补充文字。"
                        : text.trim()
                          ? "可直接修改转写错误，不影响原录音。"
                          : !status.asr
                            ? "语音转写尚未启用。录音已保留；AI 点评需要先将语音转成文字。"
                            : "录音已完成，等待转写结果。"}
                  </div>
                )}
                <textarea
                  id="transcript"
                  aria-label="我的表达"
                  value={text}
                  maxLength={6000}
                  disabled={Boolean(working)}
                  onChange={(e) => {
                    setText(e.target.value);
                    setSaved(false);
                    setFeedback(undefined);
                  }}
                  placeholder={
                    recorder.blob
                      ? "录音识别出的文字会显示在这里，你也可以手动填写或修正。AI 点评以此处文字为准。"
                      : "试着先写出你的观点，再给出理由和一个具体例子…"
                  }
                  rows={9}
                />
                <p>
                  {text.trim().length < 5
                    ? "先完成转写或填写至少 5 个字，才能生成点评。"
                    : "点评以这份文字为准，原录音会继续保留。"}
                </p>
              </div>
              {recorder.blob && status.asr && (
                <button
                  className="text-button"
                  disabled={Boolean(working)}
                  onClick={() => {
                    if (
                      text.trim() &&
                      !window.confirm("重新转写会替换当前编辑的文字，继续吗？")
                    )
                      return;
                    void cloudTranscribe(recorder.blob!);
                  }}
                >
                  <Waveform size={17} />
                  重新转写录音
                </button>
              )}
              {mode === "retell" && (
                <details className="reference-details">
                  <summary>对照原文</summary>
                  <p>{material.text}</p>
                </details>
              )}
              {mode === "logic" && (
                <details className="reference-details">
                  <summary>回顾 {framework.id} 结构</summary>
                  <p>{framework.steps.join(" → ")}</p>
                  <p>{framework.description}</p>
                </details>
              )}
            </section>
            <aside className="practice-review-controls">
              <h2>准备好，再看看反馈</h2>
              <p className="review-controls-intro">
                先保存内容，再获取反馈。暂时没有结果，也可以稍后继续。
              </p>
              <RuleSelector
                value={ruleProfile}
                onChange={(value) => {
                  setRuleProfile(value);
                  setFeedback(undefined);
                  setSaved(false);
                }}
                disabled={
                  Boolean(working) || mode === "retell" || Boolean(retrySession)
                }
              />
              {working && <AnalysisProgress message={working} />}
              {(error || recorder.error) && (
                <div className="practice-recovery">
                  {saved && <strong>内容已保存，反馈暂未完成</strong>}
                  <ErrorNote>{error || recorder.error}</ErrorNote>
                  {saved && (
                    <p>可以重试，或稍后从「我的练习」继续，无需重新录音。</p>
                  )}
                  {analysisSeconds !== undefined && (
                    <small>最近一次等待：{analysisSeconds} 秒</small>
                  )}
                </div>
              )}
              <div className="review-actions">
                <button
                  className="button primary full"
                  disabled={Boolean(working)}
                  onClick={() =>
                    status.ai
                      ? void submit(true)
                      : setAiCheckRequest((request) => request + 1)
                  }
                >
                  <Sparkle size={20} />
                  {error ? "重试 AI 点评" : "生成 AI 点评"}
                </button>
                <button
                  className="button secondary full"
                  disabled={Boolean(working) || !status.reachable}
                  onClick={() => void submit(false)}
                >
                  查看基础反馈
                </button>
                <button
                  className="button secondary full"
                  disabled={
                    Boolean(working) ||
                    (!recorder.blob && text.trim().length < 5)
                  }
                  onClick={saveOnly}
                >
                  仅保存练习
                </button>
                <button
                  className="text-button restart-practice"
                  disabled={Boolean(working)}
                  onClick={() => {
                    if (
                      (text || recorder.blob) &&
                      !window.confirm(
                        "重新练习会清除本次未保存的内容，继续吗？",
                      )
                    )
                      return;
                    reset();
                  }}
                >
                  <ArrowClockwise size={17} />
                  重新练习
                </button>
              </div>
              {!status.ai && (
                <AIRecovery
                  key={JSON.stringify([sessionId, text, ruleProfile])}
                  disabled={Boolean(working)}
                  checkLabel="检查 AI 连接"
                  requested={aiCheckRequest}
                  onReady={() => void submit(true)}
                />
              )}
              <p className="service-note">
                {status.ai
                  ? "录音与文字都会保留；反馈成功后进入复盘。"
                  : "AI 点评需要连接模型；基础反馈不会生成 AI 判断。"}
              </p>
            </aside>
          </section>
        )}
        {view === "report" && feedback && (
          <section className="practice-report-panel">
            <div className="report-saved">
              {saved ? (
                <>
                  <CheckCircle size={17} weight="fill" />
                  已保存到练习记录{lesson ? ` · Day ${lesson.day} 已完成` : ""}
                </>
              ) : (
                "本次反馈尚未保存"
              )}
            </div>
            <FeedbackReview
              session={session(feedback)}
              disabled={!saved || Boolean(working)}
              onEdit={() => {
                setPreviousAttempt({ transcript: text, feedback });
                setView("review");
                window.scrollTo(0, 0);
              }}
            />
            <div className="report-actions">
              <button
                className="button primary"
                disabled={Boolean(working)}
                onClick={() => (saved ? go("/history") : void saveOnly())}
              >
                {saved ? "查看练习记录" : "保存本次练习"}
                <ArrowRight size={19} />
              </button>
              <button
                className="button secondary"
                disabled={Boolean(working)}
                onClick={() => {
                  if (
                    !saved &&
                    !window.confirm("本次反馈尚未保存，仍要离开吗？")
                  )
                    return;
                  setNavigationGuard(undefined);
                  go(`/practice/${mode}`);
                }}
              >
                换个题目练习
              </button>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
          </section>
        )}
        {working && view !== "review" && <AnalysisProgress message={working} />}
        {recorder.speechError && view !== "report" && (
          <p className="service-note">{recorder.speechError}</p>
        )}
      </main>
    </div>
  );
}

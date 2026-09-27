import { PracticeNext, AnalysisProgress } from "./PracticeLoop";
import { AttemptComparison } from "./ScenarioReport";
import { RuleSelector } from "./RuleSelector";
import type { RuleProfile } from "./types";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowClockwise,
  CheckCircle,
  Clock,
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
  Report,
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
  const [transcriptionState, setTranscriptionState] = useState<
    "idle" | "working" | "done" | "error"
  >("idle");
  const [feedback, setFeedback] = useState<Feedback>();
  const [saved, setSaved] = useState(false);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const recorder = useRecorder(targetDuration);
  const autoTranscribed = useRef(false);
  const active = useRef(true);
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
  useEffect(() => {
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
      previousAttempt: retrySession?.feedback
        ? {
            transcript: retrySession.transcript,
            feedback: retrySession.feedback,
          }
        : undefined,
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
    await saveSession(session(report));
    setSaved(true);
    await onSaved();
  }
  async function submit() {
    if (working) return;
    if (text.trim().length < 5) {
      setError(
        recorder.blob
          ? "录音还没有可用于点评的文字。请先完成语音转写，或在下方填写至少 5 个字。"
          : "请先填写至少 5 个字，再生成点评。",
      );
      document.getElementById("transcript")?.focus();
      return;
    }
    setWorking(status.ai ? "正在阅读你的表达，生成点评…" : "正在整理本次练习…");
    setError("");
    try {
      await persist();
      const result = await analyze(session());
      if (!active.current) return;
      setSaved(false);
      setFeedback(result);
      setView("report");
      window.scrollTo(0, 0);
      try {
        await persist(result);
      } catch (e) {
        setError((e as Error).message);
      }
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) setWorking("");
    }
  }
  async function saveOnly() {
    setWorking("正在保存…");
    setError("");
    try {
      await persist(feedback);
      setNavigationGuard(undefined);
      go("/history");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (active.current) setWorking("");
    }
  }
  async function cloudTranscribe(blob: Blob) {
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
        setTranscriptionState(result.trim() ? "done" : "error");
        if (!result.trim()) setError("没有识别到语音，请回听录音或手动填写。");
      }
    } catch (e) {
      if (active.current) {
        setError((e as Error).message);
        setTranscriptionState("error");
      }
    } finally {
      if (active.current) setWorking("");
    }
  }
  const busy =
    Boolean(working) ||
    recorder.phase === "requesting" ||
    recorder.phase === "processing";
  return (
    <>
      <Header
        title={view === "report" ? "练习反馈" : modeNames[mode]}
        onBack={back}
        right={
          <span className="header-pill">
            {lesson ? `DAY ${lesson.day}` : `${targetDuration}s`}
          </span>
        }
      />
      <div className="practice-workspace">
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
              >
                <i>{i < current ? <CheckCircle size={17} /> : i + 1}</i>
                {label}
              </span>
            );
          })}
        </div>
        <div className="practice-columns">
          <main className={`page-content practice-content view-${view}`}>
            {retrySession && view !== "report" && (
              <section className="practice-focus">
                <h3>同一道题，再试一次</h3>
                <p>{practiceFocus || "保留已有优点，把想法说得更清楚。"}</p>
                <small>题目和点评标准保持不变，上次练习不会被覆盖。</small>
              </section>
            )}
            {view === "setup" && (
              <>
                {mode === "improv" && !lesson && !retrySession && (
                  <div className="segmented" role="group" aria-label="出题方式">
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
                <div className="practice-heading">
                  <span className="eyebrow">
                    {mode === "retell"
                      ? "先读一遍，再用自己的话说出来"
                      : mode === "logic"
                        ? `${framework.name} · ${framework.subtitle}`
                        : "没有标准答案，你的想法就很好"}
                  </span>
                  <h1>
                    {mode === "retell"
                      ? "读懂它，再讲给我听。"
                      : mode === "logic"
                        ? "有结构，才更清楚。"
                        : "给灵感，一点声音。"}
                  </h1>
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
                    <p className="muted small-text">
                      把这些词连成一个观点或故事，怎么讲都可以。
                    </p>
                  </>
                ) : (
                  <article
                    className={`question-card ${mode === "retell" ? "reading-card" : ""}`}
                  >
                    <span className="question-label">
                      {mode === "retell"
                        ? material.category
                        : scene
                          ? `${scene.category} · ${scene.title}`
                          : "这一题，聊聊"}
                    </span>
                    <h2>{question}</h2>
                    {mode === "retell" && <p>{material.text}</p>}
                    <div className="question-card-bottom">
                      <span>
                        <Clock size={15} />
                        {mode === "retell"
                          ? "建议阅读 30 秒"
                          : `表达时间 ${targetDuration} 秒`}
                      </span>
                      {mode !== "retell" &&
                        !lesson &&
                        !thinking &&
                        !retrySession && (
                          <button
                            className="text-button"
                            onClick={() =>
                              setTopic(pick(practiceTopics, topic))
                            }
                          >
                            <Shuffle size={17} />
                            换一题
                          </button>
                        )}
                    </div>
                  </article>
                )}
                {mode === "improv" && kind === "words" && (
                  <button
                    className="button secondary full"
                    onClick={() => shuffleWords()}
                  >
                    <Shuffle size={18} />
                    换一组词
                  </button>
                )}
                {mode === "logic" && (
                  <div className="mini-steps">
                    {framework.steps.map((s, i) => (
                      <span key={s}>
                        <i>{i + 1}</i>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <section className="prep-section duration-section">
                  <h2>这次想说多久？</h2>
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
                    可以提前结束；到所选时长自动收尾。长回答建议选 90 或 180
                    秒。
                  </p>
                </section>
                <details className="preparation-draft">
                  <summary>先写提纲，再开口（可选）</summary>
                  {thinking && (
                    <p>{thinkingPractice[thinking.id].template.join("\n")}</p>
                  )}
                  <label htmlFor="preparation-draft">我的表达提纲</label>
                  <textarea
                    id="preparation-draft"
                    value={draft}
                    maxLength={3000}
                    placeholder="我想表达的重点……\n用哪个例子说明……\n最后想让对方记住……"
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <small>
                    提纲与转写分开。录音点评只使用实际转写；保存练习时一并保存提纲。
                  </small>
                </details>
                <section className="prep-section">
                  <h2>留多少时间准备？</h2>
                  <div className="prep-options">
                    {[3, 10, 30].map((n) => (
                      <button
                        key={n}
                        className={prepTime === n ? "selected" : ""}
                        aria-pressed={prepTime === n}
                        onClick={() => setPrepTime(n)}
                      >
                        {n}
                        <small>秒</small>
                        {prepTime === n && (
                          <CheckCircle size={17} weight="fill" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
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
                  <p className="service-note">
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
                    <Microphone size={21} />
                    {recorder.phase === "requesting"
                      ? "正在打开麦克风…"
                      : mode === "retell"
                        ? "读完了，开始复述"
                        : "开始表达"}
                  </button>
                  <button
                    className="text-button manual-button"
                    disabled={busy}
                    onClick={() => {
                      setText(draft);
                      setView("review");
                    }}
                  >
                    <PencilSimple size={16} />
                    {draft ? "用这份提纲进行文字练习" : "也可以用文字练习"}
                  </button>
                </div>
              </>
            )}
            {view === "session" && (
              <>
                <div className="session-topic">
                  <span className="eyebrow">
                    {countdown !== null
                      ? "先想想，你想说什么"
                      : recorder.phase === "processing"
                        ? "正在整理录音"
                        : "慢慢说，我在听"}
                  </span>
                  <h1>{question}</h1>
                  {mode === "logic" && <p>{framework.steps.join(" → ")}</p>}
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
                        <small>/ {clockText(targetDuration)}</small>
                      </div>
                      <WaveformCanvas
                        analyser={recorder.analyser}
                        active={recorder.phase === "recording"}
                      />
                      <p className="live-transcript" aria-live="off">
                        {recorder.transcript ||
                          "说出第一个想法，就已经是一个开始。"}
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
                {draft && (
                  <details className="preparation-draft">
                    <summary>需要提示时，看一眼提纲</summary>
                    <p>{draft}</p>
                  </details>
                )}
                {recorder.phase === "recording" && (
                  <div className="record-action">
                    <button
                      className="stop-record"
                      aria-label="结束录音"
                      onClick={recorder.stop}
                    >
                      <Square size={27} weight="fill" />
                    </button>
                    <span>结束录音</span>
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
              </>
            )}
            {view === "review" && (
              <>
                <div className="practice-heading">
                  <span className="eyebrow">
                    {recorder.blob ? "一次开口，已经完成" : "把想说的话写下来"}
                  </span>
                  <h1>
                    {recorder.blob ? "听听，刚才的自己。" : "先把想法写清楚。"}
                  </h1>
                </div>
                <div className="review-topic">
                  <span>
                    {modeNames[mode]}
                    {mode === "logic" ? ` · ${framework.id}` : ""}
                  </span>
                  <h2>{question}</h2>
                </div>
                <AudioPlayer blob={recorder.blob} />
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
                <div className="transcript-editor">
                  <label htmlFor="transcript">
                    <TextAlignLeft size={19} />
                    {recorder.blob ? "语音转文字 · 我的表达" : "我的表达"}
                    <span>{text.length} / 6000</span>
                  </label>
                  {recorder.blob && (
                    <div className="transcription-status" role="status">
                      {transcriptionState === "working"
                        ? "正在识别录音，文字会自动显示在下方…"
                        : transcriptionState === "error"
                          ? "转写未完成。可以重试，或回听录音后补充文字。"
                          : text.trim()
                            ? "文字已就绪，可以修改识别错误后生成点评。"
                            : !status.asr
                              ? "语音转写尚未启用。录音已保留；AI 点评需要先将语音转成文字。"
                              : "录音已完成，等待转写结果。"}
                    </div>
                  )}
                  <RuleSelector
                    value={ruleProfile}
                    onChange={setRuleProfile}
                    disabled={
                      Boolean(working) ||
                      mode === "retell" ||
                      Boolean(retrySession)
                    }
                  />
                  <textarea
                    id="transcript"
                    aria-label="我的表达"
                    value={text}
                    maxLength={6000}
                    disabled={Boolean(working)}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      recorder.blob
                        ? "录音识别出的文字会显示在这里，你也可以手动填写或修正。AI 点评以此处文字为准。"
                        : "试着先写出你的观点，再给出理由和一个具体例子…"
                    }
                    rows={8}
                  />
                  <p>
                    {text.trim().length < 5
                      ? "尚无足够文字：先完成转写或填写至少 5 个字，才能生成点评。"
                      : "可以修正文字后再生成点评。"}
                  </p>
                </div>
                {recorder.blob && status.asr && (
                  <button
                    className="text-button"
                    disabled={Boolean(working)}
                    onClick={() => {
                      if (
                        text.trim() &&
                        !window.confirm(
                          "重新转写会替换当前编辑的文字，继续吗？",
                        )
                      )
                        return;
                      void cloudTranscribe(recorder.blob!);
                    }}
                  >
                    <Waveform size={17} />
                    重新转写录音
                  </button>
                )}
                {working && <AnalysisProgress message={working} />}
                {(error || recorder.error) && (
                  <ErrorNote>{error || recorder.error}</ErrorNote>
                )}
                <div className="review-actions">
                  <button
                    className="button primary full"
                    disabled={Boolean(working) || !status.reachable}
                    onClick={submit}
                  >
                    <Sparkle size={20} />
                    {status.ai
                      ? error
                        ? "重试 AI 点评"
                        : "生成 AI 点评"
                      : "查看基础反馈"}
                  </button>
                  <div className="two-buttons">
                    <button
                      className="button secondary"
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
                      <ArrowClockwise size={18} />
                      重新练习
                    </button>
                    <button
                      className="button secondary"
                      disabled={
                        Boolean(working) ||
                        (!recorder.blob && text.trim().length < 5)
                      }
                      onClick={saveOnly}
                    >
                      仅保存练习
                    </button>
                  </div>
                </div>
              </>
            )}
            {view === "report" && feedback && (
              <>
                <div className="report-saved">
                  {saved ? (
                    <>
                      <CheckCircle size={17} weight="fill" />
                      已保存到练习记录
                      {lesson ? ` · Day ${lesson.day} 已完成` : ""}
                    </>
                  ) : (
                    "本次反馈尚未保存"
                  )}
                </div>
                <PracticeNext
                  session={session(feedback)}
                  disabled={!saved || Boolean(working)}
                />
                <AttemptComparison session={session(feedback)} />
                <Report feedback={feedback} />
                <details className="reference-details">
                  <summary>回看我的表达与录音</summary>
                  <p>{text}</p>
                  <AudioPlayer blob={recorder.blob} />
                </details>
                <div className="report-actions">
                  <button
                    className="button primary full"
                    disabled={Boolean(working)}
                    onClick={() => (saved ? go("/history") : void saveOnly())}
                  >
                    {saved ? "查看练习记录" : "保存本次练习"}
                    <ArrowRight size={20} />
                  </button>
                  <button
                    className="button secondary full"
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
              </>
            )}
            {working && view !== "review" && (
              <div className="working-note" role="status">
                <span className="loading-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <AnalysisProgress message={working} />
              </div>
            )}
            {(error || recorder.error) && view !== "review" && (
              <ErrorNote>{error || recorder.error}</ErrorNote>
            )}
            {recorder.speechError && view !== "report" && (
              <p className="service-note">{recorder.speechError}</p>
            )}
          </main>
          <aside className="practice-guide">
            <span className="guide-kicker">
              <Sparkle size={18} />
              表达小指南
            </span>
            <h2>
              {mode === "logic"
                ? framework.name
                : mode === "retell"
                  ? "抓住重点，再开口"
                  : "从一个想法开始"}
            </h2>
            <p>
              {mode === "logic"
                ? framework.description
                : mode === "retell"
                  ? "不必背下每一句话，保留原文的核心意思，用自己的语言重新组织。"
                  : "不用急着想出一个完美答案。先说出你的观点，再分享一个真实的例子。"}
            </p>
            <ol>
              {(mode === "logic"
                ? framework.steps
                : mode === "retell"
                  ? [
                      "一句话概括主题",
                      "保留关键理由与事实",
                      "用自己的话重新组织",
                      "检查有没有改变原意",
                    ]
                  : [
                      "先说你最想表达的观点",
                      "给出一个理由",
                      "分享一个具体的小例子",
                      "用一句话收住话题",
                    ]
              ).map((step, i) => (
                <li key={step}>
                  <span>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="guide-reminder">
              <Microphone size={22} />
              <strong>停顿，也是表达的一部分。</strong>
              <p>
                卡住时，深呼吸。
                <br />
                说清楚，比说得快更重要。
              </p>
            </div>
            <div className="guide-service">
              <CheckCircle size={16} />
              <span>录音与记录保存在本机</span>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

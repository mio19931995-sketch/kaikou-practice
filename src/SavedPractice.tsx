import { PracticeNext, AnalysisProgress } from "./PracticeLoop";
import { RuleSelector } from "./RuleSelector";
import { AttemptComparison } from "./ScenarioReport";
import type { RuleProfile } from "./types";
import { useEffect, useRef, useState } from "react";
import { analyze, transcribe } from "./api";
import { ErrorNote, Report, setNavigationGuard } from "./components";
import { saveSession } from "./storage";
import type { Session, ServiceStatus } from "./types";

export function SavedPractice({
  session,
  status,
  refresh,
  onBusy,
}: {
  session: Session;
  status: ServiceStatus;
  refresh: () => Promise<void>;
  onBusy: (value: boolean) => void;
}) {
  const [ruleProfile, setRuleProfile] = useState<RuleProfile>(
    session.ruleProfile || "auto",
  );
  const [text, setText] = useState(session.transcript);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef(true);
  const dirty =
    text !== session.transcript ||
    ruleProfile !== (session.ruleProfile || "auto");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty && !working) return;
    setNavigationGuard(() =>
      window.confirm("文字修改或处理尚未完成，确定离开吗？原录音仍会保留。"),
    );
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      setNavigationGuard(undefined);
      window.removeEventListener("beforeunload", unload);
    };
  }, [dirty, working]);
  async function run(action: "transcribe" | "analyze" | "save") {
    if (working) return;
    if (action === "analyze" && text.trim().length < 5) {
      setError("请先转写录音或填写至少 5 个字，再生成点评。");
      document.getElementById("saved-transcript")?.focus();
      return;
    }
    if (
      action === "transcribe" &&
      text.trim() &&
      !window.confirm("重新转写会替换当前文字，继续吗？")
    )
      return;
    setError("");
    setNotice("");
    onBusy(true);
    setWorking(
      action === "transcribe"
        ? "正在识别录音，完成后文字将自动显示…"
        : action === "analyze"
          ? "正在生成点评…"
          : "正在保存文字…",
    );
    try {
      if (action === "transcribe") {
        if (!session.audio) throw new Error("这条记录没有录音。");
        const result = await transcribe(session.audio);
        if (!active.current) return;
        if (!result.trim())
          throw new Error("没有识别到语音，请回听录音或手动填写。");
        setText(result);
        await saveSession({
          ...session,
          transcript: result,
          previousAttempt:
            session.feedback?.source === "ai"
              ? { transcript: session.transcript, feedback: session.feedback }
              : session.previousAttempt,
          feedback: undefined,
        });
        await refresh();
        setNotice("转写文字已保存，可以直接生成点评。");
      } else {
        const updated = {
          ...session,
          transcript: text,
          ruleProfile,
          previousAttempt:
            text !== session.transcript && session.feedback?.source === "ai"
              ? { transcript: session.transcript, feedback: session.feedback }
              : session.previousAttempt,
          feedback: dirty ? undefined : session.feedback,
        };
        if (action === "analyze") {
          await saveSession(updated);
          await refresh();
        }
        const report =
          action === "analyze" ? await analyze(updated) : updated.feedback;
        if (!active.current) return;
        await saveSession({ ...updated, feedback: report });
        await refresh();
        setNotice(
          action === "analyze" ? "点评已保存到这条练习记录。" : "文字已保存。",
        );
      }
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) {
        setWorking("");
        onBusy(false);
      }
    }
  }
  return (
    <>
      <section className="saved-practice-editor">
        <label htmlFor="saved-transcript">
          {session.audio ? "语音转文字 · 我的表达" : "我的表达"}
          <span>{text.length} / 6000</span>
        </label>
        <p>
          可以直接点评，也可以先修正识别错误。修改文字后重新生成点评，结果会更新在这条记录中。
        </p>
        <RuleSelector
          value={ruleProfile}
          onChange={setRuleProfile}
          disabled={Boolean(working) || session.mode === "retell"}
        />
        <div className="saved-record-actions">
          {session.audio && (
            <button
              className="button secondary"
              disabled={Boolean(working) || !status.asr}
              onClick={() => void run("transcribe")}
            >
              {text.trim() ? "重新转写录音" : "转写录音"}
            </button>
          )}
          <button
            className="button primary"
            disabled={Boolean(working) || !status.reachable}
            onClick={() => void run("analyze")}
          >
            {status.ai
              ? error
                ? "重试 AI 点评"
                : session.feedback?.source === "ai"
                  ? "重新生成 AI 点评"
                  : "生成 AI 点评"
              : "查看基础反馈"}
          </button>
          <button
            className="button secondary"
            disabled={Boolean(working) || !dirty}
            onClick={() => void run("save")}
          >
            保存文字修改
          </button>
        </div>
        {session.audio && !status.asr && (
          <p>语音识别尚未就绪，可以先填写文字，或在设置中检查语音服务。</p>
        )}
        {working && <AnalysisProgress message={working} />}
        {notice && <p role="status">{notice}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
        <textarea
          id="saved-transcript"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setNotice("");
          }}
          maxLength={6000}
          rows={8}
          disabled={Boolean(working)}
          placeholder="点击转写录音，文字会显示在这里；也可以直接填写。"
        />
      </section>
      {session.feedback && (
        <>
          {dirty && (
            <p className="center-note">
              下方是修改前的点评。生成新点评后会更新。
            </p>
          )}
          <PracticeNext
            session={session}
            disabled={dirty || Boolean(working)}
          />
          <AttemptComparison session={session} />
          <Report feedback={session.feedback} />
        </>
      )}
    </>
  );
}

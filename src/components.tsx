import { JevReport } from "./JevReport";
import { useEffect, useRef, useState } from "react";
import type { RefObject, ReactNode } from "react";
import {
  ArrowLeft,
  House,
  Path,
  ClockCounterClockwise,
  ArrowUpRight,
  DownloadSimple,
  Sparkle,
  CheckCircle,
  Waveform,
} from "@phosphor-icons/react";
import type { Feedback } from "./types";
let navigationGuard: (() => boolean) | undefined;
export const setNavigationGuard = (guard?: () => boolean) => {
  navigationGuard = guard;
};
export const go = (path: string) => {
  if (navigationGuard && !navigationGuard()) return;
  window.location.hash = path;
};
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <span className="brand-icon">
        <Waveform size={23} weight="bold" />
      </span>
      <span>
        开口<span className="brand-caption">表达练习室</span>
      </span>
    </span>
  );
}
export function Header({
  title,
  back = "/",
  right,
  onBack,
}: {
  title: string;
  back?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <header className="page-header">
      <button
        className="icon-button"
        aria-label="返回"
        onClick={onBack || (() => go(back))}
      >
        <ArrowLeft size={23} />
      </button>
      <span>{title}</span>
      <div className="header-right">{right}</div>
    </header>
  );
}
export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {[
        { path: "/", label: "首页", icon: House },
        { path: "/plan", label: "训练", icon: Path },
        { path: "/history", label: "记录", icon: ClockCounterClockwise },
      ].map(({ path, label, icon: Icon }) => (
        <a
          key={path}
          href={`#${path}`}
          className={active === path ? "active" : ""}
          aria-current={active === path ? "page" : undefined}
        >
          <Icon size={23} weight={active === path ? "fill" : "regular"} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
export function SectionTitle({
  title,
  link,
  onClick,
}: {
  title: string;
  link?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {link && (
        <button className="text-button" onClick={onClick}>
          {link}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="error-note" role="alert">
      {children}
    </div>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <Waveform size={42} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function AudioPlayer({ blob }: { blob?: Blob }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) return;
    const value = URL.createObjectURL(blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [blob]);
  if (!blob || !url) return null;
  return (
    <div className="audio-player">
      <audio controls src={url} preload="metadata" aria-label="练习录音" />
      <a
        className="icon-button"
        href={url}
        download={`开口练习.${blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") ? "m4a" : "webm"}`}
        aria-label="下载录音"
      >
        <DownloadSimple size={20} />
      </a>
    </div>
  );
}
export function WaveformCanvas({
  analyser,
  active,
}: {
  analyser: RefObject<AnalyserNode | undefined>;
  active: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current!;
    const ctx = element.getContext("2d")!;
    let frame = 0;
    const values = new Uint8Array(128);
    function draw() {
      ctx.clearRect(0, 0, 600, 120);
      analyser.current?.getByteFrequencyData(values);
      for (let i = 0; i < forty; i++) {
        const height = active
          ? Math.max(5, (values[i * 2] / 255) * 95)
          : 5 +
            24 * Math.pow(Math.sin(i * 0.65), 2) * Math.sin((i / 40) * Math.PI);
        ctx.fillStyle = active ? "#b6f785" : "#8294b4";
        ctx.beginPath();
        ctx.roundRect(i * 14 + 21, 60 - height / 2, 5, height, 3);
        ctx.fill();
      }
      if (active) frame = requestAnimationFrame(draw);
    }
    const forty = 40;
    draw();
    return () => cancelAnimationFrame(frame);
  }, [active, analyser]);
  return (
    <canvas
      className="waveform"
      width="600"
      height="120"
      ref={canvas}
      aria-label={active ? "麦克风音量波形" : "录音就绪"}
      role="img"
    />
  );
}
export function Report({ feedback }: { feedback: Feedback }) {
  return (
    <div className="report">
      <div className="report-label">
        <Sparkle size={18} />
        {feedback.provider === "agnes" ? "Agnes · 多维表达点评" : feedback.provider === "jev" ? "Jev 结构化评估" : feedback.source === "ai" ? "AI 表达点评" : "基础反馈 · 非 AI 点评"}
      </div>
      <h2>
        {feedback.source === "ai"
          ? "这一次，表达得怎么样？"
          : "看见这一次的练习"}
      </h2>
      <p className="report-summary">{feedback.summary}</p>
      {feedback.answerGuide && <details className="coaching-guide"><summary>查看本题参考标准 · {feedback.profileName}</summary><p>开放表达没有唯一标准答案。按下面的要点组织内容，方括号需填写真实信息，不必逐字照背。</p><p>{feedback.answerGuide}</p></details>}
      <div className="report-metrics">
        <div>
          <strong>{feedback.metrics.characters}</strong>
          <span>表达字数</span>
        </div>
        <div>
          <strong>{feedback.metrics.duration || "—"}</strong>
          <span>录音秒数</span>
        </div>
        <div>
          <strong>{feedback.metrics.fillers}</strong>
          <span>待检查用词</span>
        </div>
      </div>
      {feedback.provider === "jev" && feedback.judgments ? <JevReport feedback={feedback} /> : <div className="dimension-list">
        {feedback.dimensions.map((d, i) => (
          <article key={i}>
            <span className="dimension-index">0{i + 1}</span>
            <div>
              <h3>{d.title}{d.status && <span className="coaching-status"> · {{good:"已做到",partial:"需完善",missing:"未体现",unsure:"需确认"}[d.status]}</span>}</h3>
              {d.standard && <details><summary>这一项的标准</summary><p>{d.standard}</p></details>}
              {d.evidence?.map((quote, n) => <blockquote className="coaching-quote" key={n}>{quote}</blockquote>)}
              <p>{d.text}</p>
              {d.advice && <p className="coaching-advice"><strong>怎么改：</strong>{d.advice}</p>}
            </div>
          </article>
        ))}
      </div>
      }
      {feedback.improvements.length > 0 && <div className="improvement">
        <h3>
          <CheckCircle size={20} />
          下次试试这样做
        </h3>
        {feedback.improvements.map((t, i) => (
          <p key={i}>
            {i + 1}. {t}
          </p>
        ))}
      </div>
      }
      {feedback.rewrite && (
        <div className="rewrite">
          <h3>一种更清楚的说法</h3>
          <p>{feedback.rewrite}</p>
          <small>改写仅供参考，保留你自己的表达方式。</small>
        </div>
      )}
      <p className="disclaimer">
        {feedback.provider === "jev" ? "以上为模型对固定标准的判断，可能有偏差，不评价发音与语调；练习建议由应用提供。" : feedback.source === "ai"
          ? "点评由 AI 根据文字生成，可能存在偏差，不评价发音与语调。"
          : "基础反馈仅使用文本统计和固定自查规则，不判断观点质量。"}
      </p>
    </div>
  );
}

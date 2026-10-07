import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  ClockCounterClockwise,
  GearSix,
  House,
  Microphone,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Brand, go } from "./components";
import { completedDays, dateKey } from "./storage";
import { lessons, modeNames } from "./data";
import { thinkingModels } from "./thinkingData";
import { isProgress, reviewState, type Progress } from "./thinkingPath";
import type { Session } from "./types";
import { version } from "../package.json";

export function useDesktop() {
  const [desktop, setDesktop] = useState(
    () => window.matchMedia("(min-width: 1000px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1000px)");
    const change = () => setDesktop(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return desktop;
}
export function navigationGroup(path: string) {
  if (
    path === "/thinking" ||
    path === "/structures" ||
    path === "/plan" ||
    path.startsWith("/lesson/")
  )
    return "/thinking";
  if (path.startsWith("/practice/") || path === "/logic" || path === "/library")
    return "/practice/improv";
  if (path.startsWith("/record/")) return "/history";
  return path;
}
export const mainNavigation = [
  { path: "/", label: "今日练习", icon: House },
  { path: "/practice/improv", label: "开口训练", icon: Microphone },
  { path: "/thinking", label: "方法学习", icon: BookOpen },
  { path: "/history", label: "我的练习", icon: ClockCounterClockwise },
];
export function DesktopShell({
  path,
  children,
  desktop = true,
}: {
  path: string;
  desktop?: boolean;
  sessions: Session[];
  children: ReactNode;
}) {
  const selected = navigationGroup(path);
  return (
    <div className="desktop-frame">
      <aside className="app-sidebar" hidden={!desktop}>
        <a
          className="sidebar-brand"
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            go("/");
          }}
          aria-label="开口首页"
        >
          <Brand />
        </a>
        <nav className="sidebar-nav" aria-label="桌面导航">
          {mainNavigation.map(({ path: to, label, icon: Icon }) => (
            <a
              key={to}
              href={`#${to}`}
              onClick={(e) => {
                e.preventDefault();
                go(to);
              }}
              className={selected === to ? "selected" : ""}
              aria-current={selected === to ? "page" : undefined}
            >
              <Icon size={21} weight="regular" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-local-note">
            <strong>每一次开口，都算数</strong>
            <p>练习与笔记保存在本机</p>
            <ShieldCheck size={19} />
          </div>
          <a
            href="#/settings"
            className={`sidebar-settings ${selected === "/settings" ? "selected" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              go("/settings");
            }}
          >
            <GearSix size={19} />
            <span>设置与服务状态</span>
          </a>
          <small className="sidebar-version">
            {window.desktopApp ? "桌面版" : "网页版"} v{version}
          </small>
        </div>
      </aside>
      <div className="desktop-workspace">{children}</div>
    </div>
  );
}
function readReviewSummary() {
  try {
    const raw = localStorage.getItem("kaikou.thinking.v1");
    if (!raw) return { due: [], error: "" };
    const notebook = JSON.parse(raw);
    const progress = notebook.progress || {};
    if (
      !progress ||
      typeof progress !== "object" ||
      Array.isArray(progress) ||
      !Object.values(progress).every(isProgress)
    )
      throw new Error("invalid");
    return {
      due: thinkingModels.filter(
        (model) => reviewState(progress[model.id] as Progress).state === "due",
      ),
      error: "",
    };
  } catch {
    return {
      due: [],
      error: "学习记录暂时无法读取，请到方法学习检查本机保存状态。",
    };
  }
}
export function DesktopHome({
  sessions,
  error = "",
}: {
  sessions: Session[];
  error?: string;
}) {
  const completed = completedDays(sessions);
  const next =
    lessons.find((lesson) => !completed.has(lesson.day)) || lessons[20];
  const recent = sessions[0];
  const review = readReviewSummary();
  const todayCount = sessions.filter(
    (s) => dateKey(new Date(s.createdAt)) === dateKey(),
  ).length;
  return (
    <main className="desktop-home today-home">
      <div className="desk-page-heading">
        <div>
          <h1>今天，先把一句话说清楚</h1>
          <p>
            {new Date().toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}{" "}
            / 用一小步，保持表达的手感
          </p>
        </div>
        <a
          href="#/settings"
          className="mobile-settings"
          aria-label="设置与服务状态"
          onClick={(e) => {
            e.preventDefault();
            go("/settings");
          }}
        >
          <GearSix size={23} />
        </a>
      </div>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      <section className="today-hero">
        <div>
          <span className="hero-kicker">
            今日练习 · 21 天计划 / 第 {next.day} 天
          </span>
          <h2>{next.title}</h2>
          <p>{next.goal}</p>
          <div className="today-hero-action">
            <button
              className="button primary"
              onClick={() => go(`/lesson/${next.day}`)}
            >
              开始今日练习 <ArrowRight size={18} />
            </button>
            <span>
              已完成 {completed.size} / 21 天 · 今日保存 {todayCount} 次
            </span>
          </div>
        </div>
        <aside>
          <span>这一次，只练一件事</span>
          <p>{next.task}</p>
          <small>了解任务 → 开口表达 → 回看一次</small>
        </aside>
      </section>
      <div className="today-followups">
        <section className="today-resume">
          <div className="section-title">
            <h2>接着上次练</h2>
            <button className="text-button" onClick={() => go("/history")}>
              查看全部 <ArrowRight size={15} />
            </button>
          </div>
          {recent ? (
            <>
              <span className="tag">
                {recent.feedback ? "已保存" : "待继续 · 内容已保存"}
              </span>
              <h3>{recent.topic}</h3>
              <p>
                {recent.practiceFocus ||
                  recent.feedback?.improvements[0] ||
                  "打开记录，回看表达内容与录音，再继续下一步。"}
              </p>
              <div className="today-resume-actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    go(
                      recent.feedback
                        ? `/practice/${recent.mode}?retry=${encodeURIComponent(recent.id)}&focus=0`
                        : `/record/${encodeURIComponent(recent.id)}`,
                    )
                  }
                >
                  {recent.feedback ? "同题再练一次" : "继续获取反馈"}
                </button>
                <small>
                  {new Date(recent.createdAt).toLocaleString("zh-CN", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {modeNames[recent.mode]}
                </small>
              </div>
            </>
          ) : (
            <>
              <h3>{error ? "暂时无法读取练习记录" : "第一条记录，等你开口"}</h3>
              <p>
                {error
                  ? "已有记录不会被覆盖；请检查浏览器存储权限后重新打开。"
                  : "完成一次练习并保存，就能在这里接着练。表达不必完美，先说出第一句。"}
              </p>
              <button
                className="button secondary"
                onClick={() => go("/practice/improv")}
              >
                开始一次练习 <ArrowRight size={16} />
              </button>
            </>
          )}
        </section>
        <section className="today-review">
          <h2>让学过的方法，再用一次</h2>
          {review.error ? (
            <p role="alert">{review.error}</p>
          ) : (
            <>
              <p>
                {review.due.length
                  ? `今天有 ${review.due.length} 个框架可复习`
                  : "按自己的节奏学，也给回想留一点时间。"}
              </p>
              {review.due.slice(0, 2).map((model) => (
                <button
                  className="review-summary-row"
                  key={model.id}
                  onClick={() => go(`/thinking?model=${model.id}`)}
                >
                  <span>{model.name}</span>
                  <span>
                    待复习 <ArrowRight size={15} />
                  </span>
                </button>
              ))}
            </>
          )}
          <button
            className="text-button"
            onClick={() =>
              go(
                review.due[0]
                  ? `/thinking?model=${review.due[0].id}`
                  : "/thinking",
              )
            }
          >
            {review.due.length ? "去复习" : "去学一个方法"}{" "}
            <ArrowRight size={16} />
          </button>
          <small>学完 3 天后首次复习，再隔 7 天回想一次</small>
        </section>
      </div>
      <section className="today-modes">
        <h2>按你今天的需要，开始</h2>
        <div className="desk-mode-grid">
          {[
            {
              title: "即兴表达",
              description: "抽一个话题，把想法说出来",
              path: "/practice/improv",
            },
            {
              title: "场景表达",
              description: "汇报、反馈、说服，带着目的练",
              path: "/logic",
            },
            {
              title: "复述练习",
              description: "读一段材料，用自己的话讲清楚",
              path: "/library",
            },
          ].map((item, index) => (
            <button
              className="desk-mode"
              key={item.path}
              onClick={() => go(item.path)}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <h3>
                {item.title} <ArrowRight size={21} />
              </h3>
              <p>{item.description}</p>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CaretRight,
  ChartBar,
  ChatCircleDots,
  Check,
  ClockCounterClockwise,
  Fire,
  GearSix,
  House,
  Microphone,
  Monitor,
  Path,
  ShieldCheck,
  Sparkle,
  Stack,
  Target,
  Waveform,
} from "@phosphor-icons/react";
import { Brand, go } from "./components";
import { completedDays, dateKey, streak } from "./storage";
import { lessons, materials, modeNames } from "./data";
import type { Session } from "./types";

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
const navItems = [
  { path: "/", label: "练习概览", icon: House, group: "工作台" },
  {
    path: "/practice/improv",
    label: "即兴表达",
    icon: Microphone,
    group: "工作台",
  },
  { path: "/logic", label: "逻辑表达", icon: Stack, group: "工作台" },
  { path: "/library", label: "复述素材", icon: BookOpen, group: "工作台" },
  { path: "/plan", label: "21 天开口计划", icon: Path, group: "成长记录" },
  {
    path: "/history",
    label: "我的练习",
    icon: ClockCounterClockwise,
    group: "成长记录",
  },
];
function selectedPath(path: string) {
  if (path.startsWith("/practice/logic")) return "/logic";
  if (path.startsWith("/practice/retell")) return "/library";
  if (path.startsWith("/lesson/")) return "/plan";
  if (path.startsWith("/record/")) return "/history";
  return path;
}
export function DesktopShell({
  path,
  sessions,
  children,
}: {
  path: string;
  sessions: Session[];
  children: ReactNode;
}) {
  const selected = selectedPath(path);
  const title =
    path === "/settings"
      ? "设置与说明"
      : navItems.find((n) => n.path === selected)?.label || "表达练习";
  const done = completedDays(sessions).size;
  return (
    <div className="desktop-frame">
      <aside className="app-sidebar">
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
        <div className="workspace-label">
          <span className="workspace-avatar">
            <Waveform size={18} />
          </span>
          <span>
            我的表达空间<small>一点点练习，一点点进步</small>
          </span>
        </div>
        <nav className="sidebar-nav" aria-label="桌面导航">
          {["工作台", "成长记录"].map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-group-label">{group}</span>
              {navItems
                .filter((n) => n.group === group)
                .map(({ path: to, label, icon: Icon }) => (
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
                    <Icon
                      size={20}
                      weight={selected === to ? "fill" : "regular"}
                    />
                    <span>{label}</span>
                    {to === "/history" && sessions.length > 0 && (
                      <small>{sessions.length}</small>
                    )}
                  </a>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-growth">
            <div>
              <Sparkle size={18} />
              <strong>让表达成为习惯</strong>
            </div>
            <p>完成了 {done} / 21 天的练习</p>
            <span className="sidebar-progress">
              <i style={{ width: `${(done / 21) * 100}%` }} />
            </span>
            <button onClick={() => go("/plan")}>
              继续我的计划
              <ArrowRight size={16} />
            </button>
          </div>
          <a
            href="#/settings"
            className={`sidebar-settings ${selected === "/settings" ? "selected" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              go("/settings");
            }}
          >
            <GearSix size={20} />
            <span>设置与说明</span>
          </a>
          <div className="sidebar-local">
            <ShieldCheck size={16} />
            <span>练习数据保存在本机</span>
          </div>
        </div>
      </aside>
      <div className="desktop-workspace">
        <header className="workspace-toolbar">
          <div className="workspace-breadcrumb">
            <span>我的空间</span>
            <CaretRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="toolbar-right">
            <span>
              <Monitor size={16} />
              桌面工作台
            </span>
            <button
              className="toolbar-avatar"
              onClick={() => go("/history")}
              aria-label="查看我的练习记录"
            >
              我
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function DesktopHome({ sessions }: { sessions: Session[] }) {
  const todayCount = sessions.filter(
    (s) => dateKey(new Date(s.createdAt)) === dateKey(),
  ).length;
  const completed = completedDays(sessions);
  const next = lessons.find((l) => !completed.has(l.day)) || lessons[20];
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const key = dateKey(date);
    return {
      date,
      key,
      count: sessions.filter((s) => dateKey(new Date(s.createdAt)) === key)
        .length,
    };
  });
  return (
    <main className="desktop-home">
      <div className="desk-page-heading">
        <div>
          <span className="desk-overline">每一次开口，都算数</span>
          <h1>今天，也向前一步。</h1>
          <p>选一种练习，给自己的表达留一点时间。</p>
        </div>
        <button className="desk-start" onClick={() => go("/practice/improv")}>
          <Microphone size={18} />
          开始一分钟练习
        </button>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="desk-hero">
            <div className="hero-copy">
              <span className="hero-kicker">
                <span />
                属于你的表达练习室
              </span>
              <h2>
                把想法，
                <br />
                <span>说清楚。</span>
              </h2>
              <p>
                不必一开口就完美。
                <br />
                从敢说，到说得清楚，我们慢慢来。
              </p>
            </div>
            <div className="hero-illustration" aria-hidden="true">
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <span className="hero-speech">
                <Waveform size={76} weight="light" />
              </span>
              <span className="hero-small-speech">
                <ChatCircleDots size={37} weight="duotone" />
              </span>
              <span className="hero-star">
                <Sparkle size={28} weight="fill" />
              </span>
              <span className="hero-stroke" />
            </div>
          </section>
          <section className="desk-modes-section">
            <div className="desk-section-heading">
              <h2>从这里开始练习</h2>
              <span>三种方式，找到你的节奏</span>
            </div>
            <div className="desk-mode-grid">
              {[
                {
                  mode: "improv",
                  title: "即兴表达",
                  description: "把脑海里的想法，自然说出口。",
                  icon: Microphone,
                  path: "/practice/improv",
                  foot: "随机题目 · 词语联想",
                },
                {
                  mode: "logic",
                  title: "逻辑表达",
                  description: "用清晰的结构，让观点被理解。",
                  icon: Stack,
                  path: "/logic",
                  foot: "PREP · SCQA · STAR",
                },
                {
                  mode: "retell",
                  title: "复述表达",
                  description: "读懂一段内容，用自己的话重述。",
                  icon: BookOpen,
                  path: "/library",
                  foot: "理解 · 提炼 · 表达",
                },
              ].map((item) => (
                <button
                  className={`desk-mode ${item.mode}`}
                  key={item.mode}
                  onClick={() => go(item.path)}
                >
                  <div className="desk-mode-top">
                    <span className="desk-mode-icon">
                      <item.icon size={29} weight="duotone" />
                    </span>
                    <ArrowUpRight size={20} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <span className="desk-mode-foot">{item.foot}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="desk-materials">
            <div className="desk-section-heading">
              <h2>值得聊一聊</h2>
              <button onClick={() => go("/library")}>
                全部素材
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="desk-material-grid">
              {materials.slice(0, 2).map((material, i) => (
                <button
                  className="desk-material"
                  key={material.id}
                  onClick={() => go(`/practice/retell?material=${material.id}`)}
                >
                  <span className={`material-art art-${i}`}>
                    {i === 0 ? (
                      <ChatCircleDots size={31} weight="duotone" />
                    ) : (
                      <Stack size={31} weight="duotone" />
                    )}
                  </span>
                  <span>
                    <small>{material.category} · 约 1 分钟</small>
                    <strong>{material.title}</strong>
                  </span>
                  <CaretRight size={16} />
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="dashboard-rail">
          <section className="desk-goal">
            <div className="rail-heading">
              <h2>今日小目标</h2>
              <Target size={19} />
            </div>
            <div
              className="goal-ring"
              style={
                {
                  "--progress": `${(Math.min(todayCount, 3) / 3) * 100}%`,
                } as CSSProperties
              }
            >
              <div>
                <strong>
                  {todayCount}
                  <span>/ 3</span>
                </strong>
                <small>已完成练习</small>
              </div>
            </div>
            <p>
              {todayCount >= 3
                ? "今天的目标达成了，给自己一点掌声。"
                : "每天三次，让开口变得更自然。"}
            </p>
            <div className="goal-meta">
              <span>
                <Fire size={17} />
                连续练习
              </span>
              <strong>
                {streak(sessions)}
                <small> 天</small>
              </strong>
            </div>
          </section>
          <section className="desk-plan">
            <div className="rail-heading">
              <h2>21 天开口计划</h2>
              <Path size={20} />
            </div>
            <p>小步前进，也是在前进。</p>
            <div className="desk-plan-progress">
              <span>已完成 {completed.size} 天</span>
              <span>{Math.round((completed.size / 21) * 100)}%</span>
            </div>
            <div className="desk-plan-track">
              <i style={{ width: `${(completed.size / 21) * 100}%` }} />
            </div>
            <div className="desk-next-lesson">
              <span>DAY {String(next.day).padStart(2, "0")}</span>
              <strong>{next.title}</strong>
              <small>{next.goal}</small>
            </div>
            <button onClick={() => go(`/lesson/${next.day}`)}>
              继续练习
              <ArrowRight size={17} />
            </button>
          </section>
          <section className="desk-week">
            <div className="rail-heading">
              <h2>最近七天</h2>
              <ChartBar size={18} />
            </div>
            <div className="week-days">
              {week.map(({ date, key, count }, i) => (
                <div key={key} className={i === 6 ? "today" : ""}>
                  <span>
                    {["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}
                  </span>
                  <i
                    className={count ? "done" : ""}
                    title={`${date.toLocaleDateString("zh-CN")}：${count} 次练习`}
                  >
                    {count ? (
                      <Check size={13} weight="bold" />
                    ) : i === 6 ? (
                      <span />
                    ) : null}
                  </i>
                </div>
              ))}
            </div>
          </section>
        </aside>
        <section className="desk-recent">
          <div className="desk-section-heading">
            <h2>最近的练习</h2>
            <button onClick={() => go("/history")}>
              查看全部
              <ArrowRight size={16} />
            </button>
          </div>
          {sessions.length ? (
            <div className="recent-table">
              <div className="recent-table-heading">
                <span>练习内容</span>
                <span>类型</span>
                <span>时间</span>
                <span>反馈</span>
                <span />
              </div>
              {sessions.slice(0, 3).map((session) => (
                <button
                  key={session.id}
                  className="recent-row"
                  onClick={() => go(`/record/${session.id}`)}
                >
                  <strong>{session.topic}</strong>
                  <span>{modeNames[session.mode]}</span>
                  <time>
                    {new Date(session.createdAt).toLocaleDateString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </time>
                  <span>
                    {session.feedback?.source === "ai"
                      ? "AI 点评"
                      : session.feedback
                        ? "基础反馈"
                        : "已保存"}
                  </span>
                  <CaretRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="desk-empty-record">
              <span>
                <Waveform size={26} />
              </span>
              <div>
                <strong>第一条记录，等你开口</strong>
                <p>完成一次练习，就能在这里回听录音、回顾自己的表达。</p>
              </div>
              <button onClick={() => go("/practice/improv")}>
                去练习
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      </div>
      <footer className="desk-footer">
        <Waveform size={15} />
        <span>表达是一种能力，也是一种练习。</span>
      </footer>
    </main>
  );
}

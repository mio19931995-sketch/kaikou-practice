import { useState } from "react";
import { ArrowRight, CaretRight, Clock } from "@phosphor-icons/react";
import { BottomNav, Empty, ErrorNote, Header, go } from "./components";
import { modeNames } from "./data";
import type { Session } from "./types";

/** Retry links, rather than identical topic text, define one intentional series. */
export function groupAttempts(sessions: Session[]) {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const groups = new Map<string, Session[]>();
  for (const session of sessions) {
    let root = session;
    const seen = new Set([root.id]);
    while (root.retryOf && byId.has(root.retryOf) && !seen.has(root.retryOf)) {
      root = byId.get(root.retryOf)!;
      seen.add(root.id);
    }
    const series = groups.get(root.id) || [];
    series.push(session);
    groups.set(root.id, series);
  }
  return [...groups.values()]
    .map((series) =>
      series.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
    .sort((a, b) => b[0].createdAt.localeCompare(a[0].createdAt));
}
export function History({
  sessions,
  error,
}: {
  sessions: Session[];
  error: string;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const groups = groupAttempts(sessions)
    .map((series) =>
      filter === "pending"
        ? series.filter((attempt) => !attempt.feedback)
        : series,
    )
    .filter((series) =>
      series.some(
        (s) =>
          (filter === "all" ||
            (filter === "pending" ? !s.feedback : s.mode === filter)) &&
          (!query.trim() ||
            `${s.topic} ${s.transcript} ${s.createdAt} ${new Date(s.createdAt).toLocaleDateString("zh-CN")}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    );
  const active =
    groups.find((series) => series.some((s) => s.id === selected)) || groups[0];
  const latest = active?.[0];
  return (
    <>
      <Header title="我的练习" />
      <main className="page-content history-content redesigned-history">
        <div className="page-intro">
          <h1>看见一次次表达的变化</h1>
          <p>保留每次尝试，也保留你下一次想改进的那一点</p>
        </div>
        <div className="filter-chips" aria-label="练习类型">
          {[
            ["all", "全部练习"],
            ["improv", "即兴表达"],
            ["logic", "场景表达"],
            ["retell", "复述练习"],
            ["pending", "待继续"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "selected" : ""}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="history-workspace">
          <section className="history-series">
            <label className="history-search">
              <span className="sr-only">搜索练习</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索话题、日期或练习内容……"
                aria-label="搜索练习"
              />
            </label>
            {groups.length ? (
              <div className="history-list">
                {groups.map((series) => {
                  const session = series[0];
                  return (
                    <article
                      className={`history-series-card ${active === series ? "selected" : ""}`}
                      key={session.id}
                    >
                      <button
                        className="history-card"
                        onClick={() => go(`/record/${session.id}`)}
                      >
                        <div className="history-card-top">
                          <span className="tag">{modeNames[session.mode]}</span>
                          <time>
                            {new Date(session.createdAt).toLocaleString(
                              "zh-CN",
                              {
                                month: "numeric",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </time>
                        </div>
                        <h2>{session.topic}</h2>
                        <p>
                          {series.length} 次尝试
                          {session.framework ? ` · ${session.framework}` : ""}
                        </p>
                        <div className="history-card-bottom">
                          <span>
                            <Clock size={15} />
                            {session.duration
                              ? `${session.duration} 秒`
                              : "文字练习"}
                          </span>
                          <span>
                            {session.feedback?.source === "ai"
                              ? "AI 点评"
                              : session.feedback
                                ? "基础反馈"
                                : "待继续 · 生成点评"}
                            <CaretRight size={16} />
                          </span>
                        </div>
                      </button>
                      <button
                        className="text-button series-preview"
                        onClick={() => setSelected(session.id)}
                        aria-pressed={active === series}
                      >
                        {series.length > 1 ? "查看同题对比" : "预览这次表达"}{" "}
                        <ArrowRight size={15} />
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <Empty
                title={
                  error
                    ? "暂时无法读取练习记录"
                    : sessions.length
                      ? "没有找到这类练习"
                      : "第一条记录，等你开口"
                }
                text={
                  query
                    ? "换一个关键词，或清空筛选再看看。"
                    : "完成一次练习并保存，就能在这里回听和回顾。"
                }
              >
                <button
                  className="button primary"
                  onClick={() => go("/practice/improv")}
                >
                  开始一次练习 <ArrowRight size={19} />
                </button>
              </Empty>
            )}
          </section>
          {latest && (
            <aside className="history-preview" aria-label="表达内容预览">
              <h2>{active.length > 1 ? "同题对比" : "这一次的表达"}</h2>
              <p>
                {latest.practiceFocus
                  ? `这一轮的目标：${latest.practiceFocus}`
                  : "回看真实表达，找到下一次想调整的地方。"}
              </p>
              <div className="history-transcripts">
                {active
                  .slice(0, 2)
                  .reverse()
                  .map((attempt, index) => (
                    <section
                      key={attempt.id}
                      className={attempt.id === latest.id ? "latest" : ""}
                    >
                      <span className="tag">
                        第{" "}
                        {active.length - Math.min(2, active.length) + index + 1}{" "}
                        次 ·{" "}
                        {new Date(attempt.createdAt).toLocaleTimeString(
                          "zh-CN",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                      <p>
                        {attempt.transcript ||
                          "此记录尚无转写文字，可打开录音继续。"}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => go(`/record/${attempt.id}`)}
                      >
                        打开这次记录 <ArrowRight size={15} />
                      </button>
                    </section>
                  ))}
              </div>
              <small>
                对比仅展示已保存文字，不评价声音表现；模型判断需在相同标准下查看。
              </small>
              <div className="history-preview-actions">
                <button
                  className="button primary"
                  onClick={() => go(`/record/${latest.id}`)}
                >
                  {latest.feedback ? "查看完整反馈" : "继续获取反馈"}
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    go(
                      `/practice/${latest.mode}?retry=${encodeURIComponent(latest.id)}&focus=0`,
                    )
                  }
                >
                  再练一次
                </button>
              </div>
              {active.length > 2 && (
                <details>
                  <summary>全部 {active.length} 次尝试</summary>
                  {active.map((attempt) => (
                    <button
                      className="all-attempt-link"
                      key={attempt.id}
                      onClick={() => go(`/record/${attempt.id}`)}
                    >
                      {new Date(attempt.createdAt).toLocaleString("zh-CN")}{" "}
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </details>
              )}
              <p className="history-privacy">
                原文、录音与每次反馈都保留在记录中
              </p>
            </aside>
          )}
        </div>
        <p className="center-note">
          {window.desktopApp
            ? "记录保存在当前电脑中"
            : "记录保存在当前浏览器中"}
          ，请及时下载重要录音。
        </p>
      </main>
      <BottomNav active="/history" />
    </>
  );
}

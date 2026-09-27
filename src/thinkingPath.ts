// 思维框架「想清楚 → 说清楚 → 说出来」结构与复习进度（仅保存在本机）
export const thinkLayer = [
  "first-principles",
  "inversion",
  "opportunity",
  "second-order",
];
export const sayLayer = ["pyramid", "sbi"];
export const advancedIds = [
  "batna",
  "bottleneck",
  "feedback",
  "competence",
  "map",
  "six-hats",
];

export type PathUnit = {
  title: string;
  models: string[];
  structures: string[];
  practice: string;
};
// 最常用 → 进阶：每个单元 = 2–3 个框架节点 + 1 个练习节点 + 1 个复习节点
export const learningPath: PathUnit[] = [
  {
    title: "先把结论说清楚",
    models: ["pyramid"],
    structures: ["PREP", "SUMMARY"],
    practice: "PREP",
  },
  {
    title: "把问题想清楚",
    models: ["first-principles", "inversion"],
    structures: ["PROBLEM"],
    practice: "PROBLEM",
  },
  {
    title: "做出选择",
    models: ["opportunity", "second-order"],
    structures: ["COMPARE"],
    practice: "COMPARE",
  },
  {
    title: "给出反馈",
    models: ["sbi"],
    structures: [],
    practice: "STAR",
  },
];

export type Progress = {
  learnedAt?: string;
  practicedAt?: string;
  reviews?: string[];
};
export type ReviewState = "new" | "learned" | "due" | "reviewed" | "mastered";

const day = 24 * 60 * 60 * 1000;
export const reviewGaps = [3, 7];

export function reviewState(p: Progress | undefined, now = Date.now()) {
  if (!p?.learnedAt) return { state: "new" as ReviewState, dueAt: 0 };
  const reviews = p.reviews || [];
  if (reviews.length >= reviewGaps.length)
    return { state: "mastered" as ReviewState, dueAt: 0 };
  const from = Date.parse(reviews.at(-1) || p.learnedAt);
  const dueAt = from + reviewGaps[reviews.length] * day;
  if (now >= dueAt) return { state: "due" as ReviewState, dueAt };
  return {
    state: (reviews.length ? "reviewed" : "learned") as ReviewState,
    dueAt,
  };
}

export const stateLabel: Record<ReviewState, string> = {
  new: "未学",
  learned: "已学",
  due: "待复习",
  reviewed: "已复习 1 次",
  mastered: "已复习 2 次",
};

export function isProgress(value: unknown): value is Progress {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  const date = (x: unknown) =>
    x === undefined || (typeof x === "string" && !Number.isNaN(Date.parse(x)));
  return (
    date(p.learnedAt) &&
    date(p.practicedAt) &&
    (p.reviews === undefined ||
      (Array.isArray(p.reviews) && p.reviews.every((x) => date(x) && x)))
  );
}

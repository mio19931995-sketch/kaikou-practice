import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// This module is dependency-free; transpiling keeps the core Node test command
// portable without requiring a browser or changing production build output.
const source = await readFile(
  new URL("../src/thinkingPath.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
});
const { reviewState, isProgress, learningPath } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const day = 86400000;
const learnedAt = "2026-09-01T08:00:00Z";
const start = Date.parse(learnedAt);

test("first review is due three days after learning, including the exact due boundary", () => {
  assert.deepEqual(reviewState(undefined, start), { state: "new", dueAt: 0 });
  assert.deepEqual(reviewState({ practicedAt: learnedAt }, start), {
    state: "new",
    dueAt: 0,
  });
  assert.deepEqual(reviewState({ learnedAt }, start + 3 * day - 1), {
    state: "learned",
    dueAt: start + 3 * day,
  });
  assert.deepEqual(reviewState({ learnedAt }, start + 3 * day), {
    state: "due",
    dueAt: start + 3 * day,
  });
});
test("every subsequent review is due seven days after the last recorded review", () => {
  const reviews = [];
  for (let count = 1; count <= 4; count++) {
    const last = start + (3 + (count - 1) * 7) * day;
    reviews.push(new Date(last).toISOString());
    const state = reviewState({ learnedAt, reviews }, last);
    assert.equal(state.dueAt, last + 7 * day);
    assert.notEqual(state.state, "due");
    assert.equal(
      reviewState({ learnedAt, reviews }, last + 7 * day).state,
      "due",
    );
  }
});
test("review progress validates dates and learning paths preserve intended framework IDs", () => {
  assert.equal(isProgress({ learnedAt, reviews: [learnedAt] }), true);
  for (const invalid of [
    null,
    [],
    { learnedAt: "not-a-date" },
    { reviews: [""] },
    { reviews: "2026-09-01" },
  ])
    assert.equal(isProgress(invalid), false);
  assert.equal(learningPath.length, 4);
  assert.deepEqual(
    learningPath.find((path) => path.title === "做出选择").models,
    ["opportunity", "second-order"],
  );
});

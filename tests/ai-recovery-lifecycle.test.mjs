// Synthetic hook harness: executes the actual TSX and async continuations without
// a browser or network. The Playwright companion covers real React/DOM behavior.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const A = "合成测试甲：提前准备可以节省沟通时间。";
const B = "合成测试乙：先听清问题再回答。";
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

function fixture(saved) {
  let current;
  const analyses = [],
    writes = [],
    checks = [];
  let saveGate;
  const react = {
    useState(initial) {
      const owner = current,
        i = owner.cursor++;
      if (!(i in owner.slots))
        owner.slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        owner.slots[i],
        (value) => {
          owner.slots[i] =
            typeof value === "function" ? value(owner.slots[i]) : value;
        },
      ];
    },
    useRef(value) {
      const owner = current,
        i = owner.cursor++;
      return (owner.slots[i] ||= { current: value });
    },
    useEffect(effect, deps) {
      const owner = current,
        i = owner.cursor++,
        before = owner.slots[i];
      if (
        !before ||
        !deps ||
        deps.some((d, j) => !Object.is(d, before.deps[j]))
      ) {
        owner.effects.push(() => {
          before?.cleanup?.();
          owner.slots[i] = { deps, cleanup: effect() };
        });
      }
    },
  };
  react.useLayoutEffect = react.useEffect;
  const jsx = (type, props, key) => ({ type, props, key });
  const noop = () => {};
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "./api": {
      getStatus: () => {
        const d = deferred();
        checks.push(d);
        return d.promise;
      },
      analyze: async (session, requireAI) => {
        analyses.push({ session, requireAI });
        return { source: "ai", improvements: [] };
      },
      transcribe: async () => "",
    },
    "./storage": {
      saveSession: async (session) => {
        writes.push(session);
        if (saveGate) await saveGate.promise;
      },
    },
    "./components": { setNavigationGuard: noop, go: noop },
    "./data": {
      lessons: [],
      topics: ["Synthetic topic"],
      materials: [{ title: "Synthetic", text: "Synthetic" }],
      frameworks: [{}, { id: "test", name: "test", steps: [] }],
      pick: (xs) => xs[0],
      modeNames: {},
      wordGroups: {},
    },
    "./scenarios": { scenarios: [] },
    "./thinkingData": { thinkingModels: [] },
    "./thinkingPractice": { thinkingPractice: {} },
    "./useRecorder": {
      speechSupported: () => false,
      useRecorder: () => ({ phase: "idle", reset: noop }),
    },
  };
  const sandbox = {
    console,
    crypto: { randomUUID: () => "synthetic-id" },
    window: {
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: noop,
      scrollTo: noop,
      confirm: () => true,
    },
    document: { getElementById: () => ({ focus: noop }) },
    Event: class {},
    setTimeout,
    clearTimeout,
  };
  function load(name) {
    if (name in modules) return modules[name];
    if (!["./Practice", "./SavedPractice", "./AIRecovery"].includes(name))
      return {};
    const source = fs.readFileSync(
      new URL(`../src/${name.slice(2)}.tsx`, import.meta.url),
      "utf8",
    );
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const exports = {};
    vm.runInNewContext(`(function(require, exports){${output}\n})`, sandbox)(
      load,
      exports,
    );
    return (modules[name] = exports);
  }
  function mount(component, props) {
    const instance = {
      slots: [],
      cursor: 0,
      effects: [],
      props,
      render() {
        current = this;
        this.cursor = 0;
        this.tree = component(this.props);
        for (const effect of this.effects.splice(0)) effect();
        return this.tree;
      },
      unmount() {
        for (const slot of this.slots) slot?.cleanup?.();
      },
    };
    instance.render();
    return instance;
  }
  const Parent = load(saved ? "./SavedPractice" : "./Practice")[
    saved ? "SavedPractice" : "Practice"
  ];
  const Recovery = load("./AIRecovery").AIRecovery;
  const parent = mount(
    Parent,
    saved
      ? {
          session: {
            id: "saved",
            transcript: A,
            mode: "improv",
            topic: "Synthetic",
          },
          status: { ai: false, reachable: true },
          refresh: async () => {},
          onBusy: noop,
        }
      : {
          mode: "improv",
          search: new URLSearchParams(),
          status: { ai: false, reachable: true },
          onSaved: async () => {},
        },
  );
  function find(node, predicate) {
    if (!node || typeof node !== "object") return;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  const locate = (predicate) => find(parent.tree, predicate);
  if (!saved) {
    locate(
      (n) => n.props?.["aria-label"] === "也可以用文字练习",
    ).props.onClick();
    parent.render();
    locate(
      (n) => n.type === "textarea" && n.props.id === "transcript",
    ).props.onChange({ target: { value: A } });
    parent.render();
  }
  let recovery, recoveryKey;
  function sync() {
    parent.render();
    const element = locate((n) => n.type === Recovery);
    if (!element) {
      recovery?.unmount();
      recovery = undefined;
      return;
    }
    if (!recovery || recoveryKey !== element.key) {
      recovery?.unmount();
      recovery = mount(Recovery, element.props);
      recoveryKey = element.key;
    } else {
      recovery.props = element.props;
      recovery.render();
    }
  }
  sync();
  return {
    analyses,
    writes,
    checks,
    start() {
      locate(
        (n) =>
          n.type === "button" &&
          n.props.className?.includes("primary") &&
          !n.props["aria-label"] &&
          JSON.stringify(n.props.children).includes("生成 AI 点评"),
      ).props.onClick();
      sync();
    },
    edit(value = B) {
      locate(
        (n) =>
          n.type === "textarea" &&
          n.props.id === (saved ? "saved-transcript" : "transcript"),
      ).props.onChange({ target: { value } });
      sync();
    },
    chooseRule() {
      locate(
        (n) =>
          n.props?.value === "auto" && typeof n.props.onChange === "function",
      ).props.onChange("agnes");
      sync();
    },
    basic() {
      locate(
        (n) => n.type === "button" && n.props.children === "查看基础反馈",
      ).props.onClick();
      sync();
    },
    leave() {
      recovery.unmount();
      parent.unmount();
    },
    holdSave() {
      saveGate = deferred();
      return saveGate;
    },
    sync,
  };
}

for (const saved of [false, true]) {
  const label = saved ? "saved" : "fresh";
  test(`${label}: edited draft invalidates pending recovery without persistence or analysis`, async () => {
    const f = fixture(saved);
    f.start();
    f.edit();
    f.checks[0].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 0);
    assert.equal(f.writes.length, 0);
    f.start();
    f.checks[1].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 1);
    assert.equal(f.analyses[0].session.transcript, B);
    assert.equal(f.analyses[0].requireAI, true);
  });
  test(`${label}: leaving invalidates pending recovery without persistence or analysis`, async () => {
    const f = fixture(saved);
    f.start();
    f.leave();
    f.checks[0].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 0);
    assert.equal(f.writes.length, 0);
  });
  test(`${label}: newer request supersedes older status response`, async () => {
    const f = fixture(saved);
    f.start();
    f.start();
    f.checks[1].resolve({ ai: true });
    await tick();
    f.checks[0].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 1);
    assert.equal(f.analyses[0].requireAI, true);
  });
  test(`${label}: successful recovery saves and analyzes exactly once`, async () => {
    const f = fixture(saved);
    f.start();
    f.checks[0].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 1);
    assert.equal(f.analyses[0].session.transcript, A);
    assert.equal(f.analyses[0].requireAI, true);
    assert.equal(f.writes.length, 2);
    assert.equal(f.writes[1].feedback.source, "ai");
  });
  test(`${label}: leaving during persistence never starts an abandoned analysis`, async () => {
    const f = fixture(saved),
      gate = f.holdSave();
    f.start();
    f.checks[0].resolve({ ai: true });
    await tick();
    assert.equal(f.writes.length, 1);
    f.leave();
    gate.resolve();
    await tick();
    assert.equal(f.analyses.length, 0);
    assert.equal(f.writes.length, 1);
  });
}

for (const saved of [false, true]) {
  test(`${saved ? "saved" : "fresh"}: old status cannot consume a newer pending intent`, async () => {
    const f = fixture(saved);
    f.start();
    f.start();
    f.checks[0].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 0);
    assert.equal(f.writes.length, 0);
    f.checks[1].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 1);
  });
  test(`${saved ? "saved" : "fresh"}: editing back to the original text does not revive an old intent`, async () => {
    const f = fixture(saved);
    f.start();
    f.edit();
    f.edit(A);
    f.checks[0].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 0);
    assert.equal(f.writes.length, 0);
  });
}

for (const saved of [false, true]) {
  test(`${saved ? "saved" : "fresh"}: rule changes invalidate pending recovery`, async () => {
    const f = fixture(saved);
    f.start();
    f.chooseRule();
    f.checks[0].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 0);
    assert.equal(f.writes.length, 0);
  });
  test(`${saved ? "saved" : "fresh"}: basic feedback takes ownership without a delayed AI replay`, async () => {
    const f = fixture(saved);
    f.start();
    f.basic();
    await tick();
    f.checks[0].resolve({ ai: true });
    await tick();
    assert.equal(f.analyses.length, 1);
    assert.equal(f.analyses[0].requireAI, false);
  });
}

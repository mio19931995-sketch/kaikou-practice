import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const { createServiceSettings } = createRequire(import.meta.url)(
  "../desktop/service-settings.cjs",
);
function setup(t, fetcher) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kaikou-settings-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const settings = { ASR_API_KEY: "asr-untouched" };
  const options = {
    settings,
    file: path.join(directory, "ai.json"),
    encrypt: (value) => Buffer.from(value),
    decrypt: (value) => value.toString(),
    fetcher,
  };
  return { api: createServiceSettings(options), options, settings };
}
const input = {
  baseUrl: "https://example.com/v1",
  model: "test-model",
  apiKey: "test-secret",
};
test("save applies immediately, survives restart, never returns a key, preserves ASR", (t) => {
  const { api, options, settings } = setup(t);
  assert.deepEqual(api.save(input), {
    baseUrl: input.baseUrl,
    model: input.model,
    hasKey: true,
  });
  assert.equal(settings.AI_API_KEY, input.apiKey);
  assert.equal(settings.ASR_API_KEY, "asr-untouched");
  assert.equal(
    createServiceSettings({ ...options, settings: {} }).read().hasKey,
    true,
  );
  api.save({ ...input, apiKey: "" });
  assert.equal(settings.AI_API_KEY, input.apiKey);
  assert.throws(
    () =>
      api.save({ ...input, baseUrl: "https://other.example/v1", apiKey: "" }),
    /重新填写/,
  );
  api.save({ ...input, apiKey: "", clearKey: true });
  assert.equal(settings.AI_API_KEY, "");
  assert.equal(
    createServiceSettings({ ...options, settings: {} }).read().hasKey,
    false,
  );
});
test("invalid URLs and injected fields are rejected before sending", async (t) => {
  const { api } = setup(t, () => {
    throw new Error("should not call");
  });
  for (const baseUrl of [
    "http://remote.example/v1",
    "https://user:secret@example.com",
    "file:///tmp/a",
    "https://example.com/?key=abc",
  ]) {
    await assert.rejects(api.test({ ...input, baseUrl }));
  }
  assert.throws(() => api.save({ ...input, apiKey: "key\nNEXT=value" }));
});
test("connection test sends only a fixed prompt, does not save, rejects malformed output", async (t) => {
  let request;
  const { api, settings } = setup(t, async (url, args) => {
    request = { url, args };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: "OK" } }] }),
    };
  });
  assert.equal((await api.test(input)).ok, true);
  assert.equal(request.url, "https://example.com/v1/chat/completions");
  assert.equal(request.args.redirect, "error");
  assert.equal(
    JSON.parse(request.args.body).messages[0].content,
    "只回复 OK。",
  );
  assert.equal(settings.AI_API_KEY, undefined);
  const bad = setup(t, async () => ({ ok: true, json: async () => ({}) }));
  assert.equal((await bad.api.test(input)).ok, false);
});
test("provider failures and network errors do not leak response text or credentials", async (t) => {
  const failed = setup(t, async () => ({ ok: false, status: 401 }));
  assert.match((await failed.api.test(input)).message, /密钥无效/);
  const network = setup(t, async () => {
    throw new Error(input.apiKey);
  });
  assert.equal(
    JSON.stringify(await network.api.test(input)).includes(input.apiKey),
    false,
  );
});

test("EXDEV fallback replaces encrypted data and restores previous data on copy failure", (t) => {
  const { persistRecord } = createRequire(import.meta.url)(
    "../desktop/service-settings.cjs",
  );
  const { options } = setup(t);
  const io = {
    ...fs,
    renameSync() {
      throw Object.assign(new Error("redirected directory"), { code: "EXDEV" });
    },
  };
  persistRecord(options.file, { key: "encrypted-first" }, io);
  persistRecord(options.file, { key: "encrypted-second" }, io);
  assert.equal(
    JSON.parse(fs.readFileSync(options.file)).key,
    "encrypted-second",
  );
  assert.throws(() =>
    persistRecord(
      options.file,
      { key: "encrypted-third" },
      {
        ...io,
        copyFileSync(_source, target) {
          fs.writeFileSync(target, "partial");
          throw Object.assign(new Error("disk full"), { code: "ENOSPC" });
        },
      },
    ),
  );
  assert.equal(
    JSON.parse(fs.readFileSync(options.file)).key,
    "encrypted-second",
  );
});
test("first save interrupted before rename recovers the encrypted pending configuration", (t) => {
  const { options } = setup(t);
  fs.writeFileSync(
    `${options.file}.tmp`,
    JSON.stringify({
      baseUrl: input.baseUrl,
      model: input.model,
      key: Buffer.from(input.apiKey).toString("base64"),
    }),
  );
  const loaded = createServiceSettings(options);
  assert.equal(loaded.read().hasKey, true);
  assert.equal(fs.existsSync(options.file), true);
  assert.equal(options.settings.AI_API_KEY, input.apiKey);
});

test("Jev connection uses System One without changing saved configuration", async t => {
  const { api } = setup(t, async (url, options) => {
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "jev-latest"); assert.equal(body.questions.connection.type, "choice");
    return Response.json({ answers: { connection: { type: "choice", choice: "yes", probabilities: { yes: 0.99, no: 0.01 }, confidence: 0.99 } } });
  });
  const result = await api.test({ baseUrl: "https://api.typesafe.ai/v1", model: "jev-latest", apiKey: "test-key" });
  assert.equal(result.ok, true); assert.equal(api.read().hasKey, false);
});

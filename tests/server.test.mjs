import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { basicFeedback } from "../server/feedback.mjs";
const sample = {
  mode: "logic",
  topic: "怎样开好一次会？",
  framework: "PREP",
  transcript:
    "我建议提前分享会议材料。因为这样大家可以先了解背景，例如把进度写在共享文档里。最后在会上只讨论需要解决的问题。",
  duration: 30,
};
test("DeepSeek preset requests JSON and disables thinking without leaking parameters to other providers", async () => {
  await serve(
    {
      env: {
        AI_API_KEY: "test-key",
        AI_BASE_URL: "https://api.deepseek.com",
        AI_MODEL: "deepseek-flash",
      },
      fetcher: async (url, options) => {
        assert.equal(url, "https://api.deepseek.com/chat/completions");
        const body = JSON.parse(options.body);
        assert.deepEqual(body.thinking, { type: "disabled" });
        assert.deepEqual(body.response_format, { type: "json_object" });
        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "表达完整。",
                  dimensions: [{ title: "结构组织", text: "观点后有解释。" }],
                  improvements: ["补充一个具体例子。"],
                  rewrite: "试着明确说明建议。",
                }),
              },
            },
          ],
        });
      },
    },
    async (base) => {
      const res = await post(base, sample);
      assert.equal(res.status, 200);
      assert.equal((await res.json()).source, "ai");
    },
  );
});
async function serve(options, run) {
  const server = createApp(options).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
const post = (base, body) =>
  fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("unconfigured service reports capabilities without secrets and gives honest basic feedback", async () =>
  serve({ env: {} }, async (base) => {
    assert.deepEqual(await (await fetch(`${base}/api/status`)).json(), {
      ai: false,
      asr: false,
    });
    const response = await post(base, sample);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.source, "basic");
    assert.equal(data.rewrite, "");
    assert.match(data.summary, /不是 AI/);
    assert.equal(data.metrics.duration, 30);
    assert.ok(data.metrics.characters > 20);
    assert.equal(data.score, undefined);
  }));
test("input validation rejects empty text, invalid mode, oversized text, negative duration", async () =>
  serve({ env: {} }, async (base) => {
    for (const change of [
      { transcript: " " },
      { mode: "admin" },
      { transcript: "字".repeat(6001) },
      { duration: -3 },
    ]) {
      assert.equal((await post(base, { ...sample, ...change })).status, 400);
    }
  }));
test("cross origin requests cannot use the AI endpoint", async () =>
  serve({ env: {} }, async (base) => {
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sample),
    });
    assert.equal(res.status, 403);
  }));
test("AI route sends user material as data and validates structured response", async () => {
  const expected = {
    summary: "观点明确，可以补充一个具体结果。",
    dimensions: [{ title: "结构组织", text: "先提出建议，再给理由和例子。" }],
    improvements: ["说明这项改变带来了什么结果。"],
    rewrite: "我建议会前共享材料，把会上时间留给共同解决问题。",
  };
  await serve(
    {
      env: {
        AI_API_KEY: "test-secret",
        AI_BASE_URL: "https://provider.example/v1/",
        AI_MODEL: "model",
      },
      fetcher: async (url, options) => {
        assert.equal(url, "https://provider.example/v1/chat/completions");
        assert.equal(options.headers.Authorization, "Bearer test-secret");
        const body = JSON.parse(options.body);
        assert.equal(body.messages[0].role, "system");
        assert.equal(
          JSON.parse(body.messages[1].content).transcript,
          sample.transcript,
        );
        return Response.json({
          choices: [
            {
              message: {
                content: `\u0060\u0060\u0060json\n${JSON.stringify(expected)}\n\u0060\u0060\u0060`,
              },
            },
          ],
        });
      },
    },
    async (base) => {
      const res = await post(base, sample);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.source, "ai");
      assert.equal(data.summary, expected.summary);
      assert.equal(JSON.stringify(data).includes("test-secret"), false);
    },
  );
});
test("provider failure or malformed AI output is an error, never a fake report", async () => {
  for (const upstream of [
    new Response("private details", { status: 401 }),
    Response.json({ choices: [{ message: { content: "not json" } }] }),
    Response.json({ choices: [{ message: { content: "{}" } }] }),
  ]) {
    await serve(
      {
        env: {
          AI_API_KEY: "key",
          AI_BASE_URL: "https://example.com/v1",
          AI_MODEL: "model",
        },
        fetcher: async () => upstream,
      },
      async (base) => {
        const res = await post(base, sample);
        assert.equal(res.status, 502);
        const body = await res.json();
        assert.ok(body.error);
        assert.equal(body.source, undefined);
        assert.equal(JSON.stringify(body).includes("private details"), false);
      },
    );
  }
});
test("ASR uses multipart binary upload and returns transcript only", async () =>
  serve(
    {
      env: {
        ASR_API_KEY: "asr-key",
        ASR_BASE_URL: "https://provider.example/v1",
        ASR_MODEL: "asr",
      },
      fetcher: async (_url, options) => {
        assert.equal(options.body.get("model"), "asr");
        assert.equal(
          (await options.body.get("file").arrayBuffer()).byteLength,
          8,
        );
        return Response.json({
          text: "这是一次语音练习。",
          internal: "hidden",
        });
      },
    },
    async (base) => {
      const body = new FormData();
      body.append(
        "audio",
        new Blob(["RIFFtest"], { type: "audio/wav" }),
        "test.wav",
      );
      const res = await fetch(`${base}/api/transcribe`, {
        method: "POST",
        body,
      });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { text: "这是一次语音练习。" });
    },
  ));
test("unconfigured ASR is unavailable rather than returning invented words", async () =>
  serve({ env: {} }, async (base) => {
    const body = new FormData();
    body.append("audio", new Blob(["test"], { type: "audio/wav" }), "a.wav");
    const res = await fetch(`${base}/api/transcribe`, { method: "POST", body });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).text, undefined);
  }));
test("basic text metrics exclude punctuation and do not claim semantic accuracy", () => {
  const result = basicFeedback({
    ...sample,
    transcript: "嗯，然后，我想说。",
    duration: 0,
  });
  assert.equal(result.metrics.characters, 6);
  assert.equal(result.metrics.fillers, 2);
  assert.equal(result.metrics.duration, 0);
  assert.match(result.dimensions[0].text, /未提供录音/);
});

test('saved configuration refreshes status and is used for AI requests', async () => {
  const env = {};
  let available = false;
  await serve({ env, refreshConfig: () => { if (available) Object.assign(env, { AI_BASE_URL: 'https://example.test/v1', AI_MODEL: 'test', AI_API_KEY: 'test-key' }); }, fetcher: async () => Response.json({ choices: [{ message: { content: JSON.stringify({ summary: '表达清楚。', dimensions: [{ title: '结构', text: '观点明确。' }], improvements: ['补充例子。'], rewrite: '先说结论，再说原因。' }) } }] }) }, async base => {
    assert.equal((await (await fetch(`${base}/api/status`)).json()).ai, false);
    available = true;
    assert.equal((await (await fetch(`${base}/api/status`)).json()).ai, true);
    assert.equal((await (await post(base, sample)).json()).source, 'ai');
  });
});
test('configuration read failures cannot silently produce basic feedback', async () => {
  await serve({ env: {}, refreshConfig: () => { throw new Error('unreadable encrypted configuration'); } }, async base => {
    const response = await post(base, sample);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).source, undefined);
  });
});

test('AI report formatting repairs quoted speech without inventing missing report fields', async () => {
  const { parseReport } = await import('../server/feedback.mjs');
  const report = { summary: '观点清晰。', dimensions: [{ title: '结构', text: '原话"提前准备"明确了观点。' }], improvements: ['补充例子。'], rewrite: '提前准备能减少沟通时间。' };
  const malformed = JSON.stringify(report).replaceAll('\\"', '"');
  assert.throws(() => JSON.parse(malformed));
  assert.equal(parseReport(malformed, sample).source, 'ai');
  assert.equal(parseReport(malformed, sample).dimensions[0].text, report.dimensions[0].text);
  assert.throws(() => parseReport('{"summary":"只有总评"}', sample));
  assert.throws(() => parseReport('{"summary":"未完成', sample));
});

test("Jev batches four judgments and preserves distributions without fabricated rewrite", async () => {
  await serve({ env: { AI_API_KEY: "test", AI_BASE_URL: "https://api.typesafe.ai/v1", AI_MODEL: "jev-latest" }, fetcher: async (url, options) => {
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    const request = JSON.parse(options.body);
    assert.equal(request.state.transcript, sample.transcript);
    assert.equal(Object.keys(request.questions).length, 8);
    assert.equal(request.messages, undefined);
    return Response.json({ model: "jev-test", answers: Object.fromEntries(Object.entries(request.questions).map(([id, q]) => [id, id.endsWith("_evidence") ? { type: "choice", choice: "none", confidence: 1, probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === "none" ? 1 : 0])) } : { type: "choice", choice: "needs_work", confidence: 0.8, probabilities: { clear: 0.1, needs_work: 0.8, insufficient: 0.1 } }])) });
  } }, async base => {
    const res = await post(base, sample); const body = await res.json();
    assert.equal(res.status, 200); assert.equal(body.provider, "jev"); assert.equal(body.source, "ai");
    assert.equal(body.rewrite, ""); assert.equal(body.judgments.focus.probabilities.needs_work, 0.8);
  });
});
test("Incomplete Jev answers fail explicitly without basic fallback", async () => {
  await serve({ env: { AI_API_KEY: "test", AI_BASE_URL: "https://api.typesafe.ai/v1", AI_MODEL: "jev-latest" }, fetcher: async () => Response.json({ model: "jev", answers: {} }) }, async base => {
    const res = await post(base, sample); assert.equal(res.status, 502); assert.equal((await res.json()).source, undefined);
  });
});

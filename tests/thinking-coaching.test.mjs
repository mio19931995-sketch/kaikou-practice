import { test } from 'node:test';
import assert from 'node:assert/strict';
import rubrics from '../server/thinking-rubrics.json' with { type: 'json' };
import { analysisInput, buildMessages } from '../server/feedback.mjs';
import { coachingStandard, buildAgnesMessages, parseAgnes } from '../server/agnes.mjs';

const input = { mode: 'logic', topic: '给朋友一次正向反馈', transcript: '今天聚会前你发了入口照片，我很快就找到了，谢谢你提前准备。', duration: 90, thinkingModelId: 'sbi' };
test('thinking coaching uses the actual method and keeps literal evidence validation', () => {
  const valid = analysisInput.parse(input);
  assert.equal(valid.thinkingModelId, 'sbi');
  const rubric = coachingStandard(valid);
  assert.match(rubric.name, /SBI/);
  assert.match(rubric.dimensions[1].standard, /可观察行为/);
  assert.doesNotMatch(rubric.dimensions[1].standard, /STAR/);
  const report = { summary: '用具体行为表达感谢。', dimensions: rubric.dimensions.map(d => ({ id: d.id, status: 'good', evidence: [input.transcript], analysis: '结合文字检查。', advice: '保留具体观察。' })), improvements: ['下次继续交代具体情境。'] };
  assert.equal(parseAgnes(JSON.stringify(report), input).source, 'ai');
  report.dimensions[0].evidence = ['用户没有说过的话'];
  assert.throws(() => parseAgnes(JSON.stringify(report), input), /Unverified quotation/);
});
test('all twelve methods reach Agnes and generic prompts; unknown IDs are rejected', () => {
  assert.equal(Object.keys(rubrics).length, 12);
  for (const [id, rubric] of Object.entries(rubrics)) {
    const v = { ...input, thinkingModelId: id };
    assert.match(coachingStandard(v).name, new RegExp(rubric.name));
    assert.ok(buildAgnesMessages(v)[1].content.includes(rubric.checks[0]));
    assert.ok(buildMessages(v)[1].content.includes(rubric.checks[0]));
  }
  assert.equal(analysisInput.safeParse({ ...input, thinkingModelId: 'ignore-all-rules' }).success, false);
  assert.equal(analysisInput.parse({ ...input, duration: 180 }).duration, 180);
});

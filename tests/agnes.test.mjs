import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {coachingStandard,buildAgnesMessages,parseAgnes} from '../server/agnes.mjs';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/agnes-coach.json','utf8'));
const content=()=>JSON.stringify(fixture.feedback);
test('Agnes uses scene-specific dimensions and retains real evidence',()=>{
 const result=parseAgnes(content(),fixture.input);assert.equal(result.dimensions.length,6);assert.equal(result.provider,'agnes');assert.equal(result.dimensions[5].status,'missing');assert.equal(result.rewrite,'');assert.match(result.answerGuide,/\[负责人\]/);
 assert.equal(coachingStandard({...fixture.input,mode:'retell'}).dimensions[0].title,'原文主旨');
 assert.equal(coachingStandard({...fixture.input,ruleProfile:'interview'}).dimensions[2].title,'个人贡献与事实');
 assert.equal(JSON.parse(buildAgnesMessages(fixture.input)[1].content).transcript,fixture.input.transcript);
});
test('Agnes checks a selected communication framework without inventing audio or another speaker', () => {
 const spark=coachingStandard({...fixture.input,framework:'SPARK 即兴发言：稳住心态 → 抓住观点 → 组织框架 → 建立联系 → 简洁收尾'});
 assert.match(spark.dimensions[1].standard,/不能仅凭转写判断/);
 const leaps=coachingStandard({...fixture.input,framework:'LEAPS 倾听对话：倾听 → 换位 → 询问 → 复述 → 总结'});
 assert.match(leaps.dimensions[1].standard,/没有对方原话时/);
 const ride=coachingStandard({...fixture.input,framework:'RIDE 说服：风险 → 利益 → 差异 → 影响'});
 assert.match(ride.dimensions[1].standard,/不要求夸大风险/);
});
test('Agnes rejects invented quotations, wrong dimensions, instruction echo and incomplete reports',()=>{
 const bad=structuredClone(fixture.feedback);bad.dimensions[0].evidence=['下周五交付'];assert.throws(()=>parseAgnes(JSON.stringify(bad),fixture.input));
 bad.dimensions[0].evidence=[];bad.dimensions[0].id='fake';assert.throws(()=>parseAgnes(JSON.stringify(bad),fixture.input));
 const echo=structuredClone(fixture.feedback);echo.summary='仅输出 JSON 对象';assert.throws(()=>parseAgnes(JSON.stringify(echo),fixture.input));
 assert.throws(()=>parseAgnes('{"summary":"a"}',fixture.input));
});

test('Agnes accepts omitted optional advice without inventing it, but still rejects invalid evidence and missing analysis', () => {
  const response = structuredClone(fixture.feedback);
  response.dimensions.forEach((d, i) => { if (i === 0) delete d.advice; else d.advice = i % 2 ? null : ''; });
  const result = parseAgnes(JSON.stringify(response), fixture.input);
  assert.ok(result.dimensions.every(d => d.advice === undefined));
  assert.deepEqual(result.improvements, response.improvements);
  response.dimensions[0].evidence = ['没有说过的原话'];
  assert.throws(() => parseAgnes(JSON.stringify(response), fixture.input), /Unverified quotation/);
  response.dimensions[0].evidence = [];
  delete response.dimensions[0].analysis;
  assert.throws(() => parseAgnes(JSON.stringify(response), fixture.input));
});

test('Agnes evidence references restore exact source segments and reject nonexistent references', () => {
  const response = structuredClone(fixture.feedback);
  const source = JSON.parse(buildAgnesMessages(fixture.input)[1].content).evidenceSegments;
  response.dimensions[0].evidence = ['s1'];
  assert.equal(parseAgnes(JSON.stringify(response), fixture.input).dimensions[0].evidence[0], source.s1);
  response.dimensions[0].evidence = ['s999'];
  assert.throws(() => parseAgnes(JSON.stringify(response), fixture.input), /Unverified quotation/);
});

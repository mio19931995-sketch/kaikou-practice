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
test('Agnes rejects invented quotations, wrong dimensions, instruction echo and incomplete reports',()=>{
 const bad=structuredClone(fixture.feedback);bad.dimensions[0].evidence=['下周五交付'];assert.throws(()=>parseAgnes(JSON.stringify(bad),fixture.input));
 bad.dimensions[0].evidence=[];bad.dimensions[0].id='fake';assert.throws(()=>parseAgnes(JSON.stringify(bad),fixture.input));
 const echo=structuredClone(fixture.feedback);echo.summary='仅输出 JSON 对象';assert.throws(()=>parseAgnes(JSON.stringify(echo),fixture.input));
 assert.throws(()=>parseAgnes('{"summary":"a"}',fixture.input));
});

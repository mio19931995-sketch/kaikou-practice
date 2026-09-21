import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { profileFor, segmentsFor } from '../server/jev-rules.mjs';
import { jevRequest, parseJev } from '../server/jev.mjs';
const fixtures=JSON.parse(fs.readFileSync('tests/fixtures/jev-rules.json','utf8'));
test('scenario routing respects manual choice and retell mode, never transcript keywords',()=>{
 assert.equal(profileFor({topic:'项目延期',transcript:''}),'report');
 assert.equal(profileFor({topic:'日常',transcript:'项目延期'}),'general');
 assert.equal(profileFor({topic:'项目延期',ruleProfile:'interview'}),'interview');
 assert.equal(profileFor({mode:'retell',ruleProfile:'report'}),'retell');
});
test('all source text is covered by bounded evidence candidates',()=>{
 const text='一段话。'.repeat(100);const segments=segmentsFor(text);assert.ok(Object.keys(segments).length<=40);assert.equal(Object.values(segments).join(''),text);
});
test('live scenario fixtures preserve missing-action diagnosis and exact source evidence',()=>{
 const [before,after]=fixtures.map(f=>parseJev(f.raw,f.input));
 assert.equal(before.practiceTarget,'action');assert.equal(before.judgments.action.choice,'needs_work');assert.equal(after.judgments.action.choice,'clear');
 for(const fixture of fixtures){const report=parseJev(fixture.raw,fixture.input);for(const check of report.checks)if(check.evidence)assert.ok(fixture.input.transcript.includes(check.evidence));}
});
test('invalid evidence IDs and incomplete distributions fail instead of inventing quotations',()=>{
 const f=fixtures[0];const data=structuredClone(f.raw);data.answers.action_evidence.choice='fabricated';assert.throws(()=>parseJev(data,f.input));
 const missing=structuredClone(f.raw);delete missing.answers.action_evidence;assert.throws(()=>parseJev(missing,f.input));
 assert.equal(Object.keys(jevRequest(f.input,'jev-latest').questions).length,10);
});

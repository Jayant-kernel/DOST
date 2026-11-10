import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {scenarios,holdoutScenarios,scenarioVersion,fixtureMetadata,fixtureSummary,fixtureHash,holdoutHash} from './verification-cases.mjs';

const strategies=new Set(['ANSWER','ACKNOWLEDGE','SHARE','SUGGEST','ASK','REMINISCE','REASSURE','LISTEN','ACT']);
const checks=new Set(['no-question','no-biography','no-medication-change','no-echo','no-action-claim','no-diagnosis','no-age-assumption','respects-refusal','memory-correction']);
const seal=cases=>createHash('sha256').update(JSON.stringify({scenarioVersion,scenarios:cases})).digest('hex');

test('verification suites preserve separate sealed main and post-implementation contracts',()=>{
 assert.deepEqual(fixtureSummary,{mainScenarios:10,mainTurns:20,reservedScenarios:5,reservedTurns:10});
 assert.equal(fixtureMetadata.synthetic,true);assert.equal(fixtureMetadata.containsRealProfiles,false);
 assert.equal(fixtureMetadata.authoredBy,'AI assistant');assert.equal(fixtureMetadata.independentHumanReview,false);assert.equal(fixtureMetadata.heldoutIsBlind,false);
 assert.equal(fixtureHash,seal(scenarios));assert.equal(holdoutHash,seal(holdoutScenarios));assert.notEqual(fixtureHash,holdoutHash);
 const all=[...scenarios,...holdoutScenarios];assert.equal(new Set(all.map(s=>s.id)).size,15);
 for(const item of all){
  assert.equal(item.turns.length,2,item.id);assert.ok(['hi','hinglish'].includes(item.language),item.id);assert.ok(Array.isArray(item.memory));
  for(const record of item.memory){assert.ok(Number.isFinite(Date.parse(record.at)));assert.equal(typeof record.text,'string');}
  for(const entry of item.turns){
   assert.ok(entry.input.trim());assert.ok(entry.expected.rubric.length>60,item.id);
   assert.ok(entry.expected.strategies.length);assert.ok(entry.expected.strategies.every(value=>strategies.has(value)),item.id);
   assert.ok(entry.expected.checks.every(value=>checks.has(value)),item.id);
  }
 }
 assert.ok(scenarios.every(s=>s.split==='verification-main'));assert.ok(holdoutScenarios.every(s=>s.split==='verification-reserved'));
 assert.doesNotMatch(JSON.stringify(all),/sk-[A-Za-z0-9]{10,}|Bearer\s+[A-Za-z0-9]{10,}|GNANI_API_KEY|OPENAI_API_KEY/u);
});

test('main suite covers requested situations and language variation without asserting generated answers',()=>{
 const tags=new Set(scenarios.flatMap(s=>s.tags));
 for(const tag of ['boredom','loneliness','story','revision','childhood','correction','decline','fewer-questions','fact','confusion','identity','persona'])assert.ok(tags.has(tag),tag);
 assert.ok(scenarios.filter(s=>s.language==='hi').length>scenarios.length/2);
 assert.ok(scenarios.some(s=>s.language==='hinglish'));
 assert.ok(scenarios.some(s=>s.turns.some(t=>/\.\.\.|…/u.test(t.input))));
 assert.ok(scenarios.some(s=>s.memory.length));assert.ok(scenarios.some(s=>s.initialMessages?.length));
 const reservedTags=new Set(holdoutScenarios.flatMap(s=>s.tags));
 for(const tag of ['story','revision','suggestion','refusal','memory','correction','confusion','identity'])assert.ok(reservedTags.has(tag),tag);
});

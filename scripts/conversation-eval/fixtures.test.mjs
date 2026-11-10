import {test} from 'node:test';import assert from 'node:assert/strict';
import {scenarios,scenarioVersion,fixtureMetadata,fixtureSummary,checkIds} from './fixtures.mjs';
const strategies=new Set(['ANSWER','ACKNOWLEDGE','SHARE','SUGGEST','ASK','REMINISCE','REASSURE','LISTEN','ACT']);
test('evaluation contract supplies diverse multi-turn synthetic cases with explicit review limits',()=>{
 assert.match(scenarioVersion,/^\d+\.\d+\.\d+$/);assert.equal(fixtureMetadata.synthetic,true);assert.equal(fixtureMetadata.heldoutIsBlind,false);
 assert.ok(fixtureSummary.development>=30);assert.ok(fixtureSummary.heldoutDesignated>=4);assert.ok(fixtureSummary.turns>=100);
 assert.equal(new Set(scenarios.map(item=>item.id)).size,scenarios.length);
 for(const item of scenarios){
  assert.ok(item.turns.length>=3,item.id);assert.ok(['hi','hinglish'].includes(item.language));
  assert.ok(['development','heldout-designated'].includes(item.split));assert.ok(Array.isArray(item.memory));
  for(const record of item.memory){assert.ok(Number.isFinite(Date.parse(record.at)));assert.equal(typeof record.text,'string');}
  for(const entry of item.turns){
   assert.ok(entry.input.trim());assert.ok(entry.expected.rubric.length>=25,item.id);
   assert.ok(entry.expected.strategies.length);assert.ok(entry.expected.strategies.every(value=>strategies.has(value)),item.id);
   assert.ok(entry.expected.checks.every(value=>checkIds.includes(value)),item.id);
  }
 }
});
test('requested situations, language variation, ambiguity and negative controls remain covered',()=>{
 const tags=new Set(scenarios.flatMap(item=>item.tags));
 for(const tag of ['bored','lonely','positive','dislike','not-eaten','autonomy','childhood','jammu','kashmir','repetition','story','activity','questions','quiet','topic-change','facts','sadness','family','correction','ambiguity','confusion','interruption','asr','hinglish','privacy','quotes','medicine','safety'])assert.ok(tags.has(tag),tag);
 assert.ok(scenarios.some(item=>item.turns.some(entry=>entry.interrupt)));
 assert.ok(scenarios.some(item=>item.memory.length&&item.tags.includes('correction')));
 assert.ok(scenarios.some(item=>item.initialMessages?.length));
 const texts=scenarios.flatMap(item=>item.turns.map(entry=>entry.input));
 assert.ok(texts.some(text=>text==='now'));assert.ok(texts.some(text=>text==='नहीं।'));
 assert.ok(texts.some(text=>/\.\.\.|…/u.test(text)));
 assert.doesNotMatch(JSON.stringify(scenarios),/sk-[A-Za-z0-9]{10,}|Bearer\s+[A-Za-z0-9]{10,}|GNANI_API_KEY|OPENAI_API_KEY/u);
});

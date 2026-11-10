import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {scenarios,scenarioVersion,fixtureMetadata,fixtureSummary,fixtureHash,semanticRubric,semanticDimensions,createHumanReviewTemplate} from './phase2-cases.mjs';
const strategies=new Set(['ANSWER','ACKNOWLEDGE','SHARE','SUGGEST','ASK','REMINISCE','REASSURE','LISTEN','ACT']);
const checks=new Set(['no-question','no-biography','no-medication-change','no-echo','no-action-claim','no-diagnosis','no-age-assumption','respects-refusal','memory-correction']);
test('new Phase2 fixture contract seals36 novel multi-turn synthetic inputs with both languages and explicit rubrics',()=>{
 assert.equal(scenarioVersion,'2.0.0');assert.equal(fixtureMetadata.synthetic,true);assert.equal(fixtureMetadata.heldoutIsBlind,false);
 assert.equal(fixtureSummary.scenarios,12);assert.equal(fixtureSummary.turns,36);assert.deepEqual(fixtureSummary.languages,['hi','hinglish']);
 assert.equal(new Set(scenarios.map(s=>s.id)).size,12);assert.equal(new Set(scenarios.flatMap(s=>s.turns.map(t=>t.input))).size,36);
 const tags=new Set(scenarios.flatMap(s=>s.tags));for(const tag of ['cheerful','contribution','sadness','story','facts','refusal','retention','biography','correction','asr','persona','ambiguity'])assert.ok(tags.has(tag),tag);
 for(const item of scenarios){assert.equal(item.split,'new-phase2');assert.equal(item.turns.length,3);for(const t of item.turns){assert.ok(t.input.trim());assert.ok(t.expected.strategies.every(s=>strategies.has(s)));assert.ok(t.expected.checks.every(c=>checks.has(c)));assert.ok(t.expected.rubric.length>50);}}
 assert.equal(fixtureHash,createHash('sha256').update(JSON.stringify({scenarioVersion,scenarios,semanticRubric})).digest('hex'));
 assert.doesNotMatch(JSON.stringify(scenarios),/sk-[A-Za-z0-9]{10,}|Bearer\s+[A-Za-z0-9]{10,}|GNANI_API_KEY|OPENAI_API_KEY/u);
});
test('independent human review stays unrated and covers every turn and all ten semantic dimensions',()=>{
 const template=createHumanReviewTemplate();assert.equal(template.fixtureHash,fixtureHash);assert.equal(template.status,'awaiting-independent-human-review');assert.equal(template.reviewer,null);assert.equal(template.reviewerConsent,null);assert.equal(template.automatedScoresAreIndependentHuman,false);
 assert.equal(semanticDimensions.length,10);assert.equal(template.rows.length,36);
 for(const row of template.rows){assert.deepEqual(Object.keys(row.ratings),semanticDimensions);assert.ok(Object.values(row.ratings).every(v=>v===null));assert.equal(row.notes,null);}
 const other=createHumanReviewTemplate();template.rows[0].ratings.meaning=2;assert.equal(other.rows[0].ratings.meaning,null);
});

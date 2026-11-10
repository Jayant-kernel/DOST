import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {directConversation} from './conversation-director.ts';
import {createProviders,ProviderError,type Message} from './providers.ts';
import {storyResponseRequested} from './conversation-commands.ts';

const opening:Message[]=[{role:'user',content:'एक छोटी कहानी सुनाइए जिसमें बस अड्डे पर किसी की मदद होती हो।'},{role:'assistant',content:'बस अड्डे पर एक आदमी अपना टिकट ढूँढ़ रहा था। एक यात्री ने उसकी मदद की।'}];
const revisions=['अच्छा, उसमें टिकट खोने वाले आदमी की जगह एक बच्ची कर दीजिए।','अब बच्ची सुरक्षित अपने नाना से मिल जाए, ऐसा अंत कीजिए।','आगे सुनाइए।','Change the ending so the character finds the ticket.','मेरा मतलब, कहानी का अंत बदल दीजिए।'];

test('a direct revision of the recent requested story is an answer request with unchanged budget',()=>{
 for(const content of revisions){
  const result=directConversation({messages:[...opening,{role:'user',content}]});
  assert.equal(result.decision.action,'ANSWER',content);assert.equal(result.decision.topic,'story');assert.equal(result.decision.questionNeeded,false);assert.equal(result.decision.maxTokens,160);
 }
 const follow:Message[]=[...opening,{role:'user',content:revisions[0]},{role:'assistant',content:'बच्ची को उसका टिकट मिल गया।'},{role:'user',content:revisions[1]}];
 assert.equal(directConversation({messages:follow}).decision.action,'ANSWER');
});

test('a completed recorded story revision uses story shape allowance without lifting truncation or biography guards',async()=>{
 const report=JSON.parse(await readFile(new URL('../../../tests/fixtures/story-revision.json',import.meta.url),'utf8'));
 const row=report.rows.find((r:{turn:number})=>r.turn===2);
 assert.equal(row.stop,'eos');assert.equal(row.failureDetail,'behaviour-rejected');
 const messages:Message[]=[...row.prior,{role:'user',content:row.input}];
 const config={apiKey:'unused',evonUrl:'http://synthetic',voice:'Shivani',behaviourPolicy:'persona_v2' as const,decision:directConversation({messages}).decision};
 const response=(content:string,finish_reason='stop')=>async()=>Response.json({choices:[{message:{content},finish_reason}]});
 assert.equal(await createProviders(config,response(row.rawResponse)).reply(messages),row.rawResponse);
 await assert.rejects(createProviders(config,response(row.rawResponse,'length')).reply(messages),ProviderError);
 await assert.rejects(createProviders(config,response('हाँ, मैं भी शिक्षक था।')).reply(messages),ProviderError);
 for(const prior of [[],[...opening,{role:'user' as const,content:'अब मौसम की बात करें।'},{role:'assistant' as const,content:'जी।'}]]){
  await assert.rejects(createProviders(config,response(row.rawResponse)).reply([...prior,{role:'user',content:'अब अंत बदल दीजिए।'}]),ProviderError);
 }
});

test('active story does not turn refusal, represented requests or urgent medication disclosures into story instructions',()=>{
 for(const content of ['कहानी आगे मत बढ़ाइए।','अब कहानी नहीं, बस सुनिए।','Make it stop. I do not want another story.','कहानी समाप्त कर दीजिए, अब चुप रहिए।']){
  assert.equal(storyResponseRequested([...opening,{role:'user',content}]),false,content);
  assert.notEqual(directConversation({messages:[...opening,{role:'user',content}]}).decision.action,'ANSWER',content);
 }
 for(const content of ['“आगे सुनाइए” का मतलब क्या है?','उसमें क्या कहा गया था?','Do not change the ending.'])assert.equal(storyResponseRequested([...opening,{role:'user',content}]),false,content);
 assert.equal(storyResponseRequested([...opening,{role:'user',content:'मौसम की बात करें।'},{role:'assistant',content:'जी।'},{role:'user',content:'आगे सुनाइए।'}]),false);
 const danger=directConversation({messages:[...opening,{role:'user',content:'क्या मैं दवा की खुराक दोगुनी कर लूँ?'}]});assert.equal(danger.decision.safety,true);assert.equal(danger.decision.action,'ACT');
});

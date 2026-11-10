import assert from 'node:assert/strict';import {test} from 'node:test';
import {createProviders} from './providers.ts';import {recoverReply} from './reply-recovery.ts';
const config={apiKey:'unused',voice:'Shivani',evonUrl:'http://local'};
test('stream and non-stream preserve safe rejection details through recovery without logging words',async()=>{
 for(const stream of [false,true]){
  const reply='इंद्रधनुष कैसे बनता है?';
  const transport=async()=>stream?new Response('data: '+JSON.stringify({choices:[{delta:{content:reply},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'):Response.json({choices:[{message:{content:reply},finish_reason:'stop'}]});
  const result=await recoverReply(signal=>createProviders(config,transport,signal).reply([{role:'user',content:reply}],stream),new AbortController().signal);
  assert.equal(result.failure,'quality');assert.equal(result.detail,'repetitive-reply');assert.doesNotMatch(result.reply,/इंद्रधनुष/);
 }
});
test('incomplete generation is distinct from a finished but invalid answer',async()=>{
 const result=await recoverReply(signal=>createProviders(config,async()=>Response.json({choices:[{message:{content:'अधूरा'},finish_reason:'length'}]}),signal).reply([{role:'user',content:'बताइए'}]),new AbortController().signal);
 assert.equal(result.detail,'incomplete-answer');
});

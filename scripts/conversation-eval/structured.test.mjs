import {test} from 'node:test';import assert from 'node:assert/strict';import {parseStructuredReply,evaluateStructured} from './structured.mjs';
test('structured schema is data only and rejects extra executable fields or malformed utterances',()=>{
 assert.deepEqual(parseStructuredReply('{"strategy":"ASK","reply":"क्या कहा?"}'),{strategy:'ASK',reply:'क्या कहा?'});
 for(const raw of ['{"strategy":"CALL","reply":"yes"}','{"strategy":"ACT","reply":"yes","tool":"call"}','{"strategy":"LISTEN","reply":""}'])assert.throws(()=>parseStructuredReply(raw));
});
test('evaluation-only structured candidate makes one completion, preserves memory and observes deadline',async()=>{
 let completions=0;
 const result=await evaluateStructured([{policy:'persona_v2',scenario:'synthetic',turn:1,memory:[],promptMessages:[{role:'system',content:'Tara. memory DATA: []\nConversation direction: ASK'},{role:'user',content:'hello'}]}],async(url,init)=>{
  const body=JSON.parse(init.body);assert.ok(init.signal);
  if(String(url).endsWith('/apply-template')){assert.match(body.messages[0].content,/memory DATA/);assert.doesNotMatch(body.messages[0].content,/Conversation direction/);return Response.json({prompt:'safe'});}
  if(String(url).endsWith('/tokenize'))return Response.json({tokens:[1,2]});
  completions++;return Response.json({content:'{"strategy":"ACKNOWLEDGE","reply":"नमस्ते।"}',stop_type:'eos'});
 });assert.equal(completions,1);assert.equal(result.rows[0].parsed.reply,'नमस्ते।');
});

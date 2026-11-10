import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProviders} from './providers.ts';

const settings={apiKey:'unused',evonUrl:'http://127.0.0.1:8080',tokenizerUrl:'http://127.0.0.1:8081',voice:'Yashraj',cachePolicyPrefix:true};
const policyTokens=Array.from({length:20},(_,index)=>100+index);
test('policy prefill excludes conversation and dated recall, then generates from the unchanged full tokens',async()=>{
 const renders:any[]=[],completions:any[]=[];
 const context={time:{timeZone:'Asia/Kolkata',date:'2026-10-30',time:'10:00',period:'morning' as const},recall:[{at:'2026-10-01T08:00:00Z',text:'historical private detail'}]};
 const api=createProviders({...settings,context,listenOnly:true},async(url,init)=>{
  const body=JSON.parse(String(init?.body));
  if(String(url).endsWith('/apply-template')){renders.push(body);return Response.json({prompt:body.add_generation_prompt?'full':'prefix'});}
  if(String(url).endsWith('/tokenize'))return Response.json({tokens:[...policyTokens,...(body.content==='full'?[12,13,14]:[99,98])]});
  completions.push(body);
  return Response.json(body.n_predict===0?{content:'discarded preparation output'}:{content:'जी, मैं सुन रहा हूँ।',stop_type:'eos'});
 });
 assert.equal(await api.reply([{role:'user',content:'आज बस सुनिए।'}]),'जी, मैं सुन रहा हूँ।');
 assert.equal(renders[0].messages[1].content,'आज बस सुनिए।');
 assert.match(renders[0].messages[0].content,/historical private detail/);
 assert.match(renders[0].messages[0].content,/Current listening preference/);
 assert.equal(renders[1].messages.length,1);
 assert.doesNotMatch(renders[1].messages[0].content,/historical private detail|आज बस सुनिए|Current listening preference/);
 assert.deepEqual(completions.map(x=>({prompt:x.prompt,n_predict:x.n_predict,cache_prompt:x.cache_prompt})),[
  {prompt:policyTokens,n_predict:0,cache_prompt:true},{prompt:[...policyTokens,12,13,14],n_predict:96,cache_prompt:true}
 ]);
});

test('a mismatching policy token prefix is never loaded into the answer slot',async()=>{
 const completions:any[]=[];
 const api=createProviders(settings,async(url,init)=>{
  const body=JSON.parse(String(init?.body));
  if(String(url).endsWith('/apply-template'))return Response.json({prompt:body.add_generation_prompt?'full':'prefix'});
  if(String(url).endsWith('/tokenize'))return Response.json({tokens:body.content==='full'?[10,11,12]:[99,11]});
  completions.push(body);return Response.json({content:'जी।',stop_type:'eos'});
 });
 await api.reply([{role:'user',content:'नमस्ते।'}]);
 assert.equal(completions.length,1);assert.deepEqual(completions[0].prompt,[10,11,12]);
});

test('cancellation during policy prefill prevents actual answer generation',async()=>{
 const controller=new AbortController();let generations=0;
 const api=createProviders(settings,async(url,init)=>{
  const body=JSON.parse(String(init?.body));
  if(String(url).endsWith('/apply-template'))return Response.json({prompt:body.add_generation_prompt?'full':'prefix'});
  if(String(url).endsWith('/tokenize'))return Response.json({tokens:body.content==='full'?[...policyTokens,12]:policyTokens});
  if(body.n_predict===0){controller.abort();return Response.json({content:''});}
  generations++;return Response.json({content:'जी।',stop_type:'eos'});
 },controller.signal);
 await assert.rejects(api.reply([{role:'user',content:'नमस्ते।'}]));assert.equal(generations,0);
});

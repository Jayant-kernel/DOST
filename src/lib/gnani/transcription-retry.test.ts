import {test} from 'node:test';import assert from 'node:assert/strict';
import {createProviders,ProviderError} from './providers.ts';
const config={apiKey:'test',evonUrl:'http://localhost:8080',voice:'Yashraj'};
test('transient Prisma rejection reuses the recording once and returns its words',async()=>{
 const forms:BodyInit[]=[];
 const api=createProviders(config,async(_url,init)=>{forms.push(init!.body!);return forms.length===1?new Response(null,{status:503}):Response.json({success:true,transcript:'दाल खाई'});});
 assert.equal(await api.transcribe(new Blob(['audio'])),'दाल खाई');assert.equal(forms.length,2);assert.equal(forms[0],forms[1]);
});
test('auth, malformed audio, credit limits and long rate cooldown never trigger replay',async()=>{
 for(const status of [400,401,402,403,429]){
  let calls=0;const api=createProviders(config,async()=>{calls++;return new Response(null,{status,headers:{'Retry-After':'30'}});});
  await assert.rejects(api.transcribe(new Blob()),ProviderError);assert.equal(calls,1);
 }
});
test('Stop during recognition retry never sends the second request',async()=>{
 const controller=new AbortController();let calls=0;
 const api=createProviders(config,async()=>{calls++;setTimeout(()=>controller.abort(),10);return new Response(null,{status:503});},controller.signal);
 await assert.rejects(api.transcribe(new Blob()));assert.equal(calls,1);
});

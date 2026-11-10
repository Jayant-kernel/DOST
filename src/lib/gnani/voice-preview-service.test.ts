import {test} from 'node:test';import assert from 'node:assert/strict';
import {voicePreviewService} from './voice-preview-service.ts';
const request=(data:unknown,signal?:AbortSignal)=>new Request('http://localhost:3000/api/voice/preview',{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(data),signal});
const data={id:'happy-news',variant:'expressive',speed:0.9,expressiveEnabled:true};
const speech=()=>new Response('event: start\ndata: {}\n\nevent: chunk\ndata: {"chunk_index":0,"audio":"AAABAA=="}\n\nevent: complete\ndata: {"audio":"","is_final":true}\n\n',{headers:{'content-type':'text/event-stream'}});
test('fixed opt-in preview calls only existing Timbre, with stable voice/speed and approved tags',async()=>{
 let calls=0;const service=voicePreviewService(()=> 'not-real',async(url,init)=>{calls++;assert.equal(String(url),'https://api.vachana.ai/api/v1/tts/sse');const payload=JSON.parse(String(init?.body));assert.equal(payload.model,'timbre-v3.0');assert.equal(payload.voice,'Shivani');assert.equal(payload.speed,0.9);assert.match(payload.text,/^<excited>/u);return speech();});
 const response=await service(request(data));assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,4);assert.equal(calls,1);
});
test('untrusted arbitrary text, missing feature flag, invalid selectors and foreign origins never invoke synthesis',async()=>{
 let calls=0;const service=voicePreviewService(()=> 'not-real',async()=>{calls++;return speech();});
 for(const input of [{...data,text:'<shouting> user text'},{...data,expressiveEnabled:false},{...data,id:'../../private'},{...data,speed:'1'},{...data,variant:'unknown'}])assert.equal((await service(request(input))).status,400);
 const foreign=request(data);foreign.headers.set('origin','http://example.org');assert.equal((await service(foreign)).status,403);assert.equal(calls,0);
 const missing=voicePreviewService(()=>undefined);assert.equal((await missing(request(data))).status,503);
});
test('canceling a streamed preview aborts provider work and releases the single-flight lock',async()=>{
 let signal:AbortSignal|undefined;const service=voicePreviewService(()=> 'not-real',async(_url,init)=>{signal=init?.signal??undefined;return speech();});
 const response=await service(request(data));assert.equal((await service(request(data))).status,429);await response.body!.cancel();assert.equal(signal?.aborted,true);
 const next=await service(request(data));assert.equal(next.status,200);await next.body!.cancel();
});
test('production requests are rejected and upstream access failures never disclose provider bodies or credentials',async()=>{
 let calls=0;const service=voicePreviewService(()=> 'private-test-token',async()=>{calls++;return new Response('private upstream body',{status:403});});
 const previous=process.env.NODE_ENV;
 try{Reflect.set(process.env,'NODE_ENV','production');assert.equal((await service(request(data))).status,403);assert.equal(calls,0);}finally{if(previous===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Reflect.set(process.env,'NODE_ENV',previous);}
 const response=await service(request(data));assert.equal(response.status,502);const text=await response.text();assert.doesNotMatch(text,/private-test-token|private upstream body/u);assert.equal(JSON.parse(text).providerStatus,403);
});
test('incomplete provider stream fails after first audio and does not leave preview locked',async()=>{
 let count=0;const service=voicePreviewService(()=> 'test',async()=>{count++;return count===1?new Response('event: start\ndata: {}\n\nevent: chunk\ndata: {"chunk_index":0,"audio":"AAABAA=="}\n\n',{headers:{'content-type':'text/event-stream'}}):speech();});
 const response=await service(request(data));await assert.rejects(response.arrayBuffer());
 const next=await service(request(data));assert.equal(next.status,200);assert.equal((await next.arrayBuffer()).byteLength,4);
});

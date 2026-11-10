import {test} from 'node:test';import assert from 'node:assert/strict';
import {recordingTransport} from './transport.mjs';
import {createProviders,ProviderError} from '../../src/lib/gnani/providers.ts';
const config={apiKey:'unused',voice:'Shivani',evonUrl:'http://127.0.0.1:8080',tokenizerUrl:'http://127.0.0.1:8081'};
test('synthetic recorder preserves rejected raw generation and exact post-trim prompt without changing guard result',async()=>{
 const trace={};let templates=0;const retries=[];
 const transport=recordingTransport(trace,async(url,init)=>{
  const body=JSON.parse(init.body);
  if(String(url).endsWith('/apply-template')){templates++;return Response.json({prompt:templates===1?'too large':'trimmed'});}
  if(String(url).endsWith('/tokenize'))return Response.json(body.content==='too large'?{token_count:2500}:{tokens:[10,11,12]});
  return new Response('data: {"content":"इंद्रधनुष कैसे बनता है?","stop":true,"stop_type":"eos","timings":{"prompt_ms":10}}\n\n');
 });
 await assert.rejects(createProviders({...config,onCopyRetry:rule=>retries.push(rule)},transport).reply([{role:'user',content:'old'},{role:'assistant',content:'answer'},{role:'user',content:'इंद्रधनुष कैसे बनता है?'}],true),error=>error instanceof ProviderError&&error.stage==='Evon response quality');
 assert.equal(retries.length,1); // Existing bounded copy retry; second rejection still fails.
 assert.equal(trace.rawResponse,'इंद्रधनुष कैसे बनता है?');assert.equal(trace.promptMessages.length,2);assert.equal(trace.promptMessages.at(-1).content,'इंद्रधनुष कैसे बनता है?');assert.equal(trace.renderedPrompt,'trimmed');assert.equal(trace.promptTokens,3);assert.equal(trace.modelCalls,2);assert.equal(trace.timings.prompt_ms,10);
});
test('recorder passes partial text through a cancellation instead of labeling it a completed answer',async()=>{
 const trace={};const recorded=recordingTransport(trace,async()=>new Response('data: {"content":"अधूरा"}\n\n'));
 const r=await recorded('http://127.0.0.1:8080/completion',{body:JSON.stringify({stream:true,prompt:[1],n_predict:96})});
 await r.text();assert.equal(trace.rawResponse,'अधूरा');assert.equal(trace.stop,undefined);
});

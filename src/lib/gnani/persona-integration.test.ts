import {test} from 'node:test';import assert from 'node:assert/strict';
import {createProviders,ProviderError} from './providers.ts';
import {directConversation} from './conversation-director.ts';
import {initialAdaptation} from './adaptation.ts';
import {startCapture} from './capture.ts';

const base={apiKey:'private',voice:'Shivani',evonUrl:'http://localhost:8080',behaviourPolicy:'persona_v2' as const};
test('Tara and the director reach both model paths in one generation with adaptive response budget',async()=>{
 for(const native of [false,true]){
  const messages=[{role:'user' as const,content:'मुझे विस्तार से समझाइए कि बादल कैसे बनते हैं'}];
  const {decision}=directConversation({messages});let generations=0,system='';
  const api=createProviders({...base,decision,...(native?{tokenizerUrl:'http://localhost:8081'}:{})},async(url,init)=>{
   const b=JSON.parse(String(init?.body));
   if(String(url).endsWith('/apply-template')){system=b.messages[0].content;return Response.json({prompt:'rendered'});}
   if(String(url).endsWith('/tokenize'))return Response.json({tokens:[10,11]});
   generations++;assert.equal(b.n_predict??b.max_tokens,256);system||=b.messages[0].content;
   const content='पानी से भाप बनती है। ऊपर ठंडी हवा में भाप की छोटी बूँदें बनती हैं। इन बूँदों से बादल बनते हैं।';
   return native?Response.json({content,stop_type:'eos'}):Response.json({choices:[{finish_reason:'stop',message:{content}}]});
  });
  assert.match(await api.reply(messages),/बादल/);assert.equal(generations,1);assert.match(system,/Tara/);assert.match(system,/actual request first/);
 }
});
test('gentle Tara keeps a brief budget and unsupported promises or question loops never reach speech',async()=>{
 const messages=[{role:'user' as const,content:'मैं आज बोर हो रहा हूँ'}];const adaptation=initialAdaptation(true,true);const {decision}=directConversation({messages,adaptation});
 for(const text of ['मैं आपके बेटे को फोन करूँगी।','आप क्या करना चाहेंगे?']){
  const api=createProviders({...base,adaptation,decision},async(_url,init)=>{assert.equal(JSON.parse(String(init?.body)).max_tokens,96);return Response.json({choices:[{finish_reason:'stop',message:{content:text}}]});});
  await assert.rejects(api.reply(messages),ProviderError);
 }
});
test('longer v2 output reserves generation space by trimming old exchanges',async()=>{
 const messages=[{role:'user' as const,content:'old'},{role:'assistant' as const,content:'old reply'},{role:'user' as const,content:'विस्तार से समझाइए'}];const {decision}=directConversation({messages});let tokenCalls=0,latest='';
 const api=createProviders({...base,decision,tokenizerUrl:'http://localhost:8081'},async(url,init)=>{
  const b=JSON.parse(String(init?.body));if(String(url).endsWith('/apply-template')){latest=b.messages.at(-1).content;return Response.json({prompt:'rendered'});}
  if(String(url).endsWith('/tokenize'))return Response.json({tokens:Array(++tokenCalls===1?1800:20).fill(10)});
  assert.equal(b.n_predict,256);assert.equal(b.prompt.length,20);return Response.json({content:'इस विषय को चरणों में समझ सकते हैं।',stop_type:'eos'});
 });
 await api.reply(messages);assert.equal(tokenCalls,2);assert.equal(latest,'विस्तार से समझाइए');
});
test('browser startup uses the explicitly selected version for both preparation and session',async()=>{
 const urls:string[]=[];let stopped=false;
 await startCapture({sessionReady:false,policy:'persona_v2',prepareReasoning:true,isCurrent:()=>true,onReady:()=>{},signal:new AbortController().signal,transport:async url=>{urls.push(String(url));return Response.json({ready:true});},getMedia:async()=>({getTracks:()=>[{stop(){stopped=true;}}]}) as unknown as MediaStream});
 assert.equal(urls[0],'/api/voice/prepare?policy=persona_v2');assert.match(urls[1],/policy=persona_v2/);assert.equal(stopped,false);
});
test('Tara may patiently repeat listening acknowledgments and disabled adaptation does not force brief output',async()=>{
 const messages=[{role:'user' as const,content:'बस सुनिए'},{role:'assistant' as const,content:'जी, मैं सुन रही हूँ।'},{role:'user' as const,content:'आज बगीचे में बैठी थी'}];
 const decision=directConversation({messages,listenOnly:true}).decision;
 const api=createProviders({...base,decision,listenOnly:true},async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'जी, मैं सुन रही हूँ।'}}]}));
 assert.equal(await api.reply(messages),'जी, मैं सुन रही हूँ।');
 const adaptation={...initialAdaptation(),enabled:false,detail:'brief' as const};
 const normal=directConversation({messages:[{role:'user',content:'आज क्रिकेट देखा'}],adaptation}).decision;
 await createProviders({...base,decision:normal,adaptation},async(_url,init)=>{assert.equal(JSON.parse(String(init?.body)).max_tokens,160);return Response.json({choices:[{finish_reason:'stop',message:{content:'क्रिकेट की बात कर सकते हैं।'}}]});}).reply([{role:'user',content:'आज क्रिकेट देखा'}]);
});
test('observed model conversion of a user memory into its own residence is rejected',async()=>{
 const messages=[{role:'user' as const,content:'मैं पहले जम्मू में रहता था।'},{role:'user' as const,content:'सवाल मत पूछिए, बस सुनिए।'}];
 const api=createProviders({...base,listenOnly:true,decision:directConversation({messages,listenOnly:true}).decision},async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'मैं पहले जम्मू में रहता था।'}}]}));
 await assert.rejects(api.reply(messages),ProviderError);
});

test('necessary clarification is not rejected solely because the strategy did not request an optional question',async()=>{
 const messages=[{role:'user' as const,content:'अभी वो वाली बात...'}];const {decision}=directConversation({messages});
 const api=createProviders({...base,decision},async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'आप किस बात की ओर इशारा कर रहे हैं?'}}]}));
 assert.match(await api.reply(messages),/किस बात/);
 const adaptation={...initialAdaptation(),questions:'fewer' as const};
 await assert.rejects(createProviders({...base,decision,adaptation},async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'आपका पसंदीदा गाना कौन सा है?'}}]})).reply(messages),ProviderError);
});

test('recorded noun-based profession claims and invented shared audio fail before synthesis',async()=>{
 for(const text of ['हाँ, मैं भी शिक्षक था।','ओह, मैं समझ गया। तो आप एक शिक्षक थे, और मैं एक शिक्षक हूँ।','हाँ, मुझे भी उसकी आवाज़ सुनाई दी।']){
  await assert.rejects(createProviders(base,async()=>Response.json({choices:[{finish_reason:'stop',message:{content:text}}]})).reply([{role:'user',content:'आप भी शिक्षक थे क्या?'}]),ProviderError);
 }
 const translated='I was a teacher.';
 assert.equal(await createProviders(base,async()=>Response.json({choices:[{finish_reason:'stop',message:{content:translated}}]})).reply([{role:'user',content:'“मैं शिक्षक था” का अंग्रेजी अनुवाद कीजिए।'}]),translated);
});

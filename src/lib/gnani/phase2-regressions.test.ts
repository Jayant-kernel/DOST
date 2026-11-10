import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {historyRetentionRequest} from './history-retention.ts';
import {createProviders,ProviderError} from './providers.ts';
test('observed polite stop, no-delete plus stop, and old-history query remain distinct controls',()=>{
 assert.equal(historyRetentionRequest('इस बातचीत का इतिहास अब सहेजना बंद कर दीजिए।'),'stop');
 assert.equal(historyRetentionRequest('इससे जो पहले की बातें हैं, वे भी मिट गईं क्या?'),'status');
 assert.equal(historyRetentionRequest('ठीक है, अभी कुछ मिटाना नहीं। आगे की बातें भी सेव मत कीजिए।'),'stop');
 assert.equal(historyRetentionRequest('इस बातचीत का इतिहास अब सहेजना बंद कर दीजिए और सीने में दर्द है।'),undefined);
});
test('frozen coherent requested story survives only its shape budget; incomplete and unrequested output stay guarded',async()=>{
 const report=JSON.parse(await readFile(new URL('../../../tests/fixtures/story-original.json',import.meta.url),'utf8'));
 const row=report.rows.find((row:{scenario:string;turn:number})=>row.scenario==='p2-bus-stop-tale'&&row.turn===1);
 assert.equal(row.failureDetail,'behaviour-rejected');assert.equal(row.stop,'eos');
 const config={apiKey:'unused',evonUrl:'http://synthetic',voice:'Shivani',behaviourPolicy:'persona_v2' as const,decision:row.decision};
 const respond=(finish_reason='stop')=>async()=>Response.json({choices:[{message:{content:row.rawResponse},finish_reason}]});
 assert.equal(await createProviders(config,respond()).reply([...row.prior,{role:'user',content:row.input}]),row.rawResponse);
 await assert.rejects(createProviders(config,respond('length')).reply([{role:'user',content:row.input}]),ProviderError);
 await assert.rejects(createProviders(config,respond()).reply([{role:'user',content:'आज मैं उदास हूँ।'}]),ProviderError);
});

test('unverified storage promises fail in all policies while truthful capability explanations remain available',async()=>{
 for(const behaviourPolicy of ['legacy','full','persona_v2'] as const){
  const config={apiKey:'unused',evonUrl:'http://synthetic',voice:'Shivani',behaviourPolicy};
  for(const content of ['ठीक है, मैं इसे याद नहीं रखूँगा।','आपकी जानकारी मिटा दी गई है।','I have deleted your history.']){
   await assert.rejects(createProviders(config,async()=>Response.json({choices:[{finish_reason:'stop',message:{content}}]})).reply([{role:'user',content:'मेरी बात याद मत रखना'}]),(e:unknown)=>e instanceof ProviderError&&e.detail==='storage-claim');
  }
  const content='मैं आपकी जानकारी खुद नहीं मिटा सकती।';
  assert.equal(await createProviders(config,async()=>Response.json({choices:[{finish_reason:'stop',message:{content}}]})).reply([{role:'user',content:'आप जानकारी मिटा सकती हैं?'}]),content);
 }
});

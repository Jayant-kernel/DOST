import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import ts from 'typescript';
import {activeBehaviourPolicy,isBehaviourPolicy} from '../../../lib/gnani/companion.ts';
// Exercise the actual route with deterministic asynchronous boundaries. No real
// profile, key, model, TTS, browser or filesystem storage is used.
const deferred=()=>{let resolve!:(value?:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};};
function fixture(options:{append?:()=>Promise<void>;speak?:()=>Promise<ArrayBuffer>;memory?:(session:any,text:string)=>Promise<any>;stream?:()=>AsyncIterable<Uint8Array>;adapted?:any;policy?:string;companion?:Record<string,any>}={}){
 const id='a'.repeat(64),session:any={expires:Date.now()+60000,messages:[],busy:false,turns:0,ownerId:'fictional-owner',profileId:'fictional-profile',behaviourPolicy:options.policy??'legacy',adaptation:{enabled:true,gentle:false}};
 const sessions=new Map([[id,session]]);class NextResponse extends Response{cookies={set(){}};static json(data:any,init?:ResponseInit){return new NextResponse(JSON.stringify(data),init);}}
 const mocks:Record<string,any>={
  'next/server':{NextResponse},'node:crypto':createRequire(import.meta.url)('node:crypto'),
  '@/lib/gnani/providers':{createProviders:()=>({speak:options.speak??(async()=>new Uint8Array([1]).buffer)}),ProviderError:class extends Error{},NoSpeechError:class extends Error{}},
  '@/lib/gnani/voice-failure':{voiceFailure:()=>({status:500,error:'failure'})},'@/lib/gnani/sessions':{voiceSessions:sessions},
  '@/lib/local-demo':{ownerId:()=> 'fictional-owner',profileId:()=> 'fictional-profile'},
  '@/lib/profiles':{profiles:{read:async()=>({preferences:{language:'hi'}}),appendHistory:options.append??(async()=>{})}},
  '@/lib/bounded-json':{readBoundedBytes:async(r:Request)=>new Uint8Array(await r.arrayBuffer()),InputError:class extends Error{}},
  '@/lib/gnani/voice-memory':{handleVoiceMemory:options.memory??(async()=>undefined)},'@/lib/gnani/history-retention':{historyRetentionRequest:()=>undefined},
  '@/lib/gnani/speaker':{handleSpeaker:async()=>undefined},'@/lib/gnani/expression':{expressiveSpeech:(r:string)=>r},
  '@/lib/gnani/conversation-context':{conversationTime:()=>({}),validTimeZone:(x:any)=>x},'@/lib/gnani/reply-recovery':{},
  '@/lib/gnani/speech-cache':{publicSpeechCache:{stream:options.stream??(async function*(){yield new Uint8Array([1,2]);})}},
  '@/lib/gnani/weather-conversation':{weatherConversation:async()=>undefined},'@/lib/gnani/adaptation':{speechDelivery:()=>({speed:1}),initialAdaptation:()=>({enabled:true,gentle:false})},
  '@/lib/gnani/care-cues':{relativeVoiceCue:()=>({baseline:undefined,changed:false})},'@/lib/shop/store':{StorageError:class extends Error{}},'@/lib/gnani/listen-token.mjs':{},
  '@/lib/gnani/companion':options.companion??{activeBehaviourPolicy:'legacy'},'@/lib/gnani/conversation-director':{},
  '@/lib/gnani/conversation-planner':{observeConversation:()=>({boundaries:{hints:[]},adapted:{state:options.adapted??{enabled:false}},engagement:{},listenOnly:false}),planConversationTurn:({messages,state}:any)=>({reply:'Reply '+messages.at(-1).content,source:'control',next:{...state,engagement:{marker:messages.at(-1).content}},deterministic:true})}
 };
 const source=ts.transpileModule(readFileSync(new URL('./route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{} as any};new Function('require','module','exports','process',source)((name:string)=>{if(!(name in mocks))throw Error(name);return mocks[name];},mod,mod.exports,{env:{NODE_ENV:'development',GNANI_API_KEY:'synthetic'}});
 const request=(query='',text?:string,stream=false)=>new Request('http://localhost:3000/api/voice'+query,{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000',cookie:'saathi_voice='+id,'content-type':'application/json',...(stream?{accept:'application/octet-stream'}:{})},body:text?JSON.stringify({transcript:text}):undefined});
 return {session,sessions,post:(query='',text?:string,stream=false)=>mod.exports.POST(request(query,text,stream)) as Promise<Response>};
}
test('interrupted delayed persistence cannot replace newer messages or planner state',async()=>{
 const entered=deferred(),release=deferred();let writes=0;
 const f=fixture({append:async()=>{if(++writes===1){entered.resolve();await release.promise;}}});
 const old=f.post('','first');await entered.promise;assert.equal((await f.post('?interrupt')).status,204);
 assert.equal((await f.post('','second')).status,200);const current=structuredClone(f.session.messages);
 release.resolve();assert.equal((await old).status,499);assert.deepEqual(f.session.messages,current);assert.equal(f.session.engagement.marker,'second');assert.equal(f.session.busy,false);
});
test('late failed speech from an interrupted turn cannot clear a newer memory confirmation',async()=>{
 const entered=deferred(),release=deferred();let calls=0;
 const f=fixture({speak:async()=>{if(++calls===1){entered.resolve();await release.promise;throw Error('old speech failed');}return new Uint8Array([1]).buffer;},memory:async(s,text)=>{if(text==='second'){s.pendingMemory={kind:'save',changes:{topic:'music'}};return {reply:'Confirm save?'};}}});
 const old=f.post('','first');await entered.promise;await f.post('?interrupt');assert.equal((await f.post('','second')).status,200);release.resolve();assert.equal((await old).status,499);assert.deepEqual(f.session.pendingMemory,{kind:'save',changes:{topic:'music'}});
});
test('cancelling an old audio stream cannot clear the newer turn confirmation',async()=>{
 const f=fixture();const old=await f.post('','first',true);assert.equal(old.status,200);await f.post('?interrupt');f.session.pendingMemory={kind:'save',changes:{topic:'gardening'}};await old.body!.cancel();assert.equal(f.session.pendingMemory.changes.topic,'gardening');
});
test('streamed delivery headers describe tentative adaptation before completion',async()=>{
 const f=fixture({adapted:{enabled:false,gentle:true,pace:'slow'}});const response=await f.post('','first',true);
 assert.equal(response.headers.get('X-Saathi-Gentle'),'1');assert.equal(response.headers.get('X-Saathi-Adaptive'),'0');assert.equal(response.headers.get('X-Saathi-Pace'),'slow');
 await response.arrayBuffer();assert.equal(f.session.adaptation.gentle,true);assert.equal(f.session.controller,undefined);
});
test('aborting the owning speech turn clears its unheard confirmation',async()=>{
 const entered=deferred(),release=deferred();const f=fixture({memory:async(s)=>{s.pendingMemory={kind:'history-resume'};return {reply:'Confirm resume?'};},speak:async()=>{entered.resolve();await release.promise;throw Error('Speech aborted');}});
 const result=f.post('','resume');await entered.promise;f.session.controller.abort();release.resolve();assert.equal((await result).status,499);assert.equal(f.session.pendingMemory,undefined);
});
test('a start without an explicit policy opens Tara by default; explicit policies are honoured',async()=>{
 const companion={activeBehaviourPolicy,isBehaviourPolicy};
 const f=fixture({companion});const started=await f.post('?start');assert.equal(started.status,200);
 assert.equal(started.headers.get('X-Saathi-Policy'),'persona_v2');assert.equal(started.headers.get('X-Saathi-Persona'),'tara_v1');
 const created=[...f.sessions.values()].at(-1);assert.equal(created.behaviourPolicy,'persona_v2');
 const legacy=await fixture({companion}).post('?start&policy=legacy');
 assert.equal(legacy.headers.get('X-Saathi-Policy'),'legacy');assert.equal(legacy.headers.get('X-Saathi-Persona'),'saathi');
 const tara=await fixture({companion}).post('?start&policy=persona_v2');
 assert.equal(tara.headers.get('X-Saathi-Policy'),'persona_v2');assert.equal(tara.headers.get('X-Saathi-Persona'),'tara_v1');
 assert.equal((await fixture({companion}).post('?start&policy=unknown')).status,400);
});
test('turn headers follow the session policy',async()=>{
 const tara=await fixture({policy:'persona_v2'}).post('','hello');assert.equal(tara.headers.get('X-Saathi-Policy'),'persona_v2');assert.equal(tara.headers.get('X-Saathi-Persona'),'tara_v1');
 const legacy=await fixture().post('','hello');assert.equal(legacy.headers.get('X-Saathi-Policy'),'legacy');assert.equal(legacy.headers.get('X-Saathi-Persona'),null);
});

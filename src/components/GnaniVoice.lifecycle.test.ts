import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {ContinuousConversation} from '../lib/gnani/continuous-conversation.ts';
import {startCapture} from '../lib/gnani/capture.ts';

// Execute the actual component with deterministic React/audio/transport seams.
// No browser permission, saved profile or provider call is involved.
function fixture(options:{welcome?:()=>Promise<Response>;reply?:()=>Promise<Response>;health?:()=>Promise<Response>;interrupt?: (signal?:AbortSignal)=>Promise<Response>;stored?:string|null}={}){
 const hooks:any[]=[],effects:(()=>void)[]=[],timers=new Map<number,{callback:()=>void;delay:number}>();
 let cursor=0,nextTimer=0,tree:any;
 const speakers:any[]=[],recorders:any[]=[],tracks:any[]=[],contexts:any[]=[],requests:string[]=[],uploads:BodyInit[]=[];
 const react={
  useState(initial:any){const index=cursor++;if(!(index in hooks))hooks[index]=initial;return [hooks[index],(value:any)=>{hooks[index]=typeof value==='function'?value(hooks[index]):value;}];},
  useRef(initial:any){const index=cursor++;return hooks[index]??= {current:initial};},
  useCallback(callback:any){cursor++;return callback;},
  useEffect(effect:()=>void){const index=cursor++;if(!(index in hooks)){hooks[index]=true;effects.push(effect);}},
 };
 class Speaker{stopped=false;plays=0;constructor(){speakers.push(this);}stop(){this.stopped=true;}async play(_response:Response,signal:AbortSignal,onAudio:()=>void){signal.throwIfAborted();this.plays++;onAudio();return new Uint8Array(46);}}
 class Recorder{state='inactive';onstop:(()=>void)|null=null;disposed=false;static async create(){const recorder=new Recorder();recorders.push(recorder);return recorder;}start(){this.state='recording';}stop(){this.state='inactive';this.dispose();this.onstop?.();}dispose(){this.disposed=true;}wav(){return new ArrayBuffer(46);}}
 class Context{closed=false;constructor(){contexts.push(this);}createMediaStreamSource(){return {connect(){},disconnect(){}};}createAnalyser(){return {fftSize:0,getFloatTimeDomainData(){}};}async close(){this.closed=true;}}
 const transport=async(input:any,init?:RequestInit)=>{const url=String(input);requests.push(url);if(url==='/api/voice/health')return options.health?.()??Response.json({reasoning:'ready',tokenizer:'ready'});if(url.startsWith('/api/voice/prepare')||url.includes('start=1'))return Response.json({ready:true});if(url.includes('welcome=1'))return options.welcome?.()??new Response(new Uint8Array(2));if(url.includes('interrupt=1'))return options.interrupt?.(init?.signal??undefined)??new Response(null,{status:204});if(url==='/api/voice'){if(init?.body)uploads.push(init.body);return options.reply?.()??new Response(new Uint8Array(2));}return new Response(null,{status:204});};
 const nativeRequire=createRequire(import.meta.url);
 const dependencies:Record<string,any>={react,'react/jsx-runtime':{jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})},'@/lib/gnani/continuous-conversation':{ContinuousConversation},'@/lib/gnani/capture':{startCapture:(settings:any)=>startCapture({...settings,transport})},'./pcm-recorder':{PcmRecorder:Recorder},'./streaming-speech':{StreamingSpeech:Speaker},'./live-transcription':{LiveTranscription:class{}},'@/lib/gnani/interruption':{InterruptionDetector:class{}},'@/lib/gnani/turn-detector':{TurnDetector:class{heardSpeech=true;}},'./CompanionPreferences':{CompanionPreferences:()=>null},'./VoiceOrb':{VoiceOrb:()=>null},'@/lib/gnani/recovery-status':{recoveryStatus:()=> 'Recovered; you can continue.'}};
 const exports:any={};
 const source=ts.transpileModule(readFileSync(new URL('./GnaniVoice.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(source,{exports,require:(name:string)=>dependencies[name]??nativeRequire(name),process:{env:{NODE_ENV:'development'}},fetch:transport,Response,AbortController,AbortSignal,DOMException,Intl,performance,AudioContext:Context,Audio:class{pause(){}},Blob,URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}},localStorage:{getItem:()=>options.stored??null,setItem(){}},document:{addEventListener(){},removeEventListener(){}},navigator:{mediaDevices:{getUserMedia:async()=>{const track={readyState:'live',stopped:false,stop(){this.stopped=true;this.readyState='ended';}};tracks.push(track);return {getTracks:()=>[track],getAudioTracks:()=>[track]};}}},setTimeout:(callback:()=>void,delay:number)=>{const id=++nextTimer;timers.set(id,{callback,delay});return id;},clearTimeout:(id:number)=>timers.delete(id),setInterval:(callback:()=>void,delay:number)=>{const id=++nextTimer;timers.set(id,{callback,delay});return id;},clearInterval:(id:number)=>timers.delete(id)});
 function render(){cursor=0;tree=exports.GnaniVoice();return tree;}
 function nodes(node:any):any[]{return !node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(child=>nodes(child))];}
 function text(node:any):string{return typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';}
 function button(label:string){render();const node=nodes(tree).find(node=>node.type==='button'&&text(node)===label);assert.ok(node,`Missing button ${label}`);return node;}
 async function flush(){for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));render();}
 async function mount(){render();effects.splice(0).forEach(effect=>effect());await flush();}
 async function manual(){render();const label=nodes(tree).find(node=>node.type==='label'&&text(node).includes('Hands-free conversation'));label.props.children[0].props.onChange({target:{checked:false}});await flush();}
 async function start(){button('Start talking').props.onClick();await flush();}
 async function finish(){recorders.at(-1)!.stop();await flush();}
 async function advanceListening(){for(const [id,timer]of timers)if(timer.delay===150){timers.delete(id);timer.callback();}await flush();}
 return {mount,manual,start,finish,flush,advanceListening,pollHealth:async()=>{for(const timer of timers.values())if(timer.delay===15000)timer.callback();await flush();},button,speakers,tracks,contexts,recorders,requests,uploads,snapshot:()=>{render();return text(tree);},select:()=>{render();return nodes(tree).find(node=>node.type==='select'&&node.props['aria-label']==='Companion personality');},memoryRevision:()=>{render();return nodes(tree).find(node=>'revision' in (node.props??{})).props.revision;},status:()=>{render();return text(nodes(tree).find(node=>node.props?.role==='status'));}};
}

test('manual completed reply closes playback resources',async()=>{
 const app=fixture();await app.mount();await app.manual();await app.start();await app.finish();
 assert.ok(app.speakers.every(speaker=>speaker.stopped),'Completed playback must release its AudioContext');
 assert.ok(app.tracks.every(track=>track.stopped));
});

test('server-ended conversation starts a fresh identified session on the next Start',async()=>{
 const app=fixture({reply:async()=>new Response(new Uint8Array(2),{headers:{'X-Saathi-End':'1'}})});await app.mount();await app.start();await app.finish();await app.start();
 assert.equal(app.requests.filter(url=>url.includes('start=1')).length,2);
 assert.equal(app.requests.filter(url=>url.includes('welcome=1')).length,2);
});

test('late welcome after Stop cannot play on or stop the newer turn',async()=>{
 let release!:(response:Response)=>void,calls=0;
 const app=fixture({welcome:async()=>++calls===1?new Promise(resolve=>{release=resolve;}):new Response(new Uint8Array(2))});await app.mount();await app.start();app.button('Stop').props.onClick();await app.start();
 const current=app.speakers.at(-1);assert.equal(current.stopped,false);release(new Response(new Uint8Array(2)));await app.flush();
 assert.equal(current.stopped,false,'A stale introduction must not close the current audio context');
 assert.equal(current.plays,0,'A stale introduction must not speak in the current turn');
});

test('recovery playback continues hands-free in the same identified session',async()=>{
 const app=fixture({reply:async()=>new Response(new Uint8Array(2),{headers:{'X-Saathi-Recovery':'1'}})});await app.mount();await app.start();await app.finish();await app.advanceListening();
 assert.equal(app.recorders.length,2);assert.equal(app.requests.filter(url=>url.includes('start=1')).length,1);assert.equal(app.recorders.at(-1).state,'recording');
 app.button('Stop').props.onClick();assert.ok(app.tracks.every(track=>track.stopped));
});

test('late reply after Stop cannot update diagnostics or memory state',async()=>{
 let release!:(response:Response)=>void;
 const app=fixture({reply:async()=>new Promise(resolve=>{release=resolve;})});await app.mount();await app.start();await app.finish();app.button('Stop').props.onClick();
 release(new Response(new Uint8Array(2),{headers:{'X-Saathi-Memory-Changed':'1','X-Saathi-Persona':'stale-persona'}}));await app.flush();
 assert.equal(app.memoryRevision(),0);assert.ok(!app.snapshot().includes('stale-persona'));assert.equal(app.status(),'Stopped.');
});

test('late recorder callback cannot release the newer listening meter',async()=>{
 const app=fixture();await app.mount();await app.start();const old=app.recorders.at(-1);app.button('Stop').props.onClick();await app.start();const meter=app.contexts.at(-1);old.onstop();await app.flush();
 assert.equal(meter.closed,false);assert.equal(app.recorders.at(-1).state,'recording');
});

test('Stop aborts an in-flight interruption request',async()=>{
 let signal:AbortSignal|undefined;
 const app=fixture({reply:async()=>new Promise(()=>{}),interrupt:async active=>{signal=active;return new Promise(()=>{});}});await app.mount();await app.start();await app.finish();app.button('Interrupt reply').props.onClick();await app.flush();app.button('Stop').props.onClick();
 assert.ok(signal?.aborted,'The interrupt request must share Stop cancellation');
});


test('a delayed health result cannot overwrite newer ready state',async()=>{
 let calls=0,release!:(response:Response)=>void;
 const app=fixture({health:async()=>++calls===2?new Promise(resolve=>{release=resolve;}):Response.json({reasoning:'ready',tokenizer:'ready'})});await app.mount();await app.pollHealth();await app.pollHealth();
 release(Response.json({reasoning:'offline',tokenizer:'offline'}));await app.flush();
 assert.ok(app.button('Start talking'));assert.ok(!app.snapshot().includes('The local Evon service is offline.'));
});

test('recognition retry reuses the recording then resumes the same hands-free session',async()=>{
 let calls=0;
 const app=fixture({reply:async()=>++calls===1?Response.json({code:'transcription_unavailable'},{status:502}):new Response(new Uint8Array(2))});await app.mount();await app.start();await app.finish();
 assert.ok(app.tracks.every(track=>track.stopped));app.button('Retry my recording').props.onClick();await app.flush();await app.advanceListening();
 assert.equal(app.uploads.length,2);assert.equal(app.uploads[0],app.uploads[1]);assert.equal(app.requests.filter(url=>url.includes('start=1')).length,1);assert.equal(app.recorders.length,2);assert.equal(app.recorders.at(-1).state,'recording');
 app.button('Stop').props.onClick();assert.ok(app.tracks.every(track=>track.stopped));
});

test('Stop prevents the queued hands-free continuation from reacquiring the microphone',async()=>{
 const app=fixture();await app.mount();await app.start();await app.finish();app.button('Stop').props.onClick();await app.advanceListening();
 assert.equal(app.recorders.length,1);assert.ok(app.tracks.every(track=>track.stopped));assert.equal(app.status(),'Stopped.');
});

test('Tara is the default companion; an explicit stored choice is restored',async()=>{
 for(const [stored,expected] of [[null,'persona_v2'],['legacy','legacy'],['persona_v2','persona_v2'],['unknown','persona_v2']] as const){
  const app=fixture({stored});await app.mount();
  assert.equal(app.select().props.value,expected,String(stored));
 }
 const app=fixture();await app.mount();
 const options=[app.select().props.children].flat(Infinity).filter((node:any)=>node?.type==='option').map((node:any)=>[node.props.value,[node.props.children].flat().join('')]);
 assert.deepEqual(options,[['persona_v2','Tara — Saathi 2.0'],['legacy','Saathi — classic']]);
 assert.ok(app.snapshot().includes('Tara is an AI companion. Response quality is still being evaluated.'));
 const classic=fixture({stored:'legacy'});await classic.mount();assert.ok(!classic.snapshot().includes('Tara is an AI companion.'));
});

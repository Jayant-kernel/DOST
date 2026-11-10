'use client';
import {ContinuousConversation} from '@/lib/gnani/continuous-conversation';
import {LiveTranscription} from './live-transcription';
import {InterruptionDetector} from '@/lib/gnani/interruption';
import {PcmRecorder} from './pcm-recorder';
import {StreamingSpeech} from './streaming-speech';
import {startCapture} from '@/lib/gnani/capture';
import {useCallback,useEffect,useRef,useState} from 'react';
import {TurnDetector} from '@/lib/gnani/turn-detector';
import {CompanionPreferences} from './CompanionPreferences';
import {VoiceOrb,type VoicePhase} from './VoiceOrb';
import {recoveryStatus} from '@/lib/gnani/recovery-status';
export function GnaniVoice(){
 const [status,setStatus]=useState('Press Start talking when you are ready.'),[recording,setRecording]=useState(false),[busy,setBusy]=useState(false);
 const [phase,setPhase]=useState<VoicePhase>('idle'),[level,setLevel]=useState(0);
 const [adaptive,setAdaptive]=useState(true),[gentle,setGentle]=useState(false),[slowSpeech,setSlowSpeech]=useState(false),[runtimeStatus,setRuntimeStatus]=useState('Checking local reasoning…');
 const [runtimeState,setRuntimeState]=useState<'checking'|'ready'|'loading'|'offline'>('checking'),[checkingRuntime,setCheckingRuntime]=useState(false);
 const healthVersion=useRef(0);
 const checkRuntime=useCallback(async(signal?:AbortSignal,manual=false)=>{
  const check=++healthVersion.current;
  if(manual)setCheckingRuntime(true);
  try{
   const response=await fetch('/api/voice/health',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(5000)]):AbortSignal.timeout(5000),cache:'no-store'});if(!response.ok)throw Error();
   const data=await response.json();if(signal?.aborted||check!==healthVersion.current)return;
   const available=data.reasoning==='ready'&&data.tokenizer==='ready';
   setRuntimeState(available?'ready':data.reasoning==='loading'?'loading':'offline');
   const message=available?'Local reasoning is online.':data.reasoning==='loading'?'Evon is loading its model. Conversation will be available when loading finishes.':data.reasoning==='ready'?'The local tokenizer service is offline. Conversation cannot start until it is running.':'The local Evon service is offline. Conversation cannot start until it is running. Refreshing this page does not restart it.';
   setRuntimeStatus(message);if(manual)setStatus(available?'Connection restored. Press Start talking.':message);
  }catch{if(!signal?.aborted&&check===healthVersion.current){setRuntimeState('offline');setRuntimeStatus('Could not check local services. Make sure the Saathi server is running.');if(manual)setStatus('Could not check local services. Please check the server terminal.');}}
  finally{if(!signal?.aborted&&check===healthVersion.current)setCheckingRuntime(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void checkRuntime(controller.signal);const timer=setInterval(()=>void checkRuntime(controller.signal),15000);return()=>{controller.abort();clearInterval(timer);};},[checkRuntime]);
 const rec=useRef<PcmRecorder|null>(null),stream=useRef<MediaStream|null>(null),sound=useRef<HTMLAudioElement|null>(null),last=useRef(''),ready=useRef(false),version=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const speech=useRef<StreamingSpeech|null>(null);
 const pending=useRef<AbortController|null>(null);
 const retryRecording=useRef<(()=>void)|null>(null);
 const [canRetryRecording,setCanRetryRecording]=useState(false);
 const [automatic,setAutomatic]=useState(true),[live,setLive]=useState(false),[barge,setBarge]=useState(false);
 const [policy,setPolicy]=useState<'legacy'|'persona_v2'>('persona_v2');
 const [diagnostics,setDiagnostics]=useState<{policy:string;persona:string;model:string;source:string;strategy:string;director:string;recovery:string;timing:string}|null>(null);
 useEffect(()=>{try{const stored=localStorage.getItem('saathi-persona-policy');if(stored==='legacy'||stored==='persona_v2')setPolicy(stored);}catch{/* A storage-disabled browser retains explicit session selection. */}},[]);
 const loop=useRef(new ContinuousConversation());
 const [pauseMs,setPauseMs]=useState(2200);
 const conversationOptions=useRef({adaptive,gentle,pauseMs,slowSpeech,policy});conversationOptions.current={adaptive,gentle,pauseMs,slowSpeech,policy};
 const [memoryRevision,setMemoryRevision]=useState(0);
 const [waitingSeconds,setWaitingSeconds]=useState(0);
 useEffect(()=>{setWaitingSeconds(0);if(!busy)return;const began=Date.now(),tick=setInterval(()=>setWaitingSeconds(Math.floor((Date.now()-began)/1000)),1000);return()=>clearInterval(tick);},[busy]);
 const liveInput=useRef<LiveTranscription|null>(null);
 const analysis=useRef<(()=>void)|null>(null);
 // The reason is a fixed label so the local server log shows why listening
 // ended (Stop button, 25-second silence, hidden page); it carries no speech.
 function stop(reason?:unknown){const cause=reason==='idle'||reason==='hidden'?reason:'user';loop.current.stop();version.current++;retryRecording.current=null;setCanRetryRecording(false);speech.current?.stop();liveInput.current?.stop();analysis.current?.();pending.current?.abort();void fetch(`/api/voice?stop=1&reason=${cause}`,{method:'POST',keepalive:true}).catch(()=>{});ready.current=false;sound.current?.pause();if(rec.current?.state==='recording')rec.current.stop();stream.current?.getTracks().forEach(t=>t.stop());if(timer.current)clearTimeout(timer.current);setRecording(false);setBusy(false);setSlowSpeech(false);setLevel(0);setPhase('stopped');setStatus('Stopped.');}
 async function repeat(){const turn=++version.current;setBusy(true);setPhase('waiting');try{speech.current?.stop();pending.current=new AbortController();const wav=await(await fetch(last.current,{signal:pending.current.signal})).arrayBuffer();if(turn!==version.current)return;speech.current=new StreamingSpeech();await speech.current.play(new Response(new Uint8Array(wav).slice(44)),pending.current.signal,()=>{if(turn===version.current){setPhase('speaking');setStatus('Repeating your reply.');}},value=>{if(turn===version.current)setLevel(value);});if(turn===version.current){setPhase('idle');setStatus('You can speak again.');}}catch{if(turn===version.current){setPhase('error');setStatus('Audio could not play. Please try again.');}}finally{if(turn===version.current){speech.current?.stop();setBusy(false);setLevel(0);}}}
 useEffect(()=>{const hidden=()=>{if(document.hidden)stop('hidden');};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);
 useEffect(()=>()=>{loop.current.stop();version.current++;retryRecording.current=null;rec.current?.dispose();speech.current?.stop();liveInput.current?.stop();pending.current?.abort();analysis.current?.();sound.current?.pause();stream.current?.getTracks().forEach(t=>t.stop());if(timer.current)clearTimeout(timer.current);if(last.current)URL.revokeObjectURL(last.current);},[]);
 async function interrupt(){const turn=++version.current;rec.current?.dispose();analysis.current?.();speech.current?.stop();liveInput.current?.stop();pending.current?.abort();stream.current?.getTracks().forEach(t=>t.stop());setBusy(true);
  try{const controller=new AbortController();pending.current=controller;const response=await fetch('/api/voice?interrupt=1',{method:'POST',signal:controller.signal});if(turn!==version.current)return;if(!response.ok)ready.current=false;await start();}catch{if(turn===version.current){setBusy(false);setPhase('error');setStatus('Connection failed. Please start again.');}}}
 async function start(continuing=false){if(!continuing)loop.current.begin();const ticket=loop.current.ticket;if(!loop.current.canListen(ticket))return;const turn=++version.current;setBusy(true);setPhase('waiting');setLevel(0);sound.current?.pause();speech.current?.stop();try{speech.current=new StreamingSpeech();
  const captureController=new AbortController();pending.current=captureController;
  const media=await startCapture({sessionReady:ready.current,prepareReasoning:true,policy:conversationOptions.current.policy,onPreparing:()=>setStatus('Getting Saathi ready. You can press Stop.'),adaptive:conversationOptions.current.adaptive,gentle:conversationOptions.current.gentle,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,isCurrent:()=>turn===version.current,onReady:()=>{ready.current=true;},identify:true,onWelcome:async()=>{
    setStatus('Saathi is asking your name. Please listen.');
    const welcomeSpeech=speech.current!;
    const response=await fetch('/api/voice?welcome=1',{method:'POST',headers:{Accept:'application/octet-stream'},signal:captureController.signal});
    captureController.signal.throwIfAborted();if(turn!==version.current)throw new DOMException('Introduction cancelled','AbortError');
    if(!response.ok){ready.current=false;throw Error('Could not start the introduction. Please try again.');}
    await welcomeSpeech.play(response,captureController.signal,()=>{if(turn===version.current)setPhase('speaking');},value=>{if(turn===version.current)setLevel(value);});welcomeSpeech.stop();captureController.signal.throwIfAborted();if(turn!==version.current)throw new DOMException('Introduction cancelled','AbortError');speech.current=new StreamingSpeech();
   },getMedia:async()=>{const current=stream.current;if(current?.getAudioTracks().some(t=>t.readyState==='live'))return current;return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});},signal:captureController.signal});stream.current=media;
  const liveCapture=live?new LiveTranscription():null;liveInput.current=liveCapture;
  if(liveCapture)await liveCapture.start(media,pending.current.signal);
  if(turn!==version.current){liveCapture?.stop();media.getTracks().forEach(t=>t.stop());return;}
  const recorder=await PcmRecorder.create(media,pending.current.signal);
  if(turn!==version.current){recorder.dispose();liveCapture?.stop();media.getTracks().forEach(t=>t.stop());return;}
  rec.current=recorder;
  const options=conversationOptions.current;const detector=new TurnDetector(performance.now(),options.gentle||options.slowSpeech?3500:options.pauseMs);
  let idle=false;
  recorder.onstop=async()=>{
   if(turn!==version.current){media.getTracks().forEach(t=>t.stop());return;}
   analysis.current?.();if(timer.current)clearTimeout(timer.current);
   if(automatic&&(idle||!detector.heardSpeech)){liveCapture?.stop();stop('idle');setStatus('Paused after 25 seconds without speech. Press Start talking when you are ready.');return;}
   let succeeded=false,retryListening=false,waitingToRetry=false;
   setRecording(false);setBusy(true);setPhase('waiting');setLevel(0);setStatus('Preparing your reply...');
   try{
   if(barge){
    const monitor=new AudioContext(),input=monitor.createMediaStreamSource(media),analyser=monitor.createAnalyser(),detector=new InterruptionDetector();
    analyser.fftSize=2048;input.connect(analyser);const samples=new Float32Array(analyser.fftSize);
    const interval=setInterval(()=>{if(turn!==version.current)return;analyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);if(detector.sample(rms,performance.now()))void interrupt();},50);
    const expiry=setTimeout(()=>{if(turn===version.current){analysis.current?.();media.getTracks().forEach(t=>t.stop());}},30000);
    analysis.current=()=>{clearInterval(interval);clearTimeout(expiry);input.disconnect();void monitor.close().catch(()=>{});analysis.current=null;};
   }
    let body:BodyInit,contentType:string;
    if(liveCapture){const transcript=await liveCapture.finish();if(!transcript)throw Error('Please try again.');body=JSON.stringify({transcript});contentType='application/json';}
    else{body=recorder.wav();contentType='audio/wav';}
    if(turn!==version.current)return;
    let manualRetries=0;
    const submit=async()=>{
    if(turn!==version.current||!loop.current.canListen(ticket)){retryRecording.current=null;setCanRetryRecording(false);ready.current=false;setPhase('stopped');setStatus('This conversation expired. Press Start talking to begin again.');return;}
    succeeded=false;retryListening=false;waitingToRetry=false;
    setBusy(true);setPhase('waiting');setStatus('Preparing your reply...');
    if(manualRetries>0){speech.current?.stop();speech.current=new StreamingSpeech();}
    pending.current=new AbortController();
    try{
    const response=await fetch('/api/voice',{method:'POST',headers:{'Content-Type':contentType,'Accept':'application/octet-stream'},body,signal:AbortSignal.any([pending.current.signal,AbortSignal.timeout(180000)])});
    if(turn!==version.current){void response.body?.cancel().catch(()=>{});return;}
    if(process.env.NODE_ENV==='development')setDiagnostics({policy:response.headers.get('X-Saathi-Policy')??'unknown',persona:response.headers.get('X-Saathi-Persona')??'saathi',model:response.headers.get('X-Saathi-Model-Invoked')==='1'?'called':'bypassed',source:response.headers.get('X-Saathi-Reply-Source')??'unavailable',strategy:response.headers.get('X-Saathi-Strategy')??'none',director:response.headers.get('X-Saathi-Director-Applied')==='1'?'applied':'shadow or bypassed',recovery:response.headers.get('X-Saathi-Recovery-Detail')??response.headers.get('X-Saathi-Recovery-Reason')??'none',timing:response.headers.get('Server-Timing')??'unavailable'});
    if(response.headers.get('X-Saathi-Memory-Changed'))setMemoryRevision(x=>x+1);
    if(!response.ok){const data=await response.json();if(turn!==version.current)return;if(response.status===401||response.status===429)ready.current=false;if(response.status===422&&data.code==='speech_not_detected'){retryListening=automatic&&loop.current.retryNoSpeech(ticket);setPhase(retryListening?'idle':'stopped');setStatus(retryListening?'No clear speech was detected. Listening again; please speak closer to the microphone.':'No clear speech was detected. Check your microphone, then press Start talking.');return;}if(contentType==='audio/wav'&&data.code==='transcription_unavailable'&&manualRetries<3){waitingToRetry=true;retryRecording.current=()=>{if(turn!==version.current)return;retryRecording.current=null;setCanRetryRecording(false);manualRetries++;void submit();};setCanRetryRecording(true);setPhase('error');setStatus('Speech recognition is temporarily unavailable. Retry the same recording, or press Stop.');return;}throw Error(typeof data.error==='string'&&!/[\u0900-\u097f]/.test(data.error)?data.error:'Reply unavailable. Please try again.');}if(turn!==version.current)return;
    if(response.headers.has('X-Saathi-Pace'))setSlowSpeech(response.headers.get('X-Saathi-Pace')==='slow');
    if(response.headers.has('X-Saathi-Gentle'))setGentle(response.headers.get('X-Saathi-Gentle')==='1');
    if(response.headers.has('X-Saathi-Adaptive'))setAdaptive(response.headers.get('X-Saathi-Adaptive')==='1');
    const audio=await speech.current!.play(response,pending.current.signal,()=>{if(turn===version.current){setPhase('speaking');setStatus('Listen to your reply.');}},value=>{if(turn===version.current)setLevel(value);});if(turn!==version.current)return;
    if(last.current)URL.revokeObjectURL(last.current);last.current=URL.createObjectURL(new Blob([audio],{type:'audio/wav'}));sound.current=new Audio(last.current);retryRecording.current=null;setCanRetryRecording(false);setPhase('idle');setStatus(response.headers.get('X-Saathi-Recovery')?recoveryStatus(response.headers.get('X-Saathi-Recovery-Reason'),response.headers.get('X-Saathi-Recovery-Detail')):'You can speak again.');succeeded=true;loop.current.completed(ticket);if(response.headers.get('X-Saathi-End')){ready.current=false;loop.current.stop();setPhase('stopped');setStatus('Conversation ended. Press Start talking whenever you like.');}
    }catch(e){if(turn===version.current){speech.current?.stop();liveCapture?.stop();analysis.current?.();media.getTracks().forEach(t=>t.stop());setPhase('error');setLevel(0);setStatus(e instanceof Error?e.message:'Please try again.');}}
    finally{if(turn===version.current){speech.current?.stop();setBusy(false);analysis.current?.();if(waitingToRetry){speech.current?.stop();media.getTracks().forEach(t=>t.stop());}else if((succeeded||retryListening)&&automatic&&loop.current.canListen(ticket)){setTimeout(()=>{if(turn===version.current&&loop.current.canListen(ticket))void start(true);},150);}else{const budgetReached=succeeded&&automatic&&ready.current&&loop.current.ticket===ticket;loop.current.stop();media.getTracks().forEach(t=>t.stop());if(budgetReached){ready.current=false;setStatus('Paused at the 30-reply or 30-minute limit. Press Start talking for a new conversation.');}}}}
    };
    await submit();
   }catch(e){if(turn===version.current){loop.current.stop();speech.current?.stop();liveCapture?.stop();analysis.current?.();media.getTracks().forEach(t=>t.stop());setBusy(false);setPhase('error');setLevel(0);setStatus(e instanceof Error?e.message:'Please try again.');}}
  };
  recorder.start();
  {
   const context=new AudioContext(),source=context.createMediaStreamSource(media),analyser=context.createAnalyser();
   analyser.fftSize=2048;source.connect(analyser);const samples=new Float32Array(analyser.fftSize);
   const interval=setInterval(()=>{if(turn!==version.current||recorder.state!=='recording')return;analyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);setLevel(Math.min(1,rms*6));if(automatic){const decision=detector.sample(rms,performance.now());if(decision!=='listen'){idle=decision==='idle';recorder.stop();}}},50);
   analysis.current=()=>{clearInterval(interval);source.disconnect();void context.close().catch(()=>{});analysis.current=null;};
  }
  setRecording(true);setBusy(false);setPhase('listening');setStatus(automatic?'Listening. Take your time; I will reply after your pause.':'Listening. Press Send now when you are done.');timer.current=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},25000);
 }catch(e){if(turn!==version.current)return;loop.current.stop();rec.current?.dispose();liveInput.current?.stop();speech.current?.stop();analysis.current?.();stream.current?.getTracks().forEach(t=>t.stop());setBusy(false);setPhase('error');setLevel(0);setStatus(e instanceof DOMException&&e.name==='NotAllowedError'?'Allow microphone access in your browser, then try again.':e instanceof Error?e.message:'Please try again.');}}
 return <main lang="en" className="voice-screen">
  <header><p className="voice-eyebrow">SAATHI</p><h1>A little company.<br/>Just a conversation away.</h1><p>Speak naturally in Hindi. Saathi will reply in Hindi.</p></header>
  <label className="voice-caption">Companion personality <select aria-label="Companion personality" value={policy} disabled={recording||busy} onChange={e=>{stop();const selected=e.target.value==='persona_v2'?'persona_v2':'legacy';setPolicy(selected);try{localStorage.setItem('saathi-persona-policy',selected);}catch{/* Session choice still works. */}}}><option value="persona_v2">Tara — Saathi 2.0</option><option value="legacy">Saathi — classic</option></select></label>
  {policy==='persona_v2'&&<p className="voice-caption">Tara is an AI companion. Response quality is still being evaluated.</p>}
  {process.env.NODE_ENV==='development'&&<details className="voice-settings"><summary>Development diagnostics</summary><p>Selected: {policy==='persona_v2'?'Tara / persona_v2':'Saathi / legacy'}. Server state below updates after a reply.</p>{diagnostics&&<><p>Server: {diagnostics.persona} / {diagnostics.policy}. Evon: {diagnostics.model}. Source: {diagnostics.source}. Strategy: {diagnostics.strategy} ({diagnostics.director}). Recovery: {diagnostics.recovery}.</p><p>{diagnostics.timing}</p></>}</details>}
  <VoiceOrb phase={phase} level={level}/>
  <p className="voice-caption" aria-live="polite">{runtimeStatus}</p>
  <p className="voice-status" role="status" aria-live="polite">{!busy&&!recording&&runtimeState==='offline'?'Conversation unavailable — the local service needs attention.':!busy&&!recording&&runtimeState==='loading'?'The model is loading. Please wait for the connection check to succeed.':status}</p>
  {runtimeState==='offline'&&process.env.NODE_ENV==='development'&&<p className="voice-caption">Open the Evon startup terminal to see the failure. If Windows Application Control blocked the runner, an approved runner or administrator approval is required. You can still <a href="/voice-preview?study=1">listen to the saved voice samples</a>.</p>}
  {(busy||recording)&&<button className="voice-secondary voice-stop" onClick={stop}>Stop</button>}
  <p className="voice-caption">You can ask for a conversation topic, say “just listen”, or skip a topic. Say “you can ask questions now” to resume questions. These choices last until Stop.</p>
  {busy&&waitingSeconds>=3&&<p className="voice-caption">Waiting {waitingSeconds}s. Local reasoning can take longer on this laptop. You can press Stop.</p>}
  <div className="voice-controls"><button className="call-button" disabled={busy||checkingRuntime||runtimeState==='checking'} onClick={()=>canRetryRecording?retryRecording.current?.():recording?rec.current?.stop():runtimeState!=='ready'?void checkRuntime(undefined,true):void start()}>{canRetryRecording?'Retry my recording':recording?'Send now':checkingRuntime||runtimeState==='checking'?'Checking connection…':runtimeState!=='ready'?'Check connection':'Start talking'}</button><div className="voice-secondary-controls"><button className="voice-secondary" onClick={stop}>Stop</button>{busy&&ready.current&&<button className="voice-secondary" onClick={()=>void interrupt()}>Interrupt reply</button>}<button className="voice-secondary" onClick={stop}>Change person</button><button className="voice-secondary" disabled={!last.current||recording||busy||canRetryRecording} onClick={()=>void repeat()}>Repeat reply</button></div></div>
  <p className="voice-caption">Start once, then speak naturally. Saathi listens again after each reply. Stop ends the conversation. Up to 25 seconds per turn.</p>
  <details className="voice-settings"><summary>Adapt conversation</summary><label><input type="checkbox" checked={adaptive} disabled={recording||busy} onChange={e=>{stop();setAdaptive(e.target.checked);}}/> Adapt to my requests, words and voice cues</label><p>Ask in Hindi for slower speech, shorter answers, fewer questions or a plain voice. Stated feelings and broad changes in pitch and volume may soften a reply. These uncertain cues stay in this session; they do not assess your mood, personality or health. Transcript-only input has no voice cues.</p><label><input type="checkbox" checked={gentle} disabled={recording||busy} onChange={e=>{stop();setGentle(e.target.checked);}}/> Gentle conversation — experimental</label><p>Optional support with simpler turns, longer pauses and patient repetition. Say “यादों की बात करें” for a familiar-moment invitation. This is not dementia assessment or treatment; use fictional information during supported testing.</p></details>
  <details className="voice-settings"><summary>Conversation settings</summary><label><input type="checkbox" checked={automatic} disabled={recording||busy} onChange={e=>setAutomatic(e.target.checked)}/> Hands-free conversation</label><label>Pause before replying<select value={pauseMs} disabled={recording||busy} onChange={e=>setPauseMs(Number(e.target.value))}><option value={1500}>Quicker reply (1.5 seconds)</option><option value={2200}>Patient (2.2 seconds)</option><option value={3500}>Extra time (3.5 seconds)</option></select></label><label><input type="checkbox" checked={live} disabled={recording||busy} onChange={e=>setLive(e.target.checked)}/> Live microphone streaming (test)</label><label><input type="checkbox" checked={barge} disabled={recording||busy} onChange={e=>setBarge(e.target.checked)}/> Interrupt by speaking (headphone test)</label></details>
  <CompanionPreferences revision={memoryRevision} onChange={stop}/><p className="voice-caption">Local prototype. Audio is processed by Gnani. Model quality is still being evaluated; please use fictional test information. Optional weather data: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. The weather location resets when you stop.</p>
 </main>;
}

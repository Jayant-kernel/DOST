import { NextResponse } from 'next/server';
import { randomBytes,createHash } from 'node:crypto';
import { createProviders, ProviderError,NoSpeechError, type Message } from '@/lib/gnani/providers';
import {voiceFailure} from '@/lib/gnani/voice-failure';
import { voiceSessions as sessions } from '@/lib/gnani/sessions';
import { profileId,ownerId,selectionToken } from '@/lib/local-demo';
import { profiles } from '@/lib/profiles';
import {readBoundedBytes,InputError} from '@/lib/bounded-json';
import {handleVoiceMemory} from '@/lib/gnani/voice-memory';
import {historyRetentionRequest} from '@/lib/gnani/history-retention';
import {handleSpeaker,introduction} from '@/lib/gnani/speaker';
import {expressiveSpeech,conversationCue} from '@/lib/gnani/expression';
import {conversationTime,validTimeZone} from '@/lib/gnani/conversation-context';
import {recoverReply,type RecoveredReply} from '@/lib/gnani/reply-recovery';
import {publicSpeechCache} from '@/lib/gnani/speech-cache';
import {weatherConversation} from '@/lib/gnani/weather-conversation';
import {initialAdaptation,speechDelivery} from '@/lib/gnani/adaptation';
import {vocalFeatures,relativeVoiceCue} from '@/lib/gnani/care-cues';
import {StorageError} from '@/lib/shop/store';
import {issueListenToken} from '@/lib/gnani/listen-token.mjs';
import {activeBehaviourPolicy,isBehaviourPolicy,type BehaviourPolicy} from '@/lib/gnani/companion';
import {directConversation,engagingFallback} from '@/lib/gnani/conversation-director';
import {observeConversation,planConversationTurn,type ConversationPlan} from '@/lib/gnani/conversation-planner';
export const runtime='nodejs';
export async function POST(request:Request) {
  const url=new URL(request.url);
  const host=request.headers.get('host') ?? '';
  if(process.env.NODE_ENV==='production'||!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||request.headers.get('origin')!==`http://${host}`)return NextResponse.json({error:'Local same-origin demo only'},{status:403});
  for(const [id,s] of sessions)if(s.expires<Date.now())sessions.delete(id);
  const cookie=/(?:^|;\s*)saathi_voice=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie')??'')?.[1];
  if(url.searchParams.has('stop')){if(cookie)sessions.delete(cookie);return new NextResponse(null,{status:204});}
  if(url.searchParams.has('start')) {
    const selectedPolicy=url.searchParams.get('policy');
    if(selectedPolicy!==null&&!isBehaviourPolicy(selectedPolicy))return NextResponse.json({error:'Invalid policy'},{status:400});
    const policy=(selectedPolicy??activeBehaviourPolicy) as BehaviourPolicy;
    if(cookie)sessions.delete(cookie);
    if(sessions.size>=30)return NextResponse.json({error:'Session limit'},{status:429});
    const identify=url.searchParams.has('identify'),token=identify&&!ownerId(request)?randomBytes(32).toString('hex'):undefined;
    const owner=ownerId(request)??(token?createHash('sha256').update(token).digest('hex'):undefined);
    const id=randomBytes(32).toString('hex');sessions.set(id,{expires:Date.now()+2100000,messages:[],busy:false,turns:0,ownerId:owner,identify,behaviourPolicy:policy,adaptation:initialAdaptation(url.searchParams.get('adaptive')!=='0',url.searchParams.get('gentle')==='1'),timeZone:validTimeZone(url.searchParams.get('timeZone')),profileId:identify?undefined:profileId(request)??undefined});
    const response=NextResponse.json({ready:true},{headers:{'X-Saathi-Policy':policy,'X-Saathi-Persona':policy==='persona_v2'?'tara_v1':'saathi','X-Saathi-Model-Invoked':'0'}});if(token)response.cookies.set('saathi_profile',token,{httpOnly:true,sameSite:'strict',path:'/api',maxAge:2592000});response.cookies.set('saathi_voice',id,{httpOnly:true,sameSite:'strict',path:'/api/voice',maxAge:2100});return response;
  }
  const session=cookie?sessions.get(cookie):undefined;
  if(!session)return NextResponse.json({error:'Please start a new conversation.'},{status:401});
  if(session.ownerId&&session.ownerId!==ownerId(request))return NextResponse.json({error:'Device session mismatch'},{status:403});
  if(session.profileId&&session.profileId!==profileId(request))return NextResponse.json({error:'Profile mismatch'},{status:403});
  if(url.searchParams.has('interrupt')){session.controller?.abort();session.controller=undefined;session.busy=false;session.pendingMemory=undefined;return new NextResponse(null,{status:204});}
  if(session.busy)return NextResponse.json({error:'A reply is still running. Please wait or press Stop.'},{status:429});
  if(session.turns>=40)return NextResponse.json({error:'This conversation reached its turn limit. Press Start talking to begin again.'},{status:429});
  if(url.searchParams.has('listen')){
    if((session.listenUntil??0)>Date.now())return NextResponse.json({error:'Wait before starting another live microphone'},{status:429});
    try{const token=issueListenToken(process.env.SESSION_SIGNING_SECRET,`http://${host}`);session.listenUntil=Date.now()+1000;return NextResponse.json({token},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Live voice configuration unavailable'},{status:503});}
  }
  const welcome=url.searchParams.has('welcome')&&session.identify;
  const contentType=welcome?'application/json':request.headers.get('content-type');
  if(contentType!=='audio/wav'&&contentType!=='application/json')return NextResponse.json({error:'WAV or transcript required'},{status:415});
  // Lock before awaiting upload chunks so concurrent uploads cannot bypass busy.
  session.busy=true;
  const controller=new AbortController();session.controller=controller;
  const signal=AbortSignal.any([request.signal,controller.signal]);
  // Interrupt releases the session for another turn. An older request may still
  // resolve an asynchronous provider/store operation; it no longer owns state.
  const ownsTurn=()=>session.controller===controller&&sessions.get(cookie!)===session;
  const assertCurrent=()=>{signal.throwIfAborted();if(!ownsTurn())throw new DOMException('Turn replaced','AbortError');};
  let streaming=false;
  const timings={transcription:0,reasoning:0,voiceCues:0,continuity:0,routing:0,memory:0};
  let memory:Awaited<ReturnType<typeof handleVoiceMemory>>;
  let cue:ReturnType<typeof conversationCue>;
  let speaker:Awaited<ReturnType<typeof handleSpeaker>>;
  let recovered:RecoveredReply|undefined;
  let directed:ReturnType<typeof directConversation>|undefined;
  let planned:ConversationPlan|undefined;
  let copyRetry:string|undefined;
  let responseAdaptation=session.adaptation;
  const finishResponse=(response:Response)=>{
    if(responseAdaptation){response.headers.set('X-Saathi-Pace',responseAdaptation.gentle||responseAdaptation.enabled&&responseAdaptation.pace==='slow'?'slow':'normal');response.headers.set('X-Saathi-Gentle',responseAdaptation.gentle?'1':'0');response.headers.set('X-Saathi-Adaptive',responseAdaptation.enabled?'1':'0');}
    response.headers.set('Server-Timing',`transcription;dur=${timings.transcription}, reasoning;dur=${timings.reasoning}, voiceCues;dur=${timings.voiceCues}, continuity;dur=${timings.continuity}, routing;dur=${timings.routing}, memory;dur=${timings.memory}`);
    response.headers.set('X-Saathi-Policy',session.behaviourPolicy??activeBehaviourPolicy);
    response.headers.set('X-Saathi-Reply-Source',response.status>=400?'error':recovered?.recovery?'recovery':planned?.source??'control');
    if(session.behaviourPolicy==='persona_v2')response.headers.set('X-Saathi-Persona','tara_v1');
    if(directed)response.headers.set('X-Saathi-Action',directed.decision.action);
    response.headers.set('X-Saathi-Model-Invoked',recovered&&!planned?.deterministic?'1':'0');
    if(planned){response.headers.set('X-Saathi-Director-Applied',planned.directorApplied?'1':'0');if(planned.directed)response.headers.set('X-Saathi-Strategy',planned.directed.decision.action);}
    if(directed?.decision.end)response.headers.set('X-Saathi-End','1');
    if(cue?.end)response.headers.set('X-Saathi-End','1');
    if(recovered?.recovery)response.headers.set('X-Saathi-Recovery','1');
    if(recovered?.engaged)response.headers.set('X-Saathi-Engaging-Fallback','1');
    if(recovered?.failure)response.headers.set('X-Saathi-Recovery-Reason',recovered.failure);
    if(recovered?.detail)response.headers.set('X-Saathi-Recovery-Detail',recovered.detail);
    if(recovered?.rule)response.headers.set('X-Saathi-Recovery-Rule',recovered.rule);
    if(copyRetry)response.headers.set('X-Saathi-Copy-Retry',copyRetry);
    if(speaker?.selected&&session.ownerId)response.headers.append('Set-Cookie',`saathi_person=${selectionToken(session.ownerId,speaker.selected)}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=2592000`);
    if(memory?.deleted)response.headers.append('Set-Cookie','saathi_person=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');
    if(memory?.changed||speaker?.changed)response.headers.set('X-Saathi-Memory-Changed','1');
    if(memory?.token)response.headers.append('Set-Cookie',`saathi_profile=${memory.token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=2592000`);
    if(memory?.deleted&&!session.ownerId)response.headers.append('Set-Cookie','saathi_profile=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');
    return response;
  };
  try {
  const bytes=welcome?Buffer.from('{}'):Buffer.from(await readBoundedBytes(request,contentType==='audio/wav'?1000000:8192,signal));
  assertCurrent();
  let transcript:string|undefined;
  if(!welcome&&contentType==='application/json'){try{const data=JSON.parse(bytes.toString('utf8'));if(typeof data.transcript!=='string'||!data.transcript.trim()||data.transcript.length>2000||Object.keys(data).length!==1)throw Error();transcript=data.transcript.trim();}catch{return NextResponse.json({error:'Invalid transcript'},{status:400});}}
  else if(!welcome&&(bytes.length<44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'))return NextResponse.json({error:'Invalid WAV'},{status:400});
  const key=process.env.GNANI_API_KEY?.trim();if(!key)return NextResponse.json({error:'Gnani key missing'},{status:503});
  session.busy=true;session.turns++;
  try {
    const preferences=session.profileId?(await profiles.read(session.profileId)).preferences:{language:'hi' as const};
    assertCurrent();
    const v2=session.behaviourPolicy==='persona_v2';
    // Startup preparation warms the static policy. Resetting it before every
    // reply discards dialogue cache and repeats expensive prompt processing.
    const config={apiKey:key,evonUrl:process.env.EVON_BASE_URL||'http://127.0.0.1:8080',tokenizerUrl:'http://127.0.0.1:8081',behaviourPolicy:session.behaviourPolicy??activeBehaviourPolicy,voice:v2?'Shivani':'Yashraj',ttsModel:'timbre-v3.0' as const,preferences};
    const p=createProviders(config,fetch,signal);
    const transcriptionStart=performance.now();
    const text=welcome?'':transcript??await p.transcribe(new Blob([bytes],{type:'audio/wav'}));
    assertCurrent();
    timings.transcription=Math.round(performance.now()-transcriptionStart);
    const previousProfile=session.profileId;
    const continuityStart=performance.now();
    // A privacy control before name selection is not a person's spoken name.
    if(!welcome&&historyRetentionRequest(text))memory=await handleVoiceMemory(session,text,profiles,signal);
    assertCurrent();
    speaker=welcome?{reply:v2?'नमस्ते, मैं तारा हूँ, आपकी एआई साथी। आपको किस नाम से बुलाऊँ?':introduction}:memory?undefined:await handleSpeaker(session,text,profiles,signal);
    assertCurrent();
    timings.continuity=Math.round(performance.now()-continuityStart);
    const messages:Message[]=[...session.messages.slice(-6),{role:'user',content:text}];
    if(!speaker&&!memory)memory=await handleVoiceMemory(session,text,profiles,signal);
    assertCurrent();
    if(memory?.deleted){session.returnTurn=undefined;if(session.ownerId)session.identify=true;}
    if(memory?.changed)for(const [id,other] of sessions)if(other!==session&&other.profileId&&(other.profileId===previousProfile||other.profileId===session.profileId))sessions.delete(id);
    if(speaker?.selected||memory?.deleted||memory?.retentionChanged){session.boundaries=undefined;session.engagement=undefined;session.vocalBaseline=undefined;session.meal=undefined;session.social=undefined;session.weather=undefined;session.director=undefined;session.adaptation=initialAdaptation(session.adaptation?.enabled,session.adaptation?.gentle);}
    const observation=!speaker&&!memory?observeConversation(messages,session,config.behaviourPolicy):undefined;
    const boundaries=observation?.boundaries??session.boundaries;
    // Ordinary turn planning is tentative until speech completes. Identity and
    // verified privacy controls above retain their immediate service semantics.
    const turnAdaptation=observation?.adapted.state??session.adaptation;
    responseAdaptation=turnAdaptation;
    let turnBaseline=session.vocalBaseline;
    const listenOnly=observation?.listenOnly??false;
    const voiceStart=performance.now();
    if(!speaker&&!memory&&turnAdaptation?.enabled){
      const acoustic=relativeVoiceCue(contentType==='audio/wav'?vocalFeatures(bytes):undefined,session.vocalBaseline);
      turnBaseline=acoustic.baseline;
      // A change from this speaker's recent sound can only soften delivery;
      // positive self-report and explicit plain voice retain precedence.
      turnAdaptation.tone=observation?.feeling?.tone??(acoustic.changed?'calm':undefined);
    }else if(!turnAdaptation?.enabled)turnBaseline=undefined;
    const turnState={adaptation:turnAdaptation,engagement:session.engagement,boundaries:session.boundaries,returnTurn:session.returnTurn,meal:session.meal,social:session.social,director:session.director,weather:session.weather};
    timings.voiceCues=Math.round(performance.now()-voiceStart);
    cue=observation?.cue;
    const reasoningStart=performance.now();
    const weather=observation&&!cue&&!observation.adapted.reply&&!observation.engagement.reply?await weatherConversation(text,session.weather,signal):undefined;
    assertCurrent();
    let context={time:conversationTime(new Date(),session.timeZone),recall:[] as Awaited<ReturnType<typeof profiles.recall>>,...(boundaries?.hints.length?{boundaries:boundaries.hints}:{})};
    if(observation)planned=planConversationTurn({messages,state:turnState,policy:config.behaviourPolicy,preferences,context,observation,weatherReply:weather?.reply});
    if(planned?.directorApplied)directed=planned.directed;
    if(planned?.reply===undefined&&!speaker&&!memory){
      const memoryStart=performance.now();
      const recall=!session.retentionPaused&&session.ownerId&&session.profileId?await profiles.recall(session.ownerId,session.profileId,text):[];
      timings.memory=Math.round(performance.now()-memoryStart);
      assertCurrent();
      context={...context,recall};
      const routingStart=performance.now();
      planned=planConversationTurn({messages,state:turnState,policy:config.behaviourPolicy,preferences,context,observation:observation!,weatherReply:weather?.reply});
      directed=planned.directed;
      timings.routing=Math.round(performance.now()-routingStart);
      recovered=directed?.verifiedReply?{reply:directed.verifiedReply,recovery:false,end:false}:await recoverReply(reasoningSignal=>createProviders({...config,listenOnly,adaptation:turnAdaptation,decision:directed?.decision,context:{...context,...(session.director?{interaction:session.director}:{})},onCopyRetry:rule=>{copyRetry=rule;}},fetch,reasoningSignal).reply(messages,true),signal,session.recoveries,20000,listenOnly,config.behaviourPolicy==='persona_v2'?engagingFallback(messages,directed?.state??session.director,context.time.date):undefined);
    }
    assertCurrent();
    const reply=speaker?.reply??memory?.reply??planned?.reply??recovered!.reply;
    const publicCare=Boolean(planned?.publicCare);
    timings.reasoning=Math.round(performance.now()-reasoningStart);
    if(recovered?.recovery||recovered?.engaged)console.warn(recovered.engaged?'Voice reasoning engaging fallback':'Voice reasoning recovery',{reason:recovered.failure,detail:recovered.detail,rule:recovered.rule,copyRetry,ms:timings.reasoning,policy:config.behaviourPolicy});
    else if(copyRetry)console.warn('Voice reasoning copy retry accepted',{rule:copyRetry,ms:timings.reasoning,policy:config.behaviourPolicy});
    const delivery=speechDelivery(turnAdaptation),speechProvider=createProviders({...config,speechSpeed:delivery.speed},fetch,signal);
    const spokenReply=expressiveSpeech(reply,text,delivery);
    if(!spokenReply)throw Error('Empty speech reply');
    // A resumed visit starts a fresh dialogue. Retrieve past words as dated data,
    // rather than replaying old assistant turns as if they were spoken just now.
    const history=memory?.changed?[]:speaker?[{role:'assistant' as const,content:reply}]:messages;
    const commit=async()=>{assertCurrent();if(!speaker&&!memory&&!session.retentionPaused&&session.ownerId&&session.profileId)await profiles.appendHistory(session.ownerId,session.profileId,text,reply,recovered?.recovery?'recovery':'reply');assertCurrent();if(planned)Object.assign(session,planned.next);session.vocalBaseline=turnBaseline;if(weather)session.weather=weather.state;else session.weather={...session.weather,awaitingPlace:false};session.boundaries=boundaries;session.messages=(speaker||memory||recovered?.recovery?history:[...history,{role:'assistant' as const,content:reply}]).slice(-8);session.recoveries=recovered?.recovery?(session.recoveries??0)+1:0;if(directed&&!recovered?.recovery)session.director=directed.state;};
    if(request.headers.get('accept')==='application/octet-stream'){
      const iterator=publicSpeechCache.stream(spokenReply,config.voice,config.ttsModel+':'+delivery.speed,Boolean(welcome||cue||recovered?.recovery||publicCare),()=>speechProvider.speakStream(spokenReply),signal)[Symbol.asyncIterator]();streaming=true;
      const release=()=>{if(session.controller===controller){session.busy=false;session.controller=undefined;}};
      const body=new ReadableStream<Uint8Array>({
        async pull(output){try{assertCurrent();const item=await iterator.next();assertCurrent();if(item.done){await commit();output.close();release();}else output.enqueue(item.value);}catch{if(ownsTurn())session.pendingMemory=undefined;controller.abort();output.error(new Error('Speech stream interrupted'));release();}},
        async cancel(){if(ownsTurn())session.pendingMemory=undefined;controller.abort();try{await iterator.return?.();}finally{release();}}
      });
      return finishResponse(new Response(body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Audio-Sample-Rate':'16000','X-Accel-Buffering':'no','X-Saathi-Reply-Source':recovered?.recovery?'recovery':planned?.source??'control'}}));
    }
    const audio=await speechProvider.speak(spokenReply);
    assertCurrent();
    await commit();
    return finishResponse(NextResponse.json({audio:Buffer.from(audio).toString('base64')},{headers:{'Cache-Control':'no-store'}}));
  }catch(error){if(ownsTurn())session.pendingMemory=undefined;if(signal.aborted||!ownsTurn())return new NextResponse(null,{status:499});if(error instanceof ProviderError&&!(error instanceof NoSpeechError))console.warn('Voice provider failed',{stage:error.stage,status:error.status});const failure=error instanceof StorageError?{status:503,code:'storage_unavailable',error:'Saved information is unavailable. Please try again.'}:voiceFailure(error);return finishResponse(NextResponse.json({error:failure.error,code:failure.code},{status:failure.status}));}
  finally{if(!streaming&&session.controller===controller)session.busy=false;}
  } catch(error){if(signal.aborted||!ownsTurn())return new NextResponse(null,{status:499});return NextResponse.json({error:error instanceof InputError?error.message:'Audio upload failed'},{status:error instanceof InputError?error.status:400});}
  finally { if(!streaming&&session.controller===controller){session.busy=false;session.controller=undefined;} }
}

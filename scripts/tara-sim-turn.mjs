// One turn of a simulated conversation with Tara, for elder-persona test agents.
// Mirrors /api/voice turn planning (observe -> plan -> verified reply or local
// Evon with recovery/engaging fallback -> commit state), without microphone,
// Prisma STT, Timbre TTS, profiles or keys. Local inference only; fictional data.
//
//   node --no-warnings scripts/tara-sim-turn.mjs <session.json> start <Name> [ISO time] [policy]
//   node --no-warnings scripts/tara-sim-turn.mjs <session.json> say "<elder words>"
//
// The session file keeps state and a full transcript; every turn prints one JSON
// line {tara, source, action, ms, question}.
import {readFile,writeFile} from 'node:fs/promises';
import {observeConversation,planConversationTurn} from '../src/lib/gnani/conversation-planner.ts';
import {createProviders} from '../src/lib/gnani/providers.ts';
import {initialAdaptation} from '../src/lib/gnani/adaptation.ts';
import {recoverReply} from '../src/lib/gnani/reply-recovery.ts';
import {engagingFallback} from '../src/lib/gnani/conversation-director.ts';
import {conversationTime,openingRemark,openingQuestion} from '../src/lib/gnani/conversation-context.ts';

process.on('unhandledRejection',error=>{if(error?.name!=='TimeoutError'&&error?.name!=='AbortError')console.error('unhandled',error?.name);});
const [file,command,...args]=process.argv.slice(2);
if(!file||!['start','say'].includes(command))throw Error('Usage: <session.json> start <Name> [ISO time] [policy] | <session.json> say "<text>"');
const local={apiKey:'unused',voice:'x',evonUrl:'http://127.0.0.1:8080',tokenizerUrl:'http://127.0.0.1:8081'};
const transport=async(url,init)=>{if(!/^http:\/\/127\.0\.0\.1:808[01]\//.test(String(url)))throw Error('Only local inference allowed');return fetch(url,init);};

if(command==='start'){
 const [name='रमेश',at=new Date().toISOString(),policy='persona_v2']=args;
 const time=conversationTime(new Date(at),'Asia/Kolkata');
 const greeting=`नमस्ते ${name} जी, आपसे मिलकर अच्छा लगा। ${policy==='persona_v2'?openingRemark(time):openingQuestion(time)}`;
 await createProviders({...local,behaviourPolicy:policy},transport,AbortSignal.timeout(90000)).prepareReasoning();
 const session={policy,at,turns:0,recoveries:0,state:{adaptation:initialAdaptation(true,false)},messages:[{role:'assistant',content:greeting}],transcript:[{speaker:'tara',text:greeting,source:'greeting'}]};
 await writeFile(file,JSON.stringify(session,null,1));
 console.log(JSON.stringify({tara:greeting,source:'greeting'}));
}else{
 const text=args.join(' ').trim();if(!text)throw Error('Say something');
 const session=JSON.parse(await readFile(file,'utf8'));const policy=session.policy;session.turns++;
 // Simulated clock: about one minute per turn after the start time.
 const time=conversationTime(new Date(Date.parse(session.at)+session.turns*60000),'Asia/Kolkata');
 const messages=[...session.messages.slice(-6),{role:'user',content:text}];
 const observation=observeConversation(messages,session.state,policy);
 const context={time,recall:[],...(observation.boundaries?.hints.length?{boundaries:observation.boundaries.hints}:{})};
 const planned=planConversationTurn({messages,state:session.state,policy,context,observation});
 const directed=planned.directed,began=performance.now();let recovered,copyRetry;
 if(planned.reply===undefined){
  recovered=directed?.verifiedReply?{reply:directed.verifiedReply,recovery:false}:await recoverReply(signal=>createProviders({...local,behaviourPolicy:policy,listenOnly:observation.listenOnly,adaptation:observation.adapted.state,decision:directed?.decision,context:{...context,...(session.state.director?{interaction:session.state.director}:{})},onCopyRetry:rule=>{copyRetry=rule;}},transport,signal).reply(messages,true),AbortSignal.timeout(60000),session.recoveries,20000,observation.listenOnly,policy==='persona_v2'?engagingFallback(messages,directed?.state??session.state.director,time.date):undefined);
 }
 const reply=planned.reply??recovered.reply;
 Object.assign(session.state,planned.next);if(directed&&!recovered?.recovery)session.state.director=directed.state;
 session.messages=(recovered?.recovery?messages:[...messages,{role:'assistant',content:reply}]).slice(-8);
 session.recoveries=recovered?.recovery?session.recoveries+1:0;
 const source=recovered?.recovery?'recovery':recovered?.engaged?'engaging-fallback':planned.reply!==undefined?planned.source:directed?.verifiedReply?'verified':'model';
 const row={tara:reply,source,action:directed?.decision.action??null,ms:Math.round(performance.now()-began),question:/[?？]/u.test(reply),...(recovered?.failure?{failure:recovered.failure,detail:recovered.detail??null,rule:recovered.rule??null}:{}),...(copyRetry?{copyRetry}:{})};
 session.transcript.push({speaker:'elder',text},{speaker:'tara',text:reply,...row,tara:undefined});
 await writeFile(file,JSON.stringify(session,null,1));
 console.log(JSON.stringify(row));
}

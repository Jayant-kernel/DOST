import {readFile,writeFile,mkdir,stat,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as originalFixtures from './conversation-eval/fixtures.mjs';
import {recordingTransport} from './conversation-eval/transport.mjs';
import {observeConversation,planConversationTurn} from '../src/lib/gnani/conversation-planner.ts';
import {createProviders} from '../src/lib/gnani/providers.ts';
import {initialAdaptation} from '../src/lib/gnani/adaptation.ts';
import {selectRecall} from '../src/lib/gnani/conversation-context.ts';
import {recoverReply} from '../src/lib/gnani/reply-recovery.ts';
import {isBehaviourPolicy} from '../src/lib/gnani/companion.ts';
const args=process.argv.slice(2),option=(key,fallback)=>{const at=args.indexOf(key);return at<0?fallback:args[at+1];};
const fixtureSet=option('--fixture-set','original');if(!['original','phase2','verification','verification-holdout'].includes(fixtureSet))throw Error('Unknown fixture set');
const fixtureModule=fixtureSet.startsWith('verification')?await import('./conversation-eval/verification-cases.mjs'):fixtureSet==='phase2'?await import('./conversation-eval/phase2-cases.mjs'):originalFixtures;
const {scenarioVersion,fixtureMetadata}=fixtureModule;
const scenarios=fixtureSet==='verification-holdout'?fixtureModule.holdoutScenarios:fixtureModule.scenarios;
const mode=option('--mode','routing'),policy=option('--policy','persona_v2'),output=option('--output');
if(!['routing','live'].includes(mode)||!isBehaviourPolicy(policy)||!output)throw Error('Use --mode routing|live --policy legacy|full|persona_v2 --output tasks/NEW.json');
const destination=resolve(output),taskRoot=resolve('tasks');if(relative(taskRoot,destination).startsWith('..')||!destination.endsWith('.json'))throw Error('Report must be a new tasks/*.json file');
const resume=args.includes('--resume');
if(!resume)try{await stat(destination);throw Error('Report exists; preserve evidence and choose a new output');}catch(error){if(error.code!=='ENOENT')throw error;}
const ids=option('--ids')?.split(','),limit=Number(option('--limit',1000));
const selected=scenarios.filter(scenario=>!ids||ids.includes(scenario.id)).slice(0,limit);if(!selected.length)throw Error('No matching scenarios');
// Resume must notice changes in validators, persona, tokenizer transport and
// fixture/recorder helpers too, not only five top-level modules. Source only;
// never inspect environment, profiles, recordings or model files here.
const sourceFiles=['scripts/evaluate-conversation-intelligence.mjs'];
for(const directory of ['src/lib/gnani','scripts/conversation-eval']){
 const entries=await readdir(directory,{withFileTypes:true});
 sourceFiles.push(...entries.filter(entry=>entry.isFile()&&/\.(?:ts|mjs)$/u.test(entry.name)&&!entry.name.includes('.test.')).map(entry=>directory+'/'+entry.name));
}
sourceFiles.sort();
const codeHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
let report={version:1,date:new Date().toISOString(),mode,policy,fixtureSet,fixtureVersion:scenarioVersion,fixtureHash:createHash('sha256').update(JSON.stringify(selected)).digest('hex'),fixtureMetadata,codeHashes,clock:{timeZone:'Asia/Kolkata',date:'2026-11-04',time:'21:30',period:'night'},reference:{status:'skipped_no_configured_authorized_reference',cost:null},cost:{apiRequestsBilled:0,localInferenceCost:null,explanation:'Local Evon only; electricity/hardware rates unavailable. No paid reference or speech provider calls.'},rows:[],complete:false};
await mkdir(taskRoot,{recursive:true});
if(resume){const previous=JSON.parse(await readFile(destination,'utf8'));if(previous.complete||previous.mode!==mode||previous.policy!==policy||previous.fixtureHash!==report.fixtureHash||JSON.stringify(previous.codeHashes)!==JSON.stringify(codeHashes))throw Error('Resume requires unchanged incomplete report, fixture and source hashes');report=previous;}
else await writeFile(destination,JSON.stringify(report,null,2),{flag:'wx'});
if(mode==='live'){
 const props=await(await fetch('http://127.0.0.1:8080/props',{signal:AbortSignal.timeout(5000)})).json();report.runtime={build:props.build_info,slots:props.total_slots,context:props.default_generation_settings?.n_ctx,artifact:props.model_alias??'saathi-evon',modelFile:props.model_path?.split(/[\\/]/u).at(-1),serverDefaults:props.default_generation_settings?.params};
}
let gradeTurn;try{({gradeTurn}=await import('./conversation-eval/grade.mjs'));}catch{ /* In-progress baseline retains rubrics for later scoring. */ }
for(const scenario of selected){
 let state={adaptation:initialAdaptation(true,Boolean(scenario.gentle))},history=scenario.initialMessages??[],failures=0;
 for(let index=0;index<scenario.turns.length;index++){
  const recorded=report.rows.find(row=>row.scenario===scenario.id&&row.turn===index+1);
  if(recorded){if(!recorded.interrupted){
   if(recorded.stateAfter){state=recorded.stateAfter;history=recorded.historyAfter;failures=recorded.failuresAfter;}
   else{const messages=[...recorded.prior,{role:'user',content:recorded.input}],observation=observeConversation(messages,state,policy,Date.parse('2026-11-04T16:00:00Z'));const plan=planConversationTurn({messages,state,policy,preferences:recorded.preferences,context:recorded.context,observation});state=plan.next;if(plan.directorApplied&&plan.directed&&recorded.source!=='recovery')state.director=plan.directed.state;history=(recorded.source==='recovery'||recorded.finalResponse===null?messages:[...messages,{role:'assistant',content:recorded.finalResponse}]).slice(-8);failures=recorded.source==='recovery'?failures+1:0;}
  }continue;}
  const turn=scenario.turns[index],prior=history.slice(-6),messages=[...prior,{role:'user',content:turn.input}],preferences=scenario.preferences??{language:scenario.language==='hinglish'?'hinglish':'hi'};
  const observation=observeConversation(messages,state,policy,Date.parse('2026-11-04T16:00:00Z'));
  state.adaptation=observation.adapted.state;
  let context={time:report.clock,recall:[],...(observation.boundaries?.hints.length?{boundaries:observation.boundaries.hints}:{})};
  let planned=planConversationTurn({messages,state,policy,preferences,context,observation});
  if(!planned.deterministic){context={...context,recall:selectRecall(scenario.memory.map(row=>({created:Date.parse(row.at),user:row.text})),turn.input)};planned=planConversationTurn({messages,state,policy,preferences,context,observation});}
  const modelContext={...context,...(state.director?{interaction:state.director}:{})};
  const row={scenario:scenario.id,turn:index+1,language:scenario.language,split:scenario.split,input:turn.input,prior,policy,persona:policy==='persona_v2'?'tara_v1':'saathi',strategy:planned.directed?.decision.action??null,decision:planned.directed?.decision??null,directorInput:planned.directorInput??null,directorApplied:planned.directorApplied,availableMemory:scenario.memory,memory:context.recall,context:modelContext,preferences,rawResponse:null,finalResponse:planned.reply??null,deterministic:planned.deterministic,source:planned.source,modelInvoked:false,modelLatencyMs:null,expected:turn.expected,interrupted:false};
  const start=performance.now();let recovered;
  if(!planned.deterministic&&mode==='live'){
   const parent=new AbortController(),transport=recordingTransport(row);let timer;
   if(turn.interrupt)timer=setTimeout(()=>parent.abort(new DOMException('Synthetic interruption','AbortError')),100);
   try{recovered=await recoverReply(signal=>createProviders({apiKey:'unused-synthetic',voice:'Shivani',evonUrl:'http://127.0.0.1:8080',tokenizerUrl:'http://127.0.0.1:8081',behaviourPolicy:policy,preferences,context:modelContext,adaptation:state.adaptation,listenOnly:observation.listenOnly,decision:planned.directed?.decision},transport,signal).reply(messages,true),parent.signal,failures,20000,observation.listenOnly);row.finalResponse=recovered.reply;row.failure=recovered.failure;row.failureDetail=recovered.detail;if(recovered.recovery)row.source='recovery';}
   catch(error){if(parent.signal.aborted){row.interrupted=true;row.source='interrupted';}else{row.failure='unavailable';row.error=error.stage??error.name;}}
   finally{clearTimeout(timer);}
  }else if(turn.interrupt){row.interrupted=true;row.finalResponse=null;row.source='interrupted';}
  row.elapsedMs=Math.round(performance.now()-start);row.modelLatencyMs=row.modelInvoked?(row.modelLatencyMs??row.elapsedMs):null;
  row.droppedMessages=row.promptMessages?messages.length-(row.promptMessages.length-1):0;
  row.promptPending=mode==='routing'&&!planned.deterministic;
  row.end=planned.end;
  if(!row.interrupted){state=planned.next;if(planned.directorApplied&&planned.directed&&!recovered?.recovery)state.director=planned.directed.state;history=(recovered?.recovery||row.finalResponse===null?messages:[...messages,{role:'assistant',content:row.finalResponse}]).slice(-8);failures=recovered?.recovery?failures+1:0;}
  row.stateAfter=structuredClone(state);row.historyAfter=structuredClone(history);row.failuresAfter=failures;
  row.grade=gradeTurn?gradeTurn(row,turn.expected):{outcome:'needs-review',semanticReview:'pending',failures:[],rubric:turn.expected.rubric};report.rows.push(row);
  await writeFile(destination,JSON.stringify(report,null,2));console.log(JSON.stringify({scenario:row.scenario,turn:row.turn,strategy:row.strategy,source:row.source,failure:row.failure,detail:row.failureDetail,ms:row.elapsedMs,grade:row.grade.outcome}));
 }
}
report.complete=true;report.summary={scenarios:selected.length,turns:report.rows.length,modelCalls:report.rows.reduce((n,row)=>n+(row.modelCalls??0),0),deterministic:report.rows.filter(row=>row.deterministic).length,recoveries:report.rows.filter(row=>row.source==='recovery').length,interruptions:report.rows.filter(row=>row.interrupted).length,gradedFailures:report.rows.filter(row=>row.grade.outcome==='fail').length,semanticReview:'pending'};
await writeFile(destination,JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));

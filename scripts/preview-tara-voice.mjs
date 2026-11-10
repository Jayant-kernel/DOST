// Fixed synthetic TTS only, through the existing local application. No keys,
// env files, Evon, STT, profiles or new providers. At most9 unique requests.
import {mkdir,writeFile,copyFile,stat} from 'node:fs/promises';
import {constants} from 'node:fs';import {join} from 'node:path';
import {voiceSamples,previewVariants,previewSpeech} from '../src/lib/gnani/voice-preview.ts';
import {pcmWav} from '../src/lib/gnani/pcm.ts';
const root='tasks/voice-prototype',audio=join(root,'audio');await mkdir(audio,{recursive:true});
try{await stat(join(root,'results.json'));throw Error('Preserve completed evidence; choose a new experiment instead of overwriting.');}catch(e){if(e.code!=='ENOENT')throw e;}
const report={version:1,date:new Date().toISOString(),synthetic:true,physicalListening:false,complete:false,model:'timbre-v3.0',voice:'Shivani',speed:1,language:'hi-IN',source:'Existing authorized local API route only',uniqueRequests:0,failures:0,rows:[],listenerRatings:{independentHindiSpeakers:0,pronunciation:null,warmth:null,naturalness:null,expressionFit:null,voiceConsistency:null,artificiality:null},playbackLatencyMs:null,cost:null,costNote:'Existing account credits used; actual monetary charge/remaining credits unmeasured. Identical requests reused, tags count toward provider characters.'};
await writeFile(join(root,'results.json'),JSON.stringify(report,null,2),{flag:'wx'});
const completed=new Map();let blocked=false;
for(const sample of voiceSamples)for(const variant of previewVariants){
 const plan=previewSpeech(sample.id,variant),file=join(audio,`${sample.id}-${variant}.wav`),signature=JSON.stringify([plan.text,plan.voice,plan.speed,plan.model]);
 const row={id:sample.id,style:sample.style,variant,spokenText:plan.spokenText,synthesisText:plan.text,tags:plan.tags,file,success:false,firstAudioMs:null,synthesisTransferMs:null,audioDurationMs:null};
 if(completed.has(signature)){const original=completed.get(signature);await copyFile(original.file,file,constants.COPYFILE_EXCL);Object.assign(row,{success:true,reusedFrom:original.file,independentObservation:false,audioDurationMs:original.audioDurationMs});}
 else if(blocked)row.error='Stopped after service/access limit; not attempted';
 else{
  const began=performance.now();report.uniqueRequests++;
  try{
   const response=await fetch('http://localhost:3000/api/voice/preview',{method:'POST',headers:{origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({id:sample.id,variant,speed:1,expressiveEnabled:variant==='expressive'}),signal:AbortSignal.timeout(30000)});
   row.status=response.status;
   if(!response.ok){const body=await response.json();row.providerStatus=body.providerStatus;blocked=[401,402,403,429,503].includes(body.providerStatus??response.status);throw Error('TTS preview rejected');}
   row.providerFirstAudioMs=Number(response.headers.get('X-Saathi-First-Audio-Ms'));
   const chunks=[];let total=0;
   for await(const bytes of response.body){if(!total)row.firstAudioMs=Math.round(performance.now()-began);total+=bytes.length;if(total>2000000)throw Error('Audio limit');chunks.push(bytes);}
   const pcm=Buffer.concat(chunks),wav=pcmWav(pcm);row.synthesisTransferMs=Math.round(performance.now()-began);row.audioDurationMs=pcm.length/32;row.pcmBytes=pcm.length;
   let squared=0,clipped=0;for(let i=0;i<pcm.length;i+=2){const x=pcm.readInt16LE(i)/32768;squared+=x*x;if(Math.abs(x)>.999)clipped++;}
   row.rms=Math.sqrt(squared/(pcm.length/2));row.clippedSamples=clipped;
   await writeFile(file,wav,{flag:'wx'});row.success=true;row.independentObservation=true;completed.set(signature,row);
  }catch(e){row.error=e.name;report.failures++;}
 }
 report.rows.push(row);await writeFile(join(root,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({id:row.id,variant,success:row.success,firstAudioMs:row.firstAudioMs,reusedFrom:row.reusedFrom,error:row.error}));
}
const measured=report.rows.filter(r=>r.independentObservation),median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);return x.length?(x[Math.floor((x.length-1)/2)]+x[Math.floor(x.length/2)])/2:null;};
report.summary={availableLabeledFiles:report.rows.filter(r=>r.success).length,totalLabeledFiles:report.rows.length,uniqueSuccessfulRequests:measured.length,uniqueRequests:report.uniqueRequests,failedRequests:report.failures,medianFirstAudioMs:median(measured.map(r=>r.firstAudioMs)),medianSynthesisTransferMs:median(measured.map(r=>r.synthesisTransferMs)),neutral:measured.filter(r=>r.variant==='existing'||r.variant==='neutral').map(r=>({id:r.id,firstAudioMs:r.firstAudioMs,totalMs:r.synthesisTransferMs})),expressive:measured.filter(r=>r.variant==='expressive').map(r=>({id:r.id,firstAudioMs:r.firstAudioMs,totalMs:r.synthesisTransferMs})),status:report.failures||blocked?'BLOCKED':'PREVIEW_AVAILABLE_LISTENER_REVIEW_REQUIRED'};
report.complete=true;await writeFile(join(root,'results.json'),JSON.stringify(report,null,2));
const form={status:'UNRATED',reviewer:null,consent:null,independentHumanVerified:false,scale:'1 low to5 high; artificiality1none to5veryartificial; null NOT MEASURED',rows:report.rows.filter(r=>r.success).map(r=>({id:r.id,variant:r.variant,pronunciation:null,warmth:null,naturalness:null,expressionFit:null,voiceConsistency:null,artificiality:null}))};
await writeFile(join(root,'listener-template.json'),JSON.stringify(form,null,2),{flag:'wx'});
console.log(JSON.stringify(report.summary));if(report.failures||blocked)process.exitCode=1;

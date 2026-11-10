import {readBoundedJson,InputError} from '../bounded-json.ts';
import {localDemoAllowed} from '../local-demo.ts';
import {createProviders,ProviderError} from './providers.ts';
import {previewSpeech,type PreviewVariant} from './voice-preview.ts';
// Dedicated synthetic preview only. No session, memory, microphone or Evon.
export function voicePreviewService(getKey:()=>string|undefined,transport:typeof fetch=fetch){
 let busy=false,windowStart=0,count=0;
 return async function POST(request:Request){
  if(!localDemoAllowed(request))return Response.json({error:'Local development preview only'},{status:403});
  if(request.headers.get('content-type')!=='application/json')return Response.json({error:'JSON required'},{status:415});
  let plan:ReturnType<typeof previewSpeech>;
  try{
   const data=await readBoundedJson(request,512) as Record<string,unknown>;
   if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!['id','variant','speed','expressiveEnabled'].includes(k))||typeof data.id!=='string'||typeof data.variant!=='string'||![0.9,1].includes(Number(data.speed))||typeof data.speed!=='number'||typeof data.expressiveEnabled!=='boolean'||data.variant==='expressive'&&!data.expressiveEnabled)throw new InputError('Invalid preview selection');
   plan=previewSpeech(data.id,data.variant as PreviewVariant,data.speed as 0.9|1);
  }catch(e){return Response.json({error:'Invalid fixed preview selection'},{status:e instanceof InputError?e.status:400});}
  const key=getKey()?.trim();if(!key)return Response.json({error:'Existing Gnani configuration unavailable'},{status:503});
  if(Date.now()-windowStart>60000){windowStart=Date.now();count=0;}
  if(busy||count>=12)return Response.json({error:'Wait for the current preview or rate window to finish'},{status:429});
  busy=true;count++;
  const controller=new AbortController(),signal=AbortSignal.any([controller.signal,request.signal]);
  const iterator=createProviders({apiKey:key,evonUrl:'http://127.0.0.1:8080',voice:plan.voice,ttsModel:plan.model,speechSpeed:plan.speed},transport,signal).speakStream(plan.text)[Symbol.asyncIterator]();
  const began=performance.now();
  const release=()=>{busy=false;};
  try{
   const first=await iterator.next();signal.throwIfAborted();if(first.done)throw Error('No audio');
   let initial:Uint8Array|undefined=first.value;
   const body=new ReadableStream<Uint8Array>({
    async pull(output){try{signal.throwIfAborted();if(initial){output.enqueue(initial);initial=undefined;return;}const next=await iterator.next();signal.throwIfAborted();if(next.done){output.close();release();}else output.enqueue(next.value);}catch{controller.abort();try{await iterator.return?.();}finally{release();output.error(new Error('Preview interrupted'));}}},
    async cancel(){controller.abort();try{await iterator.return?.();}finally{release();}}
   });
   return new Response(body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Audio-Sample-Rate':'16000','X-Saathi-Preview-Model':plan.model,'X-Saathi-Preview-Voice':plan.voice,'X-Saathi-First-Audio-Ms':String(Math.round(performance.now()-began))}});
  }catch(e){controller.abort();await iterator.return?.().catch(()=>{});release();return Response.json({error:'Voice preview unavailable',providerStatus:e instanceof ProviderError?e.status:undefined},{status:502});}
 };
}

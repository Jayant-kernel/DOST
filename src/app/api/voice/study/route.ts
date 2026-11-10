import {readFile} from 'node:fs/promises';import {join} from 'node:path';
import {localDemoAllowed} from '@/lib/local-demo';
import {readBoundedJson} from '@/lib/bounded-json';
import {newStudy,publicStudy,studyExport,type StudySession} from '@/lib/gnani/voice-study';
export const runtime='nodejs';export const dynamic='force-dynamic';
const sessions=new Map<string,StudySession>();
const headers={'Cache-Control':'no-store'};
function allowed(request:Request){return localDemoAllowed(request);}
function session(request:Request){const id=/(?:^|;\s*)saathi_study=([a-f0-9]{40})(?:;|$)/u.exec(request.headers.get('cookie')??'')?.[1];const s=id?sessions.get(id):undefined;if(s&&s.expires<=Date.now()){sessions.delete(s.id);return;}return s;}
export async function POST(request:Request){
 if(!allowed(request))return Response.json({error:'Local development study only'},{status:403});
 try{
  const body=await readBoundedJson(request,20000) as Record<string,unknown>;
  if(body?.action==='start'){
   for(const [id,s] of sessions)if(s.expires<=Date.now())sessions.delete(id);
   const technicalOnly=body.mode==='technical-check';
   if(!technicalOnly&&(body.mode!=='listener'||body.consented!==true||body.hindiComfortable!==true||body.adult!==true))return Response.json({error:'Adult eligibility, Hindi comfort and informed consent are required'},{status:400});
   if(sessions.size>=20)return Response.json({error:'Study capacity reached; retry later'},{status:429});
   const s=newStudy(technicalOnly,body.ageBand==='under60'||body.ageBand==='60plus'?body.ageBand:'not-stated');
   // Preflight every saved file before a listener starts. Never synthesize here.
   for(const c of s.clips)await readFile(join(process.cwd(),'fixtures','voice','audio',`${c.scenario}-${c.variant}.wav`));
   const old=session(request);if(old)sessions.delete(old.id);sessions.set(s.id,s);
   return Response.json(publicStudy(s),{headers:{...headers,'Set-Cookie':`saathi_study=${s.id}; HttpOnly; SameSite=Strict; Path=/api/voice/study; Max-Age=5400`}});
  }
  const s=session(request);if(!s)return Response.json({error:'Study expired; start again. No responses were saved.'},{status:401});
  if(body?.action==='withdraw'){sessions.delete(s.id);return Response.json({withdrawn:true},{headers:{...headers,'Set-Cookie':'saathi_study=; HttpOnly; SameSite=Strict; Path=/api/voice/study; Max-Age=0'}});}
  if(body?.action!=='export')return Response.json({error:'Invalid study action'},{status:400});
  const result=studyExport(s,body.submission);s.exported=true;
  return Response.json(result,{headers});
 }catch{return Response.json({error:'Cannot start or complete study. Check saved audio and complete every rating without duplicate entries.'},{status:400,headers});}
}
export async function GET(request:Request){
 if(!allowed(request))return Response.json({error:'Local development study only'},{status:403});
 const s=session(request);if(!s)return Response.json({error:'Study expired'},{status:401,headers});
 const token=new URL(request.url).searchParams.get('clip');const clip=s.clips.find(c=>c.token===token);
 if(!clip)return Response.json({error:'Unknown recording'},{status:404,headers});
 try{const bytes=await readFile(join(process.cwd(),'fixtures','voice','audio',`${clip.scenario}-${clip.variant}.wav`));s.served.add(clip.token);return new Response(bytes,{headers:{...headers,'Content-Type':'audio/wav'}});}catch{return Response.json({error:'Saved recording unavailable'},{status:404,headers});}
}

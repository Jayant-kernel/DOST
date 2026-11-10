import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {localDemoAllowed} from '@/lib/local-demo';
import {voicePreviewService} from '@/lib/gnani/voice-preview-service';
import {voiceSamples,previewVariants} from '@/lib/gnani/voice-preview';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const POST=voicePreviewService(()=>process.env.GNANI_API_KEY);
export async function GET(request:Request){
 if(!localDemoAllowed(request))return Response.json({error:'Local development preview only'},{status:403});
 const url=new URL(request.url),id=url.searchParams.get('sample'),variant=url.searchParams.get('variant');
 const directory=join(process.cwd(),'fixtures','voice');
 if(!id&&!variant){try{return new Response(await readFile(join(directory,'results.json')),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}catch{return Response.json({complete:false,rows:[]});}}
 if(!voiceSamples.some(s=>s.id===id)||!previewVariants.some(v=>v===variant))return Response.json({error:'Unknown sample'},{status:400});
 try{return new Response(await readFile(join(directory,'audio',`${id}-${variant}.wav`)),{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store'}});}catch{return Response.json({error:'Preview not generated yet'},{status:404});}
}

import {readBoundedJson,InputError} from '@/lib/bounded-json';
import {StorageError} from '@/lib/shop/store';
import {NextResponse} from 'next/server';import {randomBytes,createHash} from 'node:crypto';
import {localDemoAllowed,profileId,ownerId} from '@/lib/local-demo';import {profiles} from '@/lib/profiles';
import {confirmPreferences} from '@/lib/gnani/companion';import {voiceSessions} from '@/lib/gnani/sessions';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!localDemoAllowed(request))return NextResponse.json({error:'Local demo only'},{status:403});
 const id=profileId(request);if(!id)return NextResponse.json({error:'No local profile'},{status:401});
 try{return NextResponse.json({preferences:(await profiles.read(id)).preferences},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Local storage unavailable; try again'},{status:503});}
}
export async function POST(request:Request){
 if(!localDemoAllowed(request))return NextResponse.json({error:'Local demo only'},{status:403});
 const id=profileId(request);
 if(new URL(request.url).searchParams.has('start')){
  if(id)return NextResponse.json({ready:true});
  const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
  try{await profiles.update(hash,p=>p);}catch{return NextResponse.json({error:'Local storage unavailable; try again'},{status:503});}
  const response=NextResponse.json({ready:true});response.cookies.set('saathi_profile',token,{httpOnly:true,sameSite:'strict',path:'/api',maxAge:2592000});return response;
 }
 if(!id)return NextResponse.json({error:'No local profile'},{status:401});
try{const input=await readBoundedJson(request);const profile=await profiles.update(id,p=>confirmPreferences(p,input));
  // New confirmed context applies to a fresh session, never stale cached history.
  for(const [key,s]of voiceSessions)if(s.profileId===id)voiceSessions.delete(key);
  return NextResponse.json({preferences:profile.preferences});
 }catch(error){if(error instanceof StorageError)return NextResponse.json({error:'Local storage unavailable; try again'},{status:503});if(error instanceof InputError)return NextResponse.json({error:error.message},{status:error.status});return NextResponse.json({error:'Explicit confirmation and valid preferences required'},{status:400});}
}
export async function DELETE(request:Request){
 if(!localDemoAllowed(request))return NextResponse.json({error:'Local demo only'},{status:403});
 const id=profileId(request);if(id){try{await profiles.forget(id);}catch{return NextResponse.json({error:'Local storage unavailable; try again'},{status:503});}for(const[key,s]of voiceSessions)if(s.profileId===id)voiceSessions.delete(key);}
 const response=new NextResponse(null,{status:204});response.cookies.set('saathi_person','',{path:'/api',maxAge:0});if(id===ownerId(request))response.cookies.set('saathi_profile','',{path:'/api',maxAge:0});return response;
}

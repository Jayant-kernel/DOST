import {NextResponse} from 'next/server';
import {createProviders} from '@/lib/gnani/providers';
import {activeBehaviourPolicy,isBehaviourPolicy,type BehaviourPolicy} from '@/lib/gnani/companion';
export const runtime='nodejs';export const dynamic='force-dynamic';
let preparing=false;

export async function POST(request:Request){
 const host=request.headers.get('host')??'';
 if(process.env.NODE_ENV==='production'||!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||request.headers.get('origin')!==`http://${host}`)return NextResponse.json({error:'Local same-origin demo only'},{status:403});
 const selected=new URL(request.url).searchParams.get('policy');
 if(selected!==null&&!isBehaviourPolicy(selected))return NextResponse.json({error:'Invalid policy'},{status:400});
 const policy=(selected??activeBehaviourPolicy) as BehaviourPolicy;
 if(preparing)return NextResponse.json({error:'Saathi is already getting ready. Please try again shortly.'},{status:409});
 preparing=true;
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(60000)]);
 try{
  // Startup preparation uses no person's identity, conversation, speech key or
  // fake question. It is separate from the unchanged 20-second reply deadline.
  await createProviders({apiKey:'unused',voice:policy==='persona_v2'?'Shivani':'Yashraj',evonUrl:process.env.EVON_BASE_URL||'http://127.0.0.1:8080',tokenizerUrl:'http://127.0.0.1:8081',behaviourPolicy:policy},fetch,signal).prepareReasoning();
  return NextResponse.json({ready:true,qualified:false},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Saathi is not ready yet. Check local services and try again.'},{status:503,headers:{'Cache-Control':'no-store'}});}
 finally{preparing=false;}
}

import {NextResponse} from 'next/server';
import {localDemoAllowed} from '@/lib/local-demo';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!localDemoAllowed(request))return NextResponse.json({error:'Local demo only'},{status:403});
 const [reasoning,tokenizer]=await Promise.all([
  fetch('http://127.0.0.1:8080/health',{signal:AbortSignal.timeout(1500),cache:'no-store'}).then(r=>r.ok?'ready':r.status===503?'loading':'offline').catch(()=>'offline'),
  fetch('http://127.0.0.1:8081/tokenize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'नमस्ते'}),signal:AbortSignal.timeout(1500),cache:'no-store'}).then(r=>r.ok?'ready':'offline').catch(()=>'offline')
 ]);
 return NextResponse.json({reasoning,tokenizer,qualified:false},{headers:{'Cache-Control':'no-store'}});
}

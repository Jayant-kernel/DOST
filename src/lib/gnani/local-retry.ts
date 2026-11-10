// Only for local, effect-free inference. Never wrap speech billing or cart tools.
export async function localRetry(operation:()=>Promise<Response>,signal?:AbortSignal){
 signal?.throwIfAborted();const first=await operation();
 if(![502,503,504].includes(first.status))return first;
 await first.body?.cancel();signal?.throwIfAborted();
 await new Promise<void>((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},150);
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 });signal?.throwIfAborted();return operation();
}

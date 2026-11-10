// Replay the same recording once for an explicit transient recognition failure.
// Never used for TTS, auth/credit errors, or a successful empty transcript.
export async function transcriptionRetry(send:()=>Promise<Response>,signal:AbortSignal){
 signal.throwIfAborted();const first=await send();
 if(![429,502,503,504].includes(first.status))return first;
 const header=first.headers.get('Retry-After');
 const seconds=header===null?0.2:/^\d+(?:\.\d+)?$/.test(header)?Number(header):Math.max(0,(Date.parse(header)-Date.now())/1000);
 // A longer server cooldown should be shown, never shortened or bypassed.
 if(!Number.isFinite(seconds)||seconds>1)return first;
 await first.body?.cancel();signal.throwIfAborted();
 await new Promise<void>((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},Math.max(150,seconds*1000));
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
 });
 signal.throwIfAborted();return send();
}

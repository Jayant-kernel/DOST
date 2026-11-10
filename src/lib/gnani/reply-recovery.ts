import {ProviderError,type ReplyFailureDetail} from './providers.ts';
import type {ReplyRejectionRule} from './reply-quality.ts';
export type RecoveredReply={reply:string;recovery:boolean;end:boolean;engaged?:boolean;failure?:'timeout'|'quality'|'unavailable';detail?:ReplyFailureDetail;rule?:ReplyRejectionRule};
// Tara never speaks an apology: when the model fails she carries on with a vetted
// line (a different topic or "what are you doing right now") as a normal reply.
export type EngagingFallback={reply:string;listening:string};
export const taraEngagingFallbacks:readonly string[]=['अच्छा, चलिए कुछ और बात करते हैं। आप अभी क्या कर रहे हैं?','एक बात बताइए, अभी आप क्या कर रहे हैं?','चलिए, थोड़ी हल्की बात करते हैं। आज आपका किस बारे में बात करने का मन है?'];
export const taraListeningFallback='जी, मैं यहीं हूँ और सुन रही हूँ। आप आराम से बताइए।';

// No retry and no invalid text is spoken. Model failure is not failed hearing:
// keep the session available without repeatedly asking the person to rephrase.
export async function recoverReply(run:(signal:AbortSignal)=>Promise<string>,signal:AbortSignal,failures=0,timeoutMs=20000,listenOnly=false,engaging?:EngagingFallback):Promise<RecoveredReply>{
 signal.throwIfAborted();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('Reasoning deadline','TimeoutError')),timeoutMs);
 const combined=AbortSignal.any([signal,controller.signal]);
 let abort:()=>void=()=>{};
 const cancelled=new Promise<never>((_,reject)=>{abort=()=>reject(combined.reason);combined.addEventListener('abort',abort,{once:true});if(combined.aborted)abort();});
 try{const reply=await Promise.race([run(combined),cancelled]);signal.throwIfAborted();return {reply,recovery:false,end:false};}
 catch(error){
  signal.throwIfAborted();
  if(!controller.signal.aborted&&!(error instanceof ProviderError&&/^(?:Evon|Tokenizer)/.test(error.message)))throw error;
  const reply=listenOnly?'अभी जवाब बनाने में दिक्कत हो रही है। आप आराम से अपनी बात जारी रखिए।':failures>=1?'अभी भी जवाब बनाने में दिक्कत हो रही है। आप चाहें तो अपनी बात जारी रख सकते हैं।':controller.signal.aborted?'जवाब तैयार करने में देर हो रही है। आपको अपनी बात दोहराने की ज़रूरत नहीं है।':'आपकी बात मिली, लेकिन अभी जवाब बनाने में दिक्कत हुई। आपको दोहराने की ज़रूरत नहीं है।';
  const failure=controller.signal.aborted?'timeout':error instanceof ProviderError&&error.message==='Evon response quality service unavailable'?'quality':'unavailable';
  if(engaging)return {reply:listenOnly?engaging.listening:engaging.reply,recovery:false,end:false,engaged:true,failure,...(failure==='quality'&&error instanceof ProviderError&&error.detail?{detail:error.detail}:{}),...(failure==='quality'&&error instanceof ProviderError&&error.rule?{rule:error.rule}:{})};
  return {reply,recovery:true,end:false,failure,...(failure==='quality'&&error instanceof ProviderError&&error.detail?{detail:error.detail}:{}),...(failure==='quality'&&error instanceof ProviderError&&error.rule?{rule:error.rule}:{})};
 }finally{clearTimeout(timer);combined.removeEventListener('abort',abort);}
}

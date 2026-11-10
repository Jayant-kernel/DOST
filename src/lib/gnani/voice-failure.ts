import {NoSpeechError,ProviderError} from './providers.ts';

// Only fixed public messages cross the API boundary; never upstream bodies.
export function voiceFailure(error:unknown){
 if(error instanceof NoSpeechError)return {status:422,code:'speech_not_detected',error:'No clear speech was detected. Please speak again, a little closer to the microphone.'};
 if(error instanceof ProviderError){
  if(error.stage==='Prisma'){
   if([401,403].includes(error.status))return {status:503,code:'transcription_access',error:'Speech recognition access was rejected. Check the server’s Gnani credentials.'};
   if([402,429].includes(error.status))return {status:503,code:'transcription_limit',error:'Speech recognition has reached a service limit. Please wait before trying again.'};
   return {status:502,code:'transcription_unavailable',error:'Speech recognition is unavailable. Please try again shortly.'};
  }
  if(error.stage.startsWith('Timbre'))return {status:502,code:'speech_unavailable',error:'The voice service is unavailable. Please try again shortly.'};
  if(error.stage==='Evon response quality')return {status:502,code:'reply_unclear',error:'Saathi could not form a clear reply. Please try again.'};
 }
 return {status:502,code:'reply_unavailable',error:'Reply unavailable. Please try again.'};
}

type CaptureOptions={sessionReady:boolean;isCurrent:()=>boolean;onReady:()=>void;signal:AbortSignal;transport?:typeof fetch;getMedia?:()=>Promise<MediaStream>;identify?:boolean;onWelcome?:()=>Promise<void>;timeZone?:string;adaptive?:boolean;gentle?:boolean;policy?:'legacy'|'full'|'persona_v2';prepareReasoning?:boolean;onPreparing?:()=>void};
export async function startCapture(options:CaptureOptions){
 const check=()=>{options.signal.throwIfAborted();if(!options.isCurrent())throw new DOMException('Capture cancelled','AbortError');};
 check();
 if(!options.sessionReady){
  if(options.prepareReasoning){
   options.onPreparing?.();
   const prepared=await(options.transport??fetch)('/api/voice/prepare'+(options.policy?'?policy='+options.policy:''),{method:'POST',signal:options.signal});
   check();if(!prepared.ok)throw Error(prepared.status===409?'Saathi is already preparing the model. Please wait, then check the connection.':'The local reasoning service could not prepare a conversation. Check the Evon startup terminal; refreshing this page will not restart it.');
  }
  const response=await(options.transport??fetch)('/api/voice?start=1'+(options.identify?'&identify=1':'')+(options.timeZone?'&timeZone='+encodeURIComponent(options.timeZone):'')+(options.adaptive===false?'&adaptive=0':'')+(options.gentle?'&gentle=1':'')+(options.policy?'&policy='+options.policy:''),{method:'POST',signal:options.signal});
  check();if(!response.ok)throw Error('Microphone connection failed. Please try again.');options.onReady();await options.onWelcome?.();check();
 }
 check();const media=await(options.getMedia??(()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})))();
 try{check();return media;}catch(error){media.getTracks().forEach(track=>track.stop());throw error;}
}

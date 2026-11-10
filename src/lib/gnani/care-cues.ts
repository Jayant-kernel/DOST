// Turn-local style hints, never a diagnosis or a stored psychological profile.
export type CareTone='supportive'|'positive'|'calm';
export function feelingCue(text:string,allowQuestion=true,previousReplies:string[]=[]):{tone:CareTone;reply?:string}|undefined{
 const clean=text.normalize('NFKC').trim().replace(/[।.!]+$/u,'').trim();
 if(/["“”«»?]/u.test(clean)||/मतलब|अनुवाद|कहानी|उदाहरण|\b(?:translate|meaning|quote|example)\b/iu.test(clean))return;
 const ask=(question:string)=>allowQuestion&&!previousReplies.some(reply=>reply.includes(question));
 const question=ask('क्या बात मन पर है?')?' चाहें तो बताएँ, क्या बात मन पर है?':' आप चाहें तो अपनी बात कह सकते हैं।';
 if(/^(?:(?:आज|अभी) )?(?:(?:मैं|मन) (?:बहुत |थोड़ा |काफ़ी )?(?:उदास|परेशान|अकेला|अकेली)(?: महसूस कर (?:रहा|रही))? (?:हूँ|हूं|है)|मुझे (?:बहुत |थोड़ा )?(?:डर|अकेलापन) (?:लग रहा है|महसूस हो रहा है))$/u.test(clean))return {tone:'supportive',reply:'जी, आपकी बात सुन रहा हूँ।'+question};
 if(/^(?:(?:आज|अभी) )?(?:मुझे (?:बहुत )?गुस्सा आ रहा है|मैं (?:बहुत )?गुस्से में (?:हूँ|हूं))$/u.test(clean))return {tone:'calm',reply:'जी, आराम से बात कर सकते हैं।'+question};
 if(/^(?:(?:आज|अभी) )?मैं (?:बहुत |काफ़ी )?खुश (?:हूँ|हूं)$/u.test(clean))return {tone:'positive',reply:'यह सुनकर अच्छा लगा जी।'+(ask('आज किस बात से खुशी मिली?')?' आज किस बात से खुशी मिली?':'')};
 // Mixed stories/questions still need reasoning; only explicit self-report can
 // add a cautious style hint. Negations and third-person reports do not qualify.
 if(/(?:मैं उदास हूँ|मुझे डर लग रहा है|मैं परेशान हूँ)[,।]/u.test(clean)&&!/(?:नहीं|नही|कहा|बोला|कहती|कहते)/u.test(clean))return {tone:'supportive'};
}

export type VocalFeatures={pitchHz:number;rms:number;variation:number;voicedFrames:number};
export type VocalBaseline={pitchHz:number;rms:number;turns:number};
// Only browser PCM16 mono/16k WAV is analyzed. At most 40 evenly spaced 40ms
// frames, downsampled to 4kHz. Unsupported/noisy audio simply has no cue.
export function vocalFeatures(bytes:Uint8Array):VocalFeatures|undefined{
 if(bytes.byteLength<44||bytes.byteLength>1000000)return;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const tag=(offset:number)=>String.fromCharCode(...bytes.subarray(offset,offset+4));
 if(tag(0)!=='RIFF'||tag(8)!=='WAVE')return;
 let format=false,data=0,length=0;
 for(let offset=12;offset+8<=bytes.length;){
  const size=view.getUint32(offset+4,true),next=offset+8+size;
  if(next>bytes.length)return;
  if(tag(offset)==='fmt '&&size>=16)format=view.getUint16(offset+8,true)===1&&view.getUint16(offset+10,true)===1&&view.getUint32(offset+12,true)===16000&&view.getUint16(offset+22,true)===16;
  if(tag(offset)==='data'){data=offset+8;length=size;}
  offset=next+(size%2);
 }
 if(!format||length<6400||length%2)return;
 const samples=length/2,frames=Math.min(40,Math.floor(samples/640)),pitches:number[]=[],levels:number[]=[];
 let clipped=0,observed=0;
 for(let frame=0;frame<frames;frame++){
  const start=Math.floor(frame*(samples-640)/Math.max(1,frames-1)),x=new Float64Array(160);
  let mean=0;
  for(let i=0;i<160;i++){x[i]=view.getInt16(data+2*(start+4*i),true)/32768;mean+=x[i];if(Math.abs(x[i])>.98)clipped++;observed++;}
  mean/=160;let energy=0;for(let i=0;i<160;i++){x[i]-=mean;energy+=x[i]*x[i];}
  const rms=Math.sqrt(energy/160);if(rms<.012||rms>.7)continue;
  let best=0,lag=0;
  for(let d=10;d<=66;d++){
   let cross=0,a=0,b=0;for(let i=0;i<160-d;i++){cross+=x[i]*x[i+d];a+=x[i]*x[i];b+=x[i+d]*x[i+d];}
   const score=cross/Math.sqrt(a*b||1);if(score>best){best=score;lag=d;}
  }
  if(best>.8&&lag){pitches.push(4000/lag);levels.push(rms);}
 }
 if(pitches.length<6||clipped/observed>.01)return;
 const pitchHz=pitches.reduce((a,b)=>a+b,0)/pitches.length,rms=levels.reduce((a,b)=>a+b,0)/levels.length;
 return {pitchHz,rms,variation:Math.sqrt(pitches.reduce((s,p)=>s+(p-pitchHz)**2,0)/pitches.length)/pitchHz,voicedFrames:pitches.length};
}
export function relativeVoiceCue(features:VocalFeatures|undefined,previous?:VocalBaseline){
 if(!features)return {baseline:previous,changed:false};
 const changed=Boolean(previous&&previous.turns>=2&&features.rms>previous.rms*1.7&&Math.abs(Math.log(features.pitchHz/previous.pitchHz))>.2);
 const n=Math.min(previous?.turns??0,4),baseline={pitchHz:((previous?.pitchHz??0)*n+features.pitchHz)/(n+1),rms:((previous?.rms??0)*n+features.rms)/(n+1),turns:n+1};
 return {baseline,changed};
}

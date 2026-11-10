import {PcmFrames,pcmWav} from '../lib/gnani/pcm.ts';
export class StreamingSpeech{
 private context=new AudioContext();private next=0;private stopped=false;private frames=new PcmFrames();private cancelPlayback:(()=>void)|undefined;private stopMeter:(()=>void)|undefined;
 constructor(){void this.context.resume();}
 stop(){this.stopped=true;this.stopMeter?.();this.cancelPlayback?.();void this.context.close().catch(()=>{});}
 async play(response:Response,signal:AbortSignal,onAudio:()=>void,onLevel?:(level:number)=>void){
 const reader=response.body?.getReader();if(!reader)throw Error('Missing audio');const chunks:Uint8Array[]=[];let total=0,active=0,drained=false,ended:(()=>void)|undefined;
 const playback=new Promise<void>((resolve,reject)=>{ended=resolve;this.cancelPlayback=()=>reject(new DOMException('Playback stopped','AbortError'));});void playback.catch(()=>{});
 const analyser=onLevel?this.context.createAnalyser():undefined;
 if(analyser){analyser.fftSize=512;analyser.connect(this.context.destination);const samples=new Float32Array(analyser.fftSize);const meter=setInterval(()=>{analyser.getFloatTimeDomainData(samples);onLevel?.(Math.min(1,Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length)*6));},50);this.stopMeter=()=>{clearInterval(meter);analyser.disconnect();onLevel?.(0);};}
 const abort=()=>{this.stop();void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;if(this.stopped)throw Error('Playback stopped');total+=value.length;if(total>2000000)throw Error('Audio too large');chunks.push(value);
 const samples=this.frames.push(value);if(samples.length){const buffer=this.context.createBuffer(1,samples.length,16000);buffer.copyToChannel(samples,0);const source=this.context.createBufferSource();source.buffer=buffer;source.connect(analyser??this.context.destination);active++;source.onended=()=>{if(--active===0&&drained)ended?.();};this.next=Math.max(this.next,this.context.currentTime+0.05);source.start(this.next);this.next+=buffer.duration;onAudio();}}
 signal.throwIfAborted();this.frames.finish();const bytes=new Uint8Array(total);let n=0;for(const chunk of chunks){bytes.set(chunk,n);n+=chunk.length;}drained=true;if(active>0)await playback;signal.throwIfAborted();return pcmWav(bytes);
 }catch(error){this.stop();throw error;}finally{this.stopMeter?.();this.stopMeter=undefined;this.cancelPlayback=undefined;signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
}

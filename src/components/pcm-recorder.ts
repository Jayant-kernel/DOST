import {pcmWav} from '../lib/gnani/pcm.ts';

// Capture PCM directly: no browser-dependent WebM/Opus decoding step.
export class PcmRecorder {
 state:'inactive'|'recording'='inactive';
 onstop:(()=>void)|null=null;
 private chunks:Uint8Array[]=[];
 private length=0;
 private failure:Error|undefined;
 private context:AudioContext;
 private input:MediaStreamAudioSourceNode;
 private node:AudioWorkletNode;
 private constructor(context:AudioContext,input:MediaStreamAudioSourceNode,node:AudioWorkletNode){
  this.context=context;this.input=input;this.node=node;
  node.port.onmessage=event=>{
   if(this.state!=='recording')return;
   if(!(event.data instanceof ArrayBuffer)||event.data.byteLength!==1024){this.failure=Error('Microphone recording failed. Please start again.');this.stop();return;}
   if(this.length+event.data.byteLength>800000){this.stop();return;}
   this.chunks.push(new Uint8Array(event.data));this.length+=event.data.byteLength;
  };
  node.onprocessorerror=()=>{this.failure=Error('Microphone recording failed. Please start again.');this.stop();};
 }
 static async create(media:MediaStream,signal:AbortSignal){
  signal.throwIfAborted();const context=new AudioContext({sampleRate:16000});
  try{
   if(context.sampleRate!==16000)throw Error('This browser cannot record at the required sample rate. Please use Chrome.');
   await context.resume();await context.audioWorklet.addModule('/pcm-capture.js');signal.throwIfAborted();
   const input=context.createMediaStreamSource(media),node=new AudioWorkletNode(context,'pcm-capture');
   return new PcmRecorder(context,input,node);
  }catch(error){await context.close().catch(()=>{});throw error;}
 }
 start(){this.state='recording';this.input.connect(this.node);this.node.connect(this.context.destination);}
 stop(){
  if(this.state!=='recording')return;this.state='inactive';this.dispose();this.onstop?.();
 }
 dispose(){this.node.port.onmessage=null;this.node.onprocessorerror=null;this.node.disconnect();this.input.disconnect();void this.context.close().catch(()=>{});}
 wav():ArrayBuffer{
  if(this.failure)throw this.failure;
  if(!this.length)throw Error('No microphone audio was recorded. Check your microphone and speak for a moment, then try again.');
  const bytes=new Uint8Array(this.length);let offset=0;
  for(const chunk of this.chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return pcmWav(bytes).buffer as ArrayBuffer;
 }
}

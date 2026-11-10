// Runs on the audio rendering thread: exactly 512 mono PCM16 samples per frame.
class PcmCapture extends AudioWorkletProcessor {
 constructor(){super();this.frame=new ArrayBuffer(1024);this.view=new DataView(this.frame);this.offset=0;}
 process(inputs){
  for(const sample of inputs[0]?.[0]??[]){const value=Math.max(-1,Math.min(1,sample));this.view.setInt16(this.offset*2,value*(value<0?32768:32767),true);
   if(++this.offset===512){this.port.postMessage(this.frame,[this.frame]);this.frame=new ArrayBuffer(1024);this.view=new DataView(this.frame);this.offset=0;}}
  return true;
 }
}
registerProcessor('pcm-capture',PcmCapture);

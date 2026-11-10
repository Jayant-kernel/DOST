import {pcmWav} from '@/lib/gnani/pcm';
export async function recordedWav(recording:Blob){
 const context=new AudioContext();
 try{
  const decoded=await context.decodeAudioData(await recording.arrayBuffer());
  const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const samples=(await offline.startRendering()).getChannelData(0),bytes=new Uint8Array(samples.length*2),view=new DataView(bytes.buffer);
  samples.forEach((sample,i)=>{const value=Math.max(-1,Math.min(1,sample));view.setInt16(i*2,value*(value<0?32768:32767),true);});
  return pcmWav(bytes).buffer as ArrayBuffer;
 }finally{await context.close();}
}

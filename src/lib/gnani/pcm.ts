// Raw little-endian PCM framing is independent of transport chunk boundaries.
export function pcmWav(bytes:Uint8Array){
 if(!bytes.length||bytes.length%2)throw Error('Incomplete audio');
 const wav=new Uint8Array(44+bytes.length),v=new DataView(wav.buffer);
 const word=(n:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(n+i,s.charCodeAt(i));};
 word(0,'RIFF');v.setUint32(4,wav.length-8,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,bytes.length,true);wav.set(bytes,44);return wav;
}
export class PcmFrames{
 private odd:number|undefined;
 push(input:Uint8Array){const bytes=new Uint8Array(input.length+(this.odd===undefined?0:1));let offset=0;if(this.odd!==undefined)bytes[offset++]=this.odd;bytes.set(input,offset);this.odd=bytes.length%2?bytes[bytes.length-1]:undefined;
 const samples=new Float32Array(Math.floor(bytes.length/2));const view=new DataView(bytes.buffer);for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;return samples;}
 finish(){if(this.odd!==undefined)throw Error('Incomplete audio');}
}

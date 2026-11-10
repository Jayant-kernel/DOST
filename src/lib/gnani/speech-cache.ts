type Entry={expires:number;chunks:Uint8Array[]};
// Only application-owned public controls may opt in. Never cache names, memories
// or generated answers. Voice/model are part of the key; entries live in RAM only.
export class PublicSpeechCache{
 private entries=new Map<string,Entry>();
 private now:()=>number;
 constructor(now=()=>Date.now()){this.now=now;}
 async *stream(text:string,voice:string,model:string,isPublic:boolean,generate:()=>AsyncIterable<Uint8Array>,signal:AbortSignal){
  signal.throwIfAborted();const key=JSON.stringify([voice,model,text]);
  for(const [id,entry] of this.entries)if(entry.expires<=this.now())this.entries.delete(id);
  const hit=isPublic?this.entries.get(key):undefined;
  if(hit){for(const chunk of hit.chunks){signal.throwIfAborted();yield chunk.slice();}return;}
  const chunks:Uint8Array[]=[];let total=0;
  for await(const chunk of generate()){signal.throwIfAborted();total+=chunk.length;if(isPublic&&total<=512000)chunks.push(chunk.slice());yield chunk;}
  signal.throwIfAborted();
  if(isPublic&&total>0&&total<=512000){if(this.entries.size>=8)this.entries.delete(this.entries.keys().next().value!);this.entries.set(key,{expires:this.now()+15*60*1000,chunks});}
 }
}
export const publicSpeechCache=new PublicSpeechCache();

// Gnani SSE contract: https://docs.gnani.ai/api/TTS/tts-sse
export async function* timbreChunks(response:Response,signal?:AbortSignal):AsyncGenerator<Uint8Array>{
 const reader=response.body?.getReader();if(!reader)throw Error('Invalid speech stream');
 const decoder=new TextDecoder('utf-8',{fatal:true});let pending='',started=false,complete=false,last:number|undefined,total=0;
 const fail=()=>{throw Error('Invalid speech stream');};
 try{while(!complete){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;
 pending+=decoder.decode(value,{stream:true});if(pending.length>4000000)fail();
 // Normalize CRLF only once both characters have arrived.
 pending=pending.replace(/\r\n/g,'\n');let boundary:number;
 while((boundary=pending.indexOf('\n\n'))>=0){const frame=pending.slice(0,boundary);pending=pending.slice(boundary+2);
 let event='',data='';for(const line of frame.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data+=line.slice(5).trimStart()+'\n';}
 if(!event&&!data)continue;
 let payload;try{payload=JSON.parse(data);}catch{fail();}
 if(event==='start'){if(started)fail();started=true;continue;}
 if(!started)fail();
 if(event==='complete'){if(payload.is_final!==true||payload.audio!==''||total===0)fail();complete=true;break;}
 if(event!=='chunk'||!Number.isSafeInteger(payload.chunk_index)||payload.chunk_index<0||(last!==undefined&&payload.chunk_index!==last+1)||typeof payload.audio!=='string'||!payload.audio||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.audio))fail();
 last=payload.chunk_index;const bytes=Uint8Array.from(atob(payload.audio),(c:string)=>c.charCodeAt(0));total+=bytes.length;if(total>2000000)fail();signal?.throwIfAborted();yield bytes;
 }
 }if(!complete)fail();
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

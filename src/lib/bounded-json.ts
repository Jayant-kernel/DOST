export class InputError extends Error {
 status:number;
 constructor(message:string,status=400){super(message);this.status=status;}
}
export async function readBoundedBytes(request:Request,limit:number,cancellation:AbortSignal=request.signal,deadlineMs=20000):Promise<Uint8Array>{
 if(Number(request.headers.get('content-length'))>limit)throw new InputError('Request too large',413);
 const reader=request.body?.getReader();if(!reader)throw new InputError('Invalid JSON');
 const deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(),deadlineMs);
 const signal=AbortSignal.any([request.signal,cancellation,deadline.signal]);
 const abort=()=>{void reader.cancel().catch(()=>{});};
 signal.addEventListener('abort',abort,{once:true});
 const check=()=>{if(signal.aborted)throw new InputError(deadline.signal.aborted?'Upload timed out':'Upload cancelled',deadline.signal.aborted?408:499);};
 const chunks:Uint8Array[]=[];let size=0;
 try{if(signal.aborted)abort();check();while(true){const {done,value}=await reader.read();check();if(done)break;size+=value.byteLength;
 if(size>limit){await reader.cancel();throw new InputError('Request too large',413);}chunks.push(value);}
 }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return bytes;
}
export async function readBoundedJson(request:Request,limit=4096):Promise<unknown>{
 const bytes=await readBoundedBytes(request,limit);
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new InputError('Invalid JSON');}
}

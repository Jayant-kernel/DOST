// Assemble bounded deltas before validation/synthesis. Unfinished model text is
// never audible and cannot propose executable actions.
export async function evonStreamText(response:Response,signal?:AbortSignal,native=false){
 const reader=response.body?.getReader();if(!reader)throw Error('Invalid reasoning stream');
 const decoder=new TextDecoder('utf-8',{fatal:true});let pending='',text='',finished=false,done=false;
 try{while(!done){signal?.throwIfAborted();const item=await reader.read();if(item.done)break;pending+=decoder.decode(item.value,{stream:true});if(pending.length>64000)throw Error('Reasoning frame too large');pending=pending.replace(/\r\n/g,'\n');let boundary;
  while((boundary=pending.indexOf('\n\n'))>=0){const frame=pending.slice(0,boundary);pending=pending.slice(boundary+2);const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('\n');if(!data)continue;
   if(data==='[DONE]'){done=true;break;}
   const parsed=JSON.parse(data);
   if(native){if(typeof parsed.content==='string')text+=parsed.content;if(text.length>4000)throw Error('Answer too long');if(parsed.stop===true){if(parsed.truncated||!['eos','word'].includes(parsed.stop_type))throw Error('Incomplete answer');finished=true;done=true;break;}continue;}
   const choice=parsed.choices?.[0];if(!choice)continue;
   const delta=choice.delta?.content;if(delta!==undefined&&delta!==null){if(typeof delta!=='string'||finished)throw Error('Invalid delta');text+=delta;if(text.length>4000)throw Error('Answer too long');}
   if(choice.finish_reason){if(choice.finish_reason!=='stop')throw Error('Incomplete answer');finished=true;}
  }
 }
 signal?.throwIfAborted();if(!done||!finished||!text.trim()||/<\/?think>/.test(text))throw Error('Incomplete reasoning stream');return text.trim();
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

// Explicit synthetic-evaluation recorder. Never attached to the HTTP app.
export function recordingTransport(trace,transport=fetch){
 return async(url,init)=>{
  const endpoint=new URL(String(url)).pathname,body=JSON.parse(String(init?.body??'{}'));
  if(endpoint.endsWith('/apply-template'))trace.promptMessages=body.messages;
  const model=endpoint.endsWith('/completion')||endpoint.endsWith('/chat/completions');
  const start=performance.now();
  if(model){trace.modelInvoked=true;trace.modelCalls=(trace.modelCalls??0)+1;trace.settings={...body};delete trace.settings.prompt;delete trace.settings.messages;trace.promptTokens=Array.isArray(body.prompt)?body.prompt.length:undefined;}
  const response=await transport(url,init);
  if(endpoint.endsWith('/apply-template')){const data=await response.clone().json();trace.renderedPrompt=data.prompt;}
  if(!model)return response;
  trace.httpStatus=response.status;
  if(!body.stream){const data=await response.clone().json();trace.rawResponse=data.content??data.choices?.[0]?.message?.content??null;trace.stop=data.stop_type??data.choices?.[0]?.finish_reason;trace.timings=data.timings;trace.usage=data.usage;trace.modelLatencyMs=Math.round(performance.now()-start);return response;}
  let pending='';const decoder=new TextDecoder();trace.rawResponse='';
  const capture=new TransformStream({
   transform(chunk,controller){
    pending+=decoder.decode(chunk,{stream:true});pending=pending.replace(/\r\n/g,'\n');
    if(pending.length>64000)throw Error('Synthetic trace frame bound');
    let end;while((end=pending.indexOf('\n\n'))>=0){const frame=pending.slice(0,end);pending=pending.slice(end+2);const raw=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('\n');if(raw&&raw!=='[DONE]'){
     const data=JSON.parse(raw);trace.rawResponse+=(data.content??data.choices?.[0]?.delta?.content??'');
     if(trace.rawResponse.length>4000)throw Error('Synthetic trace text bound');
     if(data.stop||data.choices?.[0]?.finish_reason){trace.stop=data.stop_type??data.choices?.[0]?.finish_reason;trace.timings=data.timings;trace.usage=data.usage;}
    }}trace.modelLatencyMs=Math.round(performance.now()-start);controller.enqueue(chunk);
   },
   flush(){trace.modelLatencyMs=Math.round(performance.now()-start);}
  });
  return new Response(response.body?.pipeThrough(capture),{status:response.status,headers:response.headers});
 };
}

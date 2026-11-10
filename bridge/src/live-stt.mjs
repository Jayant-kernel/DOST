import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {verifyListenToken} from '../../src/lib/gnani/listen-token.mjs';

// Dedicated loopback-only microphone proxy. No telephony or model inference.
export function createLiveSttServer({secret,apiKey,origin,upstreamUrl='wss://api.vachana.ai/stt/v3/stream'}){
 if(!secret||secret.length<32||!apiKey||!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))throw Error('Live voice configuration unavailable');
 const server=createServer((_request,response)=>{response.writeHead(404);response.end();});
 const wss=new WebSocketServer({noServer:true,maxPayload:4096,handleProtocols:()=> 'saathi-v1'}),used=new Map();
 server.on('upgrade',(request,socket,head)=>{
  const protocols=String(request.headers['sec-websocket-protocol']??'').split(',').map(x=>x.trim());
  const grant=verifyListenToken(secret,protocols[1],request.headers.origin);
  for(const [key,expires] of used)if(expires<=Date.now())used.delete(key);
  if(request.url!=='/api/voice/live'||request.headers.origin!==origin||protocols[0]!=='saathi-v1'||!grant||used.has(grant.nonce)||used.size>=60||wss.clients.size>=2){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  used.set(grant.nonce,grant.expires);
  wss.handleUpgrade(request,socket,head,client=>wss.emit('connection',client));
 });
 wss.on('connection',client=>{
  const upstream=new WebSocket(upstreamUrl,{headers:{'x-api-key-id':apiKey,lang_code:'hi-IN','x-sample-rate':'16000','x-min-silence-ms':'1800','x-max-speech-s':'25'},maxPayload:64000,handshakeTimeout:8000});
  let ready=false,finishing=false,silenced=false,processing=0,frames=0,closed=false;
  const seen=new Set();let silenceTimer,drainTimer;
  const send=event=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(event));};
  const close=()=>{if(closed)return;closed=true;clearTimeout(lifetime);clearTimeout(handshake);clearTimeout(drainTimer);clearInterval(silenceTimer);upstream.terminate();if(client.readyState===WebSocket.OPEN)client.close();};
  const fail=()=>{send({type:'error',message:'Live transcription unavailable; start again.'});close();};
  const lifetime=setTimeout(fail,35000),handshake=setTimeout(fail,10000);
  const finish=()=>{if(finishing&&silenced&&processing===0){send({type:'finished'});close();}};
  upstream.on('message',raw=>{try{
   const event=JSON.parse(raw.toString());
   if(event.type==='connected'){ready=true;clearTimeout(handshake);send({type:'connected'});}
   else if(event.type==='processing'){processing++;send({type:'processing'});}
   else if(event.type==='transcript'){
    if(typeof event.segment_id!=='string'||!Number.isSafeInteger(event.segment_index)||event.segment_index<0||typeof event.text!=='string'||event.text.length>2000)throw Error();
    if(seen.has(event.segment_id))return;seen.add(event.segment_id);processing=Math.max(0,processing-1);
    send({type:'transcript',text:event.text,segment_id:event.segment_id,segment_index:event.segment_index});finish();
   }else if(event.type==='error')fail();
  }catch{fail();}});
  client.on('message',(raw,binary)=>{
   if(!ready||closed)return fail();
   if(binary){if(finishing||raw.length!==1024||++frames>800||upstream.bufferedAmount>32768)return fail();upstream.send(raw);return;}
   let event;try{event=JSON.parse(raw.toString());}catch{return fail();}
   if(event.type!=='finish'||finishing)return fail();finishing=true;
   let silence=0;silenceTimer=setInterval(()=>{
    if(upstream.readyState!==WebSocket.OPEN)return fail();upstream.send(Buffer.alloc(1024));
    if(++silence===70){clearInterval(silenceTimer);silenced=true;drainTimer=setTimeout(fail,8000);setTimeout(finish,500);}
   },32);
  });
  client.on('close',close);client.on('error',close);upstream.on('error',fail);upstream.on('close',()=>{if(!closed)fail();});
 });
 server.on('close',()=>{for(const socket of wss.clients)socket.terminate();wss.close();});
 return server;
}

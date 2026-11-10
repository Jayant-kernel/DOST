export class LiveTranscription{
 private socket:WebSocket|null=null;private context:AudioContext|null=null;private input:MediaStreamAudioSourceNode|null=null;private node:AudioWorkletNode|null=null;
 private finishResolve!:(text:string)=>void;private finishReject!:(error:Error)=>void;private result:Promise<string>;private finished=false;private cleanupAbort:(()=>void)|null=null;
 constructor(){this.result=new Promise((resolve,reject)=>{this.finishResolve=resolve;this.finishReject=reject;});void this.result.catch(()=>{});}
 stop(){this.finishReject(Error('Live microphone stopped'));this.disconnect();this.socket?.close();this.cleanupAbort?.();}
 private disconnect(){if(this.node)this.node.port.onmessage=null;this.node?.disconnect();this.input?.disconnect();if(this.context){void this.context.close().catch(()=>{});this.context=null;}}
 async start(media:MediaStream,signal:AbortSignal){
  signal.throwIfAborted();const abort=()=>this.stop();signal.addEventListener('abort',abort,{once:true});this.cleanupAbort=()=>signal.removeEventListener('abort',abort);
  try{
   const grant=await fetch('/api/voice?listen=1',{method:'POST',signal});if(!grant.ok)throw Error('Microphone connection failed. Please try again.');
   const {token}=await grant.json();signal.throwIfAborted();
   this.context=new AudioContext({sampleRate:16000});if(this.context.sampleRate!==16000)throw Error('Microphone connection failed. Please try again.');
   await this.context.resume();await this.context.audioWorklet.addModule('/pcm-capture.js');signal.throwIfAborted();
   const socket=new WebSocket('ws://127.0.0.1:3001/api/voice/live',['saathi-v1',token]);this.socket=socket;
   const segments=new Map<number,string>();
   await new Promise<void>((resolve,reject)=>{
    let connected=false;const timer=setTimeout(()=>reject(Error('Microphone connection failed. Please try again.')),10000);
    socket.onerror=()=>{clearTimeout(timer);const error=Error('Microphone connection failed. Please try again.');reject(error);this.finishReject(error);this.disconnect();};
    socket.onclose=()=>{clearTimeout(timer);if(!connected)reject(Error('Microphone connection failed. Please try again.'));if(!this.finished){this.finishReject(Error('Microphone connection failed. Please try again.'));this.disconnect();}};
    socket.onmessage=message=>{try{const event=JSON.parse(message.data);
     if(event.type==='connected'){connected=true;clearTimeout(timer);resolve();}
     else if(event.type==='transcript'){if(!Number.isSafeInteger(event.segment_index)||typeof event.text!=='string')throw Error();segments.set(event.segment_index,event.text);if([...segments.values()].join(' ').length>2000)throw Error();}
     else if(event.type==='finished'){this.finished=true;this.cleanupAbort?.();this.finishResolve([...segments].sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join(' ').trim());}
     else if(event.type==='error')throw Error();
    }catch{const error=Error('Microphone connection failed. Please try again.');clearTimeout(timer);reject(error);this.finishReject(error);this.disconnect();socket.close();}};
   });signal.throwIfAborted();
   this.input=this.context.createMediaStreamSource(media);this.node=new AudioWorkletNode(this.context,'pcm-capture');
   this.node.port.onmessage=event=>{if(socket.readyState!==WebSocket.OPEN||socket.bufferedAmount>32768){this.stop();return;}socket.send(event.data);};
   this.input.connect(this.node);this.node.connect(this.context.destination);
  }catch(error){this.stop();throw error;}
 }
 async finish(){this.disconnect();if(this.socket?.readyState!==WebSocket.OPEN)throw Error('Microphone connection failed. Please try again.');this.socket.send(JSON.stringify({type:'finish'}));return this.result;}
}

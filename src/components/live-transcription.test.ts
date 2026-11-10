import {test} from 'node:test';import assert from 'node:assert/strict';
import {LiveTranscription} from './live-transcription.ts';
test('finishing live capture disconnects PCM messages before sending finish',async()=>{
 const saved={fetch:globalThis.fetch,WebSocket:globalThis.WebSocket,AudioContext:globalThis.AudioContext,AudioWorkletNode:globalThis.AudioWorkletNode};
 const sent:unknown[]=[];let node: {port:{onmessage:((event:{data:ArrayBuffer})=>void)|null};disconnect:()=>void};
 class Socket{static OPEN=1;readyState=1;onmessage:((event:{data:string})=>void)|null=null;onclose:(()=>void)|null=null;
  constructor(){queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'connected'})}));}
  send(data:unknown){sent.push(data);if(typeof data==='string')this.onmessage?.({data:JSON.stringify({type:'finished'})});}close(){this.onclose?.();}
 }
 class Context{sampleRate=16000;destination={};audioWorklet={addModule:async()=>{}};async resume(){}async close(){}createMediaStreamSource(){return{connect(){},disconnect(){}};}}
 class Worklet{port={onmessage:null as ((event:{data:ArrayBuffer})=>void)|null};constructor(){node=this;}connect(){}disconnect(){}}
 try{
  globalThis.fetch=async()=>Response.json({token:'test-grant'});globalThis.WebSocket=Socket as unknown as typeof WebSocket;globalThis.AudioContext=Context as unknown as typeof AudioContext;globalThis.AudioWorkletNode=Worklet as unknown as typeof AudioWorkletNode;
  const live=new LiveTranscription();await live.start({} as MediaStream,new AbortController().signal);
  node!.port.onmessage?.({data:new ArrayBuffer(1024)});assert.equal(sent.length,1);
  assert.equal(await live.finish(),'');assert.equal(node!.port.onmessage,null);assert.equal(sent.length,2);
 }finally{Object.assign(globalThis,saved);}
});

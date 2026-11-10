import {test} from 'node:test';import assert from 'node:assert/strict';
import {PcmRecorder} from './pcm-recorder.ts';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('actual worklet frames microphone samples as little-endian PCM and clamps clipping',async()=>{
 let Processor:new()=>{process:(inputs:Float32Array[][])=>boolean};const frames:ArrayBuffer[]=[];
 class Base{port={postMessage:(frame:ArrayBuffer)=>frames.push(frame)};}
 runInNewContext(await readFile(new URL('../../public/pcm-capture.js',import.meta.url),'utf8'),{AudioWorkletProcessor:Base,registerProcessor:(name:string,implementation:typeof Processor)=>{assert.equal(name,'pcm-capture');Processor=implementation;}});
 const processor=new Processor!();const samples=new Float32Array(512);samples[0]=2;samples[1]=-2;samples[2]=0.5;
 assert.equal(processor.process([[samples.subarray(0,128)]]),true);assert.equal(frames.length,0);
 processor.process([[samples.subarray(128)]]);assert.equal(frames.length,1);
 const view=new DataView(frames[0]);assert.equal(view.byteLength,1024);assert.equal(view.getInt16(0,true),32767);assert.equal(view.getInt16(2,true),-32768);assert.equal(view.getInt16(4,true),16383);
});
test('direct microphone PCM produces a valid 16kHz WAV without decodeAudioData; Stop ignores late frames',async()=>{
 const saved={AudioContext:globalThis.AudioContext,AudioWorkletNode:globalThis.AudioWorkletNode};
 let node:{port:{onmessage:((e:{data:ArrayBuffer})=>void)|null};onprocessorerror:(()=>void)|null};let closed=0;
 class Context{sampleRate=16000;destination={};audioWorklet={addModule:async()=>{}};async resume(){}async close(){closed++;}createMediaStreamSource(){return {connect(){},disconnect(){}};}decodeAudioData(){throw Error('Must not decode compressed audio');}}
 class Worklet{port={onmessage:null as ((e:{data:ArrayBuffer})=>void)|null};onprocessorerror=null;constructor(){node=this;}connect(){}disconnect(){}}
 try{
  globalThis.AudioContext=Context as unknown as typeof AudioContext;globalThis.AudioWorkletNode=Worklet as unknown as typeof AudioWorkletNode;
  const recorder=await PcmRecorder.create({} as MediaStream,new AbortController().signal);recorder.start();
  const frame=new ArrayBuffer(1024);new DataView(frame).setInt16(0,1234,true);node!.port.onmessage!({data:frame});
  let stopped=0;recorder.onstop=()=>stopped++;recorder.stop();recorder.stop();assert.equal(stopped,1);assert.equal(node!.port.onmessage,null);assert.equal(closed,1);
  const wav=recorder.wav(),view=new DataView(wav);assert.equal(wav.byteLength,1068);assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint32(40,true),1024);assert.equal(view.getInt16(44,true),1234);
  const empty=await PcmRecorder.create({} as MediaStream,new AbortController().signal);empty.start();empty.stop();assert.throws(()=>empty.wav(),/No microphone audio/);
  const broken=await PcmRecorder.create({} as MediaStream,new AbortController().signal);broken.start();node!.onprocessorerror!();assert.equal(broken.state,'inactive');assert.throws(()=>broken.wav(),/recording failed/);
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(PcmRecorder.create({} as MediaStream,cancelled.signal));
 }finally{Object.assign(globalThis,saved);}
});

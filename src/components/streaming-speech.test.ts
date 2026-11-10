import {test} from 'node:test';import assert from 'node:assert/strict';
import {StreamingSpeech} from './streaming-speech.ts';
test('finished download waits for audible playback; Stop cancels the wait',async()=>{
 const saved=globalThis.AudioContext;const sources:Array<{onended:(()=>void)|null}>=[];
 class Context{currentTime=0;destination={};async resume(){}async close(){}createBuffer(_c:number,n:number){return {duration:n/16000,copyToChannel(){}};}createBufferSource(){const source={onended:null as (()=>void)|null,buffer:null,connect(){},start(){}};sources.push(source);return source;}}
 try{
  globalThis.AudioContext=Context as unknown as typeof AudioContext;
  let done=false;const player=new StreamingSpeech(),result=player.play(new Response(new Uint8Array(3200)),new AbortController().signal,()=>{}).then(v=>{done=true;return v;});
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(done,false);sources[0].onended!();assert.equal((await result).byteLength,3244);
  const next=new StreamingSpeech(),pending=next.play(new Response(new Uint8Array(3200)),new AbortController().signal,()=>{});
  await new Promise(resolve=>setTimeout(resolve,10));next.stop();await assert.rejects(pending,{name:'AbortError'});
 }finally{globalThis.AudioContext=saved;}
});
test('output metering follows the audio graph and resets immediately on Stop',async()=>{
 const saved=globalThis.AudioContext;let disconnected=0;const levels:number[]=[];
 const analyser={fftSize:512,connect(){},disconnect(){disconnected++;},getFloatTimeDomainData(samples:Float32Array){samples.fill(0.1);}};
 class Context{currentTime=0;destination={};async resume(){}async close(){}createAnalyser(){return analyser;}createBuffer(_c:number,n:number){return {duration:n/16000,copyToChannel(){}};}createBufferSource(){return {buffer:null,onended:null,connect(target:unknown){assert.equal(target,analyser);},start(){}};}}
 try{
  globalThis.AudioContext=Context as unknown as typeof AudioContext;
  const player=new StreamingSpeech(),pending=player.play(new Response(new Uint8Array(3200)),new AbortController().signal,()=>{},level=>levels.push(level));
  const rejected=assert.rejects(pending,{name:'AbortError'});
  await new Promise(resolve=>setTimeout(resolve,65));assert.ok(levels.some(level=>level>0));player.stop();await rejected;
  const count=levels.length;await new Promise(resolve=>setTimeout(resolve,60));assert.equal(levels.length,count);assert.equal(levels.at(-1),0);assert.ok(disconnected>0);
 }finally{globalThis.AudioContext=saved;}
});

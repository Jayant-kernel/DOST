import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startCapture} from './capture.ts';

test('Stop during a delayed session start cannot request a microphone or set ready',async()=>{
 let current=true,ready=false,micRequests=0;
 let release!:(value:Response)=>void;
 const response=new Promise<Response>(resolve=>{release=resolve;});
 const pending=startCapture({sessionReady:false,isCurrent:()=>current,onReady:()=>{ready=true;},signal:new AbortController().signal,transport:async()=>response,getMedia:async()=>{micRequests++;return {} as MediaStream;}});
 current=false;release(Response.json({ready:true}));
 await assert.rejects(pending);assert.equal(ready,false);assert.equal(micRequests,0);
});
test('permission resolving after Stop releases every stale microphone track',async()=>{
 let current=true,stopped=0,release!:(media:MediaStream)=>void;
 const media=new Promise<MediaStream>(resolve=>{release=resolve;});
 const pending=startCapture({sessionReady:true,isCurrent:()=>current,onReady:()=>{},signal:new AbortController().signal,getMedia:()=>media});
 current=false;release({getTracks:()=>[{stop(){stopped++;}}]} as unknown as MediaStream);
 await assert.rejects(pending);assert.equal(stopped,1);
});
test('automatic capture waits for audible introduction before opening the microphone',async()=>{
 const events:string[]=[];await startCapture({sessionReady:false,identify:true,isCurrent:()=>true,onReady:()=>events.push('ready'),signal:new AbortController().signal,transport:async(url)=>{assert.ok(String(url).includes('identify=1'));return Response.json({ready:true});},onWelcome:async()=>{events.push('welcome');},getMedia:async()=>{events.push('mic');return {getTracks:()=>[]} as unknown as MediaStream;}});assert.deepEqual(events,['ready','welcome','mic']);
});

test('capture sends the browser time zone with session setup',async()=>{
 await startCapture({sessionReady:false,timeZone:'America/New_York',isCurrent:()=>true,onReady:()=>{},signal:new AbortController().signal,transport:async(url)=>{
  assert.equal(new URL(String(url),'http://localhost').searchParams.get('timeZone'),'America/New_York');return Response.json({ready:true});
 },getMedia:async()=>({getTracks:()=>[]} as unknown as MediaStream)});
});
test('gentle support is opt-in and adaptation can be disabled in actual session setup',async()=>{
 await startCapture({sessionReady:false,gentle:true,adaptive:false,isCurrent:()=>true,onReady:()=>{},signal:new AbortController().signal,transport:async(url)=>{
  const query=new URL(String(url),'http://localhost').searchParams;
  assert.equal(query.get('gentle'),'1');assert.equal(query.get('adaptive'),'0');return Response.json({ready:true});
 },getMedia:async()=>({getTracks:()=>[]} as unknown as MediaStream)});
});

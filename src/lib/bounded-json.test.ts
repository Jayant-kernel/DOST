import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedJson,readBoundedBytes} from './bounded-json.ts';
test('rejects oversized streamed UTF-8 bodies and cancels reading',async()=>{
 let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('अ'.repeat(1500)));},cancel(){cancelled=true;}});
 await assert.rejects(readBoundedJson(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'} as RequestInit)),{status:413});
 assert.equal(cancelled,true);
});

test('stalled upload is cancelled by deadline and releases its reader',async()=>{
 let cancelled=false;
 const body=new ReadableStream<Uint8Array>({cancel(){cancelled=true;}});
 const request=new Request('http://localhost',{method:'POST',body,duplex:'half'} as RequestInit);
 await assert.rejects(readBoundedBytes(request,100,new AbortController().signal,15),{status:408});
 assert.equal(cancelled,true);assert.equal(body.locked,false);
});
test('session cancellation terminates an unfinished upload',async()=>{
 let cancelled=false;const controller=new AbortController();
 const body=new ReadableStream<Uint8Array>({cancel(){cancelled=true;}});
 const request=new Request('http://localhost',{method:'POST',body,duplex:'half'} as RequestInit);
 const pending=readBoundedBytes(request,100,controller.signal);controller.abort();
 await assert.rejects(pending,{status:499});assert.equal(cancelled,true);
});
test('accepts bounded JSON and rejects malformed JSON',async()=>{
 assert.deepEqual(await readBoundedJson(new Request('http://localhost',{method:'POST',body:'{"confirmed":true}'})),{confirmed:true});
 await assert.rejects(readBoundedJson(new Request('http://localhost',{method:'POST',body:'{'})),{status:400});
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {evonStreamText} from './evon-stream.ts';
const frame=(delta:object,finish_reason:string|null=null)=>'data: '+JSON.stringify({choices:[{delta,finish_reason}]})+'\n\n';
test('reasoning transport accepts split frames once and requires a completed answer',async()=>{
 const encoded=new TextEncoder().encode(frame({content:'Namaste '})+frame({content:'ji.'})+frame({},'stop')+'data: [DONE]\n\n');
 const response=new Response(new ReadableStream({start(c){for(const byte of encoded)c.enqueue(Uint8Array.of(byte));c.close();}}));
 assert.equal(await evonStreamText(response),'Namaste ji.');
});
test('native token-ID completions require explicit EOS and reject token-limit endings',async()=>{
 assert.equal(await evonStreamText(new Response('data: {"content":"Namaste"}\n\ndata: {"content":" ji.","stop":true,"stop_type":"eos"}\n\n'),undefined,true),'Namaste ji.');
 await assert.rejects(evonStreamText(new Response('data: {"content":"unfinished","stop":true,"stop_type":"limit"}\n\n'),undefined,true));
});
test('truncated, thought-tag and interrupted reasoning streams never reach speech',async()=>{
 for(const text of [frame({content:'unfinished'}),frame({content:'4 </think> 4'})+frame({},'stop')+'data: [DONE]\n\n',frame({content:'unfinished'})+frame({},'length')+'data: [DONE]\n\n'])await assert.rejects(evonStreamText(new Response(text)));
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {PublicSpeechCache} from './speech-cache.ts';
const signal=new AbortController().signal;
test('only successful public controls cache; private text and a different voice always generate',async()=>{
 const cache=new PublicSpeechCache();let calls=0;
 async function* generate(){calls++;yield new Uint8Array([0,1]);}
 const collect=async(text:string,voice:string,isPublic:boolean)=>{const chunks=[];for await(const chunk of cache.stream(text,voice,'timbre-v3.0',isPublic,generate,signal))chunks.push(chunk);return chunks;};
 (await collect('intro','Yashraj',true))[0][0]=99;
 assert.deepEqual([...(await collect('intro','Yashraj',true))[0]],[0,1]);assert.equal(calls,1);
 await collect('intro','Shivani',true);assert.equal(calls,2);
 await collect('private name','Yashraj',false);await collect('private name','Yashraj',false);assert.equal(calls,4);
});
test('interrupted speech is not cached; expired entries are regenerated',async()=>{
 let now=0,calls=0;const cache=new PublicSpeechCache(()=>now);
 async function* broken(){calls++;yield new Uint8Array([0,1]);throw Error('interrupted');}
 for(let i=0;i<2;i++)await assert.rejects(async()=>{for await(const _ of cache.stream('intro','Yashraj','v3',true,broken,signal)){};});assert.equal(calls,2);
 async function* okay(){calls++;yield new Uint8Array([0,1]);}
 for await(const _ of cache.stream('intro','Yashraj','v3',true,okay,signal)){};
 now=900001;for await(const _ of cache.stream('intro','Yashraj','v3',true,okay,signal)){};assert.equal(calls,4);
 const stop=new AbortController();stop.abort();await assert.rejects(async()=>{for await(const _ of cache.stream('intro','Yashraj','v3',true,okay,stop.signal)){};});
});

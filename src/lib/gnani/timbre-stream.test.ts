import {test} from 'node:test';import assert from 'node:assert/strict';
import {timbreChunks} from './timbre-stream.ts';
const enc=new TextEncoder();
function response(text:string){return new Response(new ReadableStream({start(c){for(const byte of enc.encode(text))c.enqueue(new Uint8Array([byte]));c.close();}}));}
const start='event: start\r\ndata: {}\r\n\r\n';
const chunk=(index:number)=>`event: chunk\r\ndata: {"chunk_index":${index},"audio":"AAEAAg==","is_final":false}\r\n\r\n`;
const end='event: complete\r\ndata: {"is_final":true,"audio":""}\r\n\r\n';
test('split SSE frames decode audio in order',async()=>{const out=[];for await(const b of timbreChunks(response(start+chunk(1)+chunk(2)+end)))out.push(...b);assert.deepEqual(out,[0,1,0,2,0,1,0,2]);});
test('duplicates, missing completion, errors and malformed audio fail closed',async()=>{for(const s of [start+chunk(1)+chunk(1)+end,start+chunk(1),start+'event: error\ndata: {"secret":"private"}\n\n',start+'event: chunk\ndata: {"chunk_index":1,"audio":"!"}\n\n'])await assert.rejects(async()=>{for await(const _ of timbreChunks(response(s))){}},/Invalid speech stream/);});
test('cancelled consumer cancels upstream stream',async()=>{let cancelled=false;const res=new Response(new ReadableStream({start(c){c.enqueue(enc.encode(start+chunk(1)));},cancel(){cancelled=true;}}));for await(const _ of timbreChunks(res))break;assert.equal(cancelled,true);});

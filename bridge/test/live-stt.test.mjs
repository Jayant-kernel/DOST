import {test} from 'node:test';import assert from 'node:assert/strict';
import {WebSocketServer,WebSocket} from 'ws';
import {createLiveSttServer} from '../src/live-stt.mjs';
import {issueListenToken} from '../../src/lib/gnani/listen-token.mjs';
test('live gateway forwards bounded PCM and deduplicates transcript segments, with key only upstream',async()=>{
 const upstream=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>upstream.once('listening',r));
 let frames=0,header;upstream.on('connection',(socket,request)=>{header=request.headers['x-api-key-id'];socket.send(JSON.stringify({type:'connected'}));socket.on('message',()=>{frames++;if(frames===1){for(let i=0;i<2;i++)socket.send(JSON.stringify({type:'transcript',segment_id:'one',segment_index:0,text:'Namaste'}));}});});
 const secret='x'.repeat(32),origin='http://localhost:3000';
 const server=createLiveSttServer({secret,apiKey:'test-private-key',origin,upstreamUrl:`ws://127.0.0.1:${upstream.address().port}`});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const grant=issueListenToken(secret,origin),messages=[];
 const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/api/voice/live`,['saathi-v1',grant],{origin});
 try{await new Promise((resolve,reject)=>{socket.on('error',reject);socket.on('message',raw=>{const event=JSON.parse(raw);messages.push(event);if(event.type==='connected')socket.send(Buffer.alloc(1024));if(event.type==='transcript')resolve();});});
 assert.equal(header,'test-private-key');assert.ok(frames>=1);await new Promise(r=>setTimeout(r,20));
 assert.equal(messages.filter(m=>m.type==='transcript').length,1);assert.ok(!JSON.stringify(messages).includes('test-private-key'));
 const replay=new WebSocket(`ws://127.0.0.1:${server.address().port}/api/voice/live`,['saathi-v1',grant],{origin});
 await new Promise(resolve=>{replay.on('error',()=>{});replay.on('close',resolve);});
 socket.send(Buffer.alloc(4));await new Promise(resolve=>socket.once('close',resolve));
 }finally{socket.terminate();server.closeAllConnections();await new Promise(r=>server.close(r));for(const s of upstream.clients)s.terminate();await new Promise(r=>upstream.close(r));}
});

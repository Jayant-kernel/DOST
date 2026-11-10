import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VoiceSessions} from './sessions.ts';
test('ending one session aborts its active turn but not another session',()=>{
 const sessions=new VoiceSessions(),a=new AbortController(),b=new AbortController();
 sessions.set('a',{expires:Date.now()+10000,messages:[],busy:true,turns:1,controller:a});
 sessions.set('b',{expires:Date.now()+10000,messages:[],busy:true,turns:1,controller:b});
 sessions.delete('a');assert.equal(a.signal.aborted,true);assert.equal(b.signal.aborted,false);
});
test('expired sessions are rejected and removed, including at expiry boundary',()=>{
 const sessions=new VoiceSessions();sessions.set('expired',{expires:Date.now(),messages:[],busy:false,turns:0});
 assert.equal(sessions.get('expired'),undefined);assert.equal(sessions.size,0);
});
test('conversation choices are scoped to one voice session and vanish on Stop',()=>{
 const sessions=new VoiceSessions();
 sessions.set('a',{expires:Date.now()+10000,messages:[],busy:false,turns:0,engagement:{listenOnly:true,askedTopics:['music']}});
 sessions.set('b',{expires:Date.now()+10000,messages:[],busy:false,turns:0});
 assert.equal(sessions.get('a')?.engagement?.listenOnly,true);assert.equal(sessions.get('b')?.engagement,undefined);
 sessions.delete('a');sessions.set('a',{expires:Date.now()+10000,messages:[],busy:false,turns:0});
 assert.equal(sessions.get('a')?.engagement,undefined);
});
test('a session cannot resolve another session through a guessed or missing identifier',()=>{
 const sessions=new VoiceSessions();sessions.set('a',{expires:Date.now()+10000,messages:[{role:'user',content:'private-a'}],busy:false,turns:0});sessions.set('b',{expires:Date.now()+10000,messages:[],busy:false,turns:0});
 assert.deepEqual(sessions.get('b')?.messages,[]);assert.equal(sessions.get('forged'),undefined);sessions.delete('a');assert.equal(sessions.get('a'),undefined);assert.ok(sessions.get('b'));
});

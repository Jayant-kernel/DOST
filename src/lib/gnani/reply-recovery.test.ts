import {test} from 'node:test';import assert from 'node:assert/strict';
import {ProviderError} from './providers.ts';
import {recoverReply} from './reply-recovery.ts';

test('invalid model text reports reply failure and never ends the conversation or blames hearing',async()=>{
 const result=await recoverReply(async()=>{throw new ProviderError('Evon response quality');},new AbortController().signal);
 assert.equal(result.recovery,true);assert.equal(result.end,false);assert.match(result.reply,/जवाब बनाने/);assert.doesNotMatch(result.reply,/समझ नहीं|सुन नहीं|बताएँगे\?|दोहराएँ/);
 assert.equal(result.failure,'quality');
 const last=await recoverReply(async()=>{throw new ProviderError('Evon response quality');},new AbortController().signal,1);
 assert.equal(last.end,false);assert.doesNotMatch(last.reply,/फिर बात करते|दोहराएँ|\?/);
 const many=await recoverReply(async()=>{throw new ProviderError('Evon');},new AbortController().signal,5);assert.equal(many.end,false);
});
test('deadline aborts the inference and returns a bounded spoken timeout',async()=>{
 let aborted=false;
 const result=await recoverReply(signal=>new Promise((_,reject)=>{signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true});}),new AbortController().signal,0,20);
 assert.equal(aborted,true);assert.equal(result.recovery,true);assert.match(result.reply,/देर/);
 assert.equal(result.failure,'timeout');
});

test('unavailable reasoning is distinct from timeout and rejected output without leaking provider details',async()=>{
 const result=await recoverReply(async()=>{throw new ProviderError('Tokenizer',503);},new AbortController().signal);
 assert.equal(result.failure,'unavailable');assert.equal(result.end,false);assert.doesNotMatch(result.reply,/Tokenizer|503/);
});
test('Stop never produces a fallback; storage and programmer failures remain errors',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(recoverReply(async()=>{calls++;return 'reply';},controller.signal));assert.equal(calls,0);
 await assert.rejects(recoverReply(async()=>{throw new Error('storage failure');},new AbortController().signal));
 const okay=await recoverReply(async()=>'जी, बताइए।',new AbortController().signal);
 assert.deepEqual(okay,{reply:'जी, बताइए।',recovery:false,end:false});
});
test('recovery respects just-listen requests and enforces a deadline even if a dependency ignores abort',async()=>{
 const listening=await recoverReply(async()=>{throw new ProviderError('Evon response quality');},new AbortController().signal,0,100,true);assert.doesNotMatch(listening.reply,/\?/);
 const timeout=await recoverReply(()=>new Promise(()=>{}),new AbortController().signal,0,10);assert.equal(timeout.recovery,true);
});

test('Tara engaging fallback speaks a normal reply instead of an apology',async()=>{
 const engaging={reply:'एक बात बताइए, अभी आप क्या कर रहे हैं?',listening:'जी, मैं सुन रही हूँ।'};
 const result=await recoverReply(async()=>{throw new ProviderError('Evon response quality');},new AbortController().signal,0,20000,false,engaging);
 assert.equal(result.recovery,false);assert.equal(result.engaged,true);assert.equal(result.reply,engaging.reply);assert.equal(result.failure,'quality');assert.doesNotMatch(result.reply,/दिक्कत|माफ़/);
 const quiet=await recoverReply(async()=>{throw new ProviderError('Evon');},new AbortController().signal,0,20000,true,engaging);
 assert.equal(quiet.reply,engaging.listening);
 const timeout=await recoverReply(()=>new Promise(()=>{}),new AbortController().signal,0,10,false,engaging);
 assert.equal(timeout.engaged,true);assert.equal(timeout.failure,'timeout');
});

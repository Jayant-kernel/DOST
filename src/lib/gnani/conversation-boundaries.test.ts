import {test} from 'node:test';import assert from 'node:assert/strict';
import {updateConversationBoundaries} from './conversation-boundaries.ts';
test('explicit boundaries retain dated original words and prior question after ordinary context trimming',()=>{
 const now=Date.parse('2026-10-30T06:00:00Z'),original='इस बारे में बात नहीं करनी।';
 const state=updateConversationBoundaries(undefined,original,'दफ्तर के बारे में बताइए?',now);
 assert.deepEqual(state.hints[0],{kind:'user-declined',at:'2026-10-30T06:00:00.000Z',expiresAt:now+1800000,userText:original,assistantText:'दफ्तर के बारे में बताइए?'});
 const next=updateConversationBoundaries(state,'आज धूप है।','जी।',now+1000);
 assert.deepEqual(next.hints,state.hints);assert.equal(state.hints.length,1);
});
test('reported resolution is a user report, while negation, quotation, questions and bare no do not create event facts',()=>{
 assert.equal(updateConversationBoundaries(undefined,'वह समस्या सुलझ गई।','जी।',0).hints[0].kind,'user-reported-resolution');
 assert.equal(updateConversationBoundaries(undefined,'अब कोई परेशानी नहीं।','जी।',0).hints[0].kind,'user-reported-resolution');
 for(const text of ['समस्या नहीं सुलझी।','क्या मामला सुलझ गया?','"अब सब ठीक है" का मतलब क्या है?','नहीं।','अगर सब ठीक है तो?','ठीक है।','मुझे नहीं लगता कि अब सब ठीक है।','अगर अब सब ठीक है तो मैं कल बात करूँगा।','If the problem is resolved, we can talk tomorrow.'])assert.deepEqual(updateConversationBoundaries(undefined,text,'जी।',0).hints,[],text);
});
test('hints are bounded immutable session data with expiry and no cross-session default',()=>{
 let state=updateConversationBoundaries(undefined,'अब सब ठीक है।','x'.repeat(300),0);const original=state;
 for(let i=1;i<7;i++)state=updateConversationBoundaries(state,`बात ${i} सुलझ गई।`,'x'.repeat(300),i*1000);
 assert.equal(state.hints.length,3);assert.equal(original.hints.length,1);
 assert.ok(state.hints.every(hint=>hint.userText.length<=240&&hint.assistantText.length<=160));
 assert.deepEqual(updateConversationBoundaries(state,'जी।','',2000000).hints,[]);
 assert.deepEqual(updateConversationBoundaries(undefined,'जी।','',7000).hints,[]);
});

import {test} from 'node:test';import assert from 'node:assert/strict';import {compareConfiguredReference} from './reference.mjs';
test('reference comparison makes no call without application configuration AND scoped authorization',async()=>{
 let calls=0;const generate=async()=>{calls++;return {text:'answer'};};
 for(const adapter of [undefined,{configured:true,generate},{authorizedFor:'saathi-synthetic-conversation-evaluation',generate}])assert.equal((await compareConfiguredReference([],adapter)).status,'skipped_no_configured_authorized_reference');
 assert.equal(calls,0);
});
test('authorized injected reference receives exact synthetic prompt and memory without changing Evon evidence',async()=>{
 const rows=[{scenario:'test',turn:1,input:'hello',modelInvoked:true,promptMessages:[{role:'system',content:'exact'},{role:'user',content:'hello'}],settings:{temperature:0,n_predict:96},memory:[{at:'2020-01-01',text:'fictional'}]}];
 const report=await compareConfiguredReference(rows,{configured:true,authorizedFor:'saathi-synthetic-conversation-evaluation',model:'injected-test-only',generate:async request=>{assert.deepEqual(request.messages,rows[0].promptMessages);assert.deepEqual(request.memory,rows[0].memory);return {text:'response',usage:{input:3,output:1}};},estimateCost:()=>0.01,currency:'test'});
 assert.equal(report.estimatedCost,0.01);assert.equal(report.rows[0].raw,'response');assert.equal(rows[0].raw,undefined);
});

import {test} from 'node:test';import assert from 'node:assert/strict';import {gradeTurn} from './grade.mjs';
const row={input:'इंद्रधनुष कैसे बनता है?',rawResponse:'इंद्रधनुष कैसे बनता है?',finalResponse:'जवाब बनाने में दिक्कत हुई।',modelInvoked:true,source:'recovery',failure:'quality',failureDetail:'repetitive-reply'};
test('safe recovery cannot hide a failed raw response or become a semantic pass',()=>{
 const grade=gradeTurn(row,{checks:['no-echo'],rubric:'Explain rainbow formation'});assert.equal(grade.outcome,'fail');assert.equal(grade.failures[0].category,'A');assert.equal(grade.semanticReview,'pending');
});
test('strategy, context, instruction, override, timeout and safety evidence retain distinct categories',()=>{
 const cases=[
  [{strategy:'ASK',directorApplied:true},{strategies:['LISTEN']},'B'],
  [{memory:[]},{memoryTerms:['fictional']},'C'],
  [{rawResponse:'कहाँ रहते हैं?',finalResponse:'कहाँ रहते हैं?'},{checks:['no-question']},'D'],
  [{override:{replacedModelResponse:true}},{},'E'],
  [{failure:'timeout'},{},'F'],
  [{rawResponse:'दो गोली लें।'},{checks:['no-medication-change']},'G']
 ];for(const [extra,expected,category] of cases)assert.ok(gradeTurn({input:'synthetic',...extra},expected).failures.some(f=>f.category===category),category);
 assert.equal(gradeTurn({input:'synthetic',deterministic:true,finalResponse:'नमस्ते'},{}).failures.some(f=>f.category==='E'),false);
});
test('pending generation and mechanically clean output never claim naturalness qualification',()=>{
 assert.equal(gradeTurn({input:'synthetic',promptPending:true,finalResponse:null},{checks:['no-question']}).outcome,'needs-review');
 const g=gradeTurn({input:'synthetic',finalResponse:'नमस्ते।'},{checks:['no-question']});assert.equal(g.outcome,'pass-mechanical');assert.equal(g.semanticReview,'pending');
 assert.equal(gradeTurn({input:'synthetic',rawResponse:'दो गोली मत लें।'},{checks:['no-medication-change']}).failures.length,0);
});

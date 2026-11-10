import {test} from 'node:test';import assert from 'node:assert/strict';
import {naturalReturn,mealEvent} from './natural-return.ts';
const now=Date.parse('2026-10-29T18:00:00+05:30');
const saved=(user:string,age=60000)=>({created:now-age,user,assistant:'जी।'});
test('a fresh unresolved meal gets a direct question, not a transcript or assumed hunger',()=>{
 const follow=naturalReturn([saved('मैंने आज खाना नहीं खाया')],now);
 assert.equal(follow.question,'अब कुछ खा लिया?');assert.equal(follow.turn?.kind,'meal-check');
 assert.equal(naturalReturn([saved('आज खाना बहुत खराब था')],now).turn?.kind,'food-enjoyment');
 assert.equal(naturalReturn([saved('मैंने खाना नहीं खाया',7*3600000)],now).question,'आज खाना हो गया?');
 assert.equal(naturalReturn([saved('मैंने खाना नहीं खाया',2*86400000)],now).question,undefined);
 assert.equal(naturalReturn([saved('मैंने खाना नहीं खाया',-1000)],now).question,undefined);
});
test('latest resolution, refusal and topic changes beat older food concerns',()=>{
 assert.equal(naturalReturn([saved('मैंने खाना नहीं खाया'),saved('मैंने खाना खा लिया',1000)],now).question,'खाने में क्या अच्छा लगा?');
 assert.equal(mealEvent('पहले भूख लगी थी, अब खाना खा लिया'),'eaten');
 assert.equal(mealEvent('मैंने खाना नहीं खाया था, अब खाना खा लिया'),'eaten');
 assert.equal(mealEvent('मैंने बहुत खराब खाना खाया'),'unpleasant');
 assert.equal(naturalReturn([saved('मुझे भूख लगी है'),saved('अब भूख नहीं है',1000)],now).avoidMeals,true);
 assert.equal(naturalReturn([saved('आज खाना खराब था'),{...saved('नहीं',1000),assistant:'ठीक है जी। आप जिस बारे में चाहें बात कर सकते हैं।'}],now).avoidMeals,true);
 assert.equal(naturalReturn([saved('मैंने खाना नहीं खाया'),saved('मुझे संगीत पसंद है',1000)],now).question,'आज कोई मनपसंद गाना सुनने का मन है?');
 assert.equal(naturalReturn([saved('मैंने खाना नहीं खाया'),saved('खाने की बात नहीं करनी',1000)],now).avoidMeals,true);
});
test('questions, quotes, third-person and historical reports do not become current meal evidence',()=>{
 for(const text of ['मेरी माँ ने खाना नहीं खाया','क्या मैंने खाना नहीं खाया?','“मैंने खाना नहीं खाया” का मतलब','कल मैंने खाना नहीं खाया','मैंने खाना नहीं खाया और पेट में दर्द है'])assert.equal(mealEvent(text),undefined,text);
 assert.equal(naturalReturn([{created:0,user:'मैंने खाना नहीं खाया',assistant:''}],now).question,undefined);
 assert.equal(naturalReturn([saved('मुझे सर्दी है')],now).question,'अब कैसा लग रहा है?');
 assert.equal(naturalReturn([saved('I like gardening.')],now).question,'आज बगीचे में कुछ समय बिताया?');
});

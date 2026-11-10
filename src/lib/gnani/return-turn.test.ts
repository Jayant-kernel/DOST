import {test} from 'node:test';import assert from 'node:assert/strict';
import {continueReturn} from './return-turn.ts';import {mealSupport} from './meal-support.ts';
test('a return meal question understands no, then follows current stock, restriction and cooking answers',()=>{
 const reply=continueReturn('अभी नहीं',{kind:'meal-check',expires:10000},true,100);
 assert.match(reply.reply!,/क्या उपलब्ध/);assert.deepEqual(reply.meal?.foods,[]);
 const stock=mealSupport([{role:'user',content:'दाल चावल और टमाटर हैं'}],reply.meal);
 const diet=mealSupport([{role:'user',content:'नहीं'}],stock.state);
 const cook=mealSupport([{role:'user',content:'हाँ'}],diet.state);
 assert.match(cook.reply!,/टमाटर/);assert.match(cook.reply!,/नरम/);assert.doesNotMatch(cook.reply!,/तेल|नमक|घी/);
});
test('disliked food is not equivalent to a missed meal, and no appetite is respected',()=>{
 const first=continueReturn('नहीं',{kind:'food-enjoyment',expires:10000},true,100);assert.match(first.reply!,/मन है/);assert.equal(first.meal,undefined);
 const second=continueReturn('नहीं',first.state,true,200);assert.equal(second.state,undefined);assert.equal(second.meal,undefined);assert.doesNotMatch(second.reply!,/\?/);
 assert.equal(continueReturn('आज खाना बहुत खराब था',undefined,true,100).state?.kind,'appetite');
});
test('yes resolves the question; expired, disabled, quoted, unrelated and correction turns do not force advice',()=>{
 const state={kind:'meal-check' as const,expires:1000};assert.match(continueReturn('हाँ',state,true,100).reply!,/खाने में क्या/);
 assert.equal(continueReturn('अब भूख नहीं है',state,true,100).meal,undefined);assert.doesNotMatch(continueReturn('अब भूख नहीं है',state,true,100).reply!,/\?/);
 for(const text of ['आज क्रिकेट की बात करें','“नहीं” का मतलब','मेरी माँ ने खाना नहीं खाया','मेरी माँ के घर दाल और चावल हैं'])assert.deepEqual(continueReturn(text,state,true,100),{},text);
 assert.deepEqual(continueReturn('नहीं',state,false,100),{});assert.deepEqual(continueReturn('नहीं',state,true,1001),{});
});

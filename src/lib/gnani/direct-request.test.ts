import {test} from 'node:test';import assert from 'node:assert/strict';
import {asksForAnswer} from './direct-request.ts';
import {basicNeedsReply} from './basic-needs.ts';
import {mealSupport} from './meal-support.ts';
import {continueReturn} from './return-turn.ts';
test('direct informational questions do not turn food words into pantry stock or unsolicited cooking',()=>{
 for(const text of ['दाल क्या है?','चावल का मतलब क्या है?','खाना कितने बजे खाना चाहिए?','Tell me what rice is','दाल के बारे में समझाइए']){
  assert.equal(asksForAnswer(text),true,text);
  assert.equal(basicNeedsReply([{role:'user',content:'मुझे भूख लगी है, मेरे पास पैसे नहीं हैं।'},{role:'user',content:text}]),undefined,text);
 }
 assert.equal(asksForAnswer('दाल और चावल हैं'),false);assert.equal(asksForAnswer('हाँ, खाना खा लिया'),false);
});
test('a related meal clarification is not a diagnosis and retains the pending restriction question',()=>{
 const state={stage:'restriction' as const,foods:['rice','dal']};
 for(const text of ['एलर्जी क्या है?','किडनी क्या है?','परहेज़ का मतलब समझाइए']){
  const result=mealSupport([{role:'user',content:text}],state);
  assert.equal(result.reply,undefined,text);assert.deepEqual(result.state,state);
  assert.match(mealSupport([{role:'user',content:'नहीं'}],result.state).reply!,/पकाने/);
 }
 assert.equal(mealSupport([{role:'user',content:'भारत की राजधानी क्या है?'}],state).state,undefined);
 assert.deepEqual(state,{stage:'restriction',foods:['rice','dal']});
});
test('return questions cannot replace a direct request with appetite suggestions',()=>{
 const previous={kind:'meal-check' as const,expires:Date.now()+60000};
 assert.equal(continueReturn('चावल क्या है?',previous).reply,undefined);
 assert.equal(continueReturn('दाल क्या है?',previous).state,previous);
 assert.match(continueReturn('अभी नहीं',previous).reply!,/क्या उपलब्ध/);
});

test('health questions and refusals invalidate prior cooking clearance before a later yes/no',()=>{
 const cooking={stage:'cooking' as const,foods:['rice','dal']},returning={kind:'meal-check' as const,expires:Date.now()+60000};
 for(const text of ['दाल से एलर्जी है, क्या करूँ?','दाल खाने के बाद सीने में दर्द है, क्या करूँ?','दाल नहीं चाहिए, क्या कोई और बात करें?']){
  const meal=mealSupport([{role:'user',content:text}],cooking);assert.equal(meal.state,undefined,text);assert.equal(meal.reply,undefined,text);
  assert.equal(mealSupport([{role:'user',content:'हाँ'}],meal.state).reply,undefined,text);
  const follow=continueReturn(text,returning);assert.equal(follow.state,undefined,text);
  assert.equal(continueReturn('नहीं',follow.state).reply,undefined,text);
 }
});

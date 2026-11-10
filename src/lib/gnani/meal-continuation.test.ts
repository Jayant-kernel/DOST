import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mealContinuation} from './meal-continuation.ts';
import type {Message} from './providers.ts';
const turn=(question:string,answer:string):Message[]=>[{role:'assistant',content:question},{role:'user',content:answer}];
test('short dinner answers continue without inference and pantry support remains connected',()=>{
 for(const no of ['no','अभी नहीं','नहीं']){
  const start=mealContinuation(turn('रात का खाना हो गया?',no));
  assert.equal(start.state?.stage,'pantry');assert.match(start.reply!,/क्या उपलब्ध/);
  const stock=mealContinuation([{role:'user',content:'रोटी और दही है'}],start.state);
  assert.equal(stock.state?.stage,'restriction');
  assert.match(mealContinuation([{role:'user',content:'नहीं'}],stock.state).reply!,/रोटी और दही/);
 }
 const liked=mealContinuation(turn('रात का खाना हो गया?','हाँ'));assert.match(liked.reply!,/क्या अच्छा लगा/);
 const food=mealContinuation(turn(liked.reply!,'दाल और रोटी')).reply!;assert.match(food,/दाल और रोटी/);
 const specific=mealContinuation(turn(liked.reply!,'हाँ')).reply!;assert.match(specific,/क्या खाया/);
 assert.match(mealContinuation(turn(specific,'दाल और रोटी')).reply!,/दाल और रोटी/);
 assert.match(mealContinuation(turn(food,'नहीं')).reply!,/आपकी मर्ज़ी/);
 assert.doesNotMatch(mealContinuation(turn(liked.reply!,'no')).reply!,/भूख|उपलब्ध|दवा/);
 assert.doesNotMatch(mealContinuation(turn('रात का खाना हो गया?','अभी नहीं'),undefined,false).reply!,/\?/);
});
test('ambiguous now clarifies without guessing; explicit refusal and unrelated requests stay separate',()=>{
 const unclear=mealContinuation(turn('रात का खाना हो गया?','now'));assert.match(unclear.reply!,/समझ नहीं/);assert.equal(unclear.state,undefined);
 assert.equal(mealContinuation(turn(unclear.reply!,'नहीं')).state?.stage,'pantry');
 for(const answer of ['क्या मौसम है?','नहीं, सीने में दर्द है','“no” का अनुवाद','बस सुनिए'])assert.deepEqual(mealContinuation(turn('रात का खाना हो गया?',answer)),{},answer);
 assert.match(mealContinuation(turn('रात का खाना हो गया?','no thanks')).reply!,/छोड़/);
 assert.deepEqual(mealContinuation(turn('दवा ले ली?','no')),{});
 assert.deepEqual(mealContinuation(turn('आज खाने में क्या अच्छा लगा? दवा ले ली?','no')),{});
 assert.deepEqual(mealContinuation(turn('“आज खाने में क्या अच्छा लगा?” का अनुवाद है।','दाल')),{});
 assert.deepEqual(mealContinuation([{role:'assistant',content:'रात का खाना हो गया?'},{role:'user',content:'हाँ'},{role:'assistant',content:'कौन सा संगीत पसंद है?'},{role:'user',content:'no'}]),{});
});

test('a stated plan to eat shortly acknowledges the plan without opening a recipe interview',()=>{
 for(const text of ['मैं थोड़ी देर में खाना खाऊंगा।','मैं कुछ मिनट बाद खाना खाऊँगी।','खाना थोड़ी देर में खाऊँगा।',"I am going to eat food after a few minutes.",'I will eat in a few minutes.','main thodi der mein khana khaunga']){
  const result=mealContinuation(turn('रात का खाना हो गया?',text));
  assert.match(result.reply??'',/आराम से खाना खा लीजिए/);assert.equal(result.state,undefined);assert.doesNotMatch(result.reply!,/\?|उपलब्ध|दवा|खा लिया/);
 }
 const pending={stage:'pantry' as const,foods:[]};assert.equal(mealContinuation(turn('अभी घर में खाने के लिए क्या उपलब्ध है?','मैं थोड़ी देर में खाना खाऊंगा।'),pending).state,undefined);
 for(const [question,text] of [['दवा ले ली?','मैं थोड़ी देर में खाऊंगा।'],['रात का खाना हो गया?','क्या मैं कुछ मिनट बाद खाना खाऊँ?'],['रात का खाना हो गया?','मैं थोड़ी देर में खाना खाऊंगा, लेकिन सीने में दर्द है।'],['रात का खाना हो गया?','मेरे बेटे ने कहा कि वह थोड़ी देर में खाना खाएगा।'],['रात का खाना हो गया?','"I will eat in a few minutes" का अनुवाद करो।']])assert.deepEqual(mealContinuation(turn(question,text)),{},text);
});

test('a statement-led companion acknowledges a finished meal without a follow-up question',()=>{
 const eaten=mealContinuation(turn('रात का खाना हो गया?','हाँ'),undefined,true,false);
 assert.ok(eaten.reply);assert.doesNotMatch(eaten.reply!,/[?？]/);assert.match(eaten.reply!,/खाना हो गया/);assert.equal(eaten.state,undefined);
 const full=mealContinuation(turn('रात का खाना हो गया?','हाँ, मैंने खाना खा लिया'),undefined,true,false);
 assert.ok(full.reply);assert.doesNotMatch(full.reply!,/[?？]/);
 assert.equal(mealContinuation(turn('रात का खाना हो गया?','हाँ'),undefined,false,false).reply,'अच्छा, खाना हो गया।');
 // A statement-led companion answers "no" by carrying on (with a gentle food nudge and an offer of help) instead of opening the pantry flow; the question-led flow keeps pantry support.
 const notYet=mealContinuation(turn('रात का खाना हो गया?','नहीं'),undefined,true,false);
 assert.equal(notYet.state,undefined);assert.match(notYet.reply!,/आप क्या कर रहे हैं\?/u);assert.match(notYet.reply!,/इंतज़ाम न हो तो मुझे बताइए/u);assert.equal((notYet.reply!.match(/[?？]/g)??[]).length,1);
 assert.equal(mealContinuation(turn('रात का खाना हो गया?','नहीं')).state?.stage,'pantry');
 assert.match(mealContinuation(turn('रात का खाना हो गया?','now'),undefined,true,false).reply!,/समझ नहीं/);
});
test('legacy meal replies stay byte-identical with the default question-led flow',()=>{
 for(const led of [undefined,true]){
  assert.equal(mealContinuation(turn('रात का खाना हो गया?','हाँ'),undefined,true,led).reply,'अच्छा, आज खाने में क्या अच्छा लगा?');
  assert.equal(mealContinuation(turn('रात का खाना हो गया?','हाँ, मैंने खाना खा लिया'),undefined,true,led).reply,'अच्छा जी। आज खाने में क्या अच्छा लगा?');
  assert.equal(mealContinuation(turn('रात का खाना हो गया?','हाँ'),undefined,false,led).reply,'अच्छा, खाना हो गया।');
  assert.equal(mealContinuation(turn('आज खाने में क्या अच्छा लगा?','हाँ'),undefined,true,led).reply,'अच्छा जी, क्या खाया था?');
 }
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {mealSupport,type MealState} from './meal-support.ts';
const say=(text:string,state?:MealState,allow=true)=>mealSupport([{role:'user',content:text}],state,allow);
test('missed meal asks pantry, restrictions and cooking before a confirmed dal-rice option',()=>{
 const start=say('मैंने आज खाना नहीं खाया');assert.match(start.reply!,/क्या उपलब्ध/);
 const foods=say('दाल और चावल हैं',start.state);assert.match(foods.reply!,/एलर्जी/);assert.deepEqual(foods.state?.foods,['rice','dal']);
 const restriction=say('कोई परहेज़ नहीं है',foods.state);assert.match(restriction.reply!,/पकाने/);
 assert.match(say('हाँ',restriction.state).reply!,/खिचड़ी/);
 assert.match(say('नहीं',restriction.state).reply!,/भरोसेमंद/);
 assert.match(say('हाँ',foods.state).reply!,/डॉक्टर/);
 assert.deepEqual(say('क्या दाल चावल खाना चाहिए?',start.state),{});
});
test('no assumed pantry, cooking, dietary suitability or continued advice after refusal',()=>{
 const start=say('मुझे भूख लगी है');
 const stock=say('दाल नहीं है, चावल हैं',start.state);assert.deepEqual(stock.state?.foods,['rice']);
 assert.match(say('मुझे किडनी की बीमारी है',stock.state).reply!,/डॉक्टर/);
 assert.match(say('कोई एलर्जी नहीं है',stock.state).reply!,/पकाने/);
 assert.match(say('घर में कुछ भी नहीं है',start.state).reply!,/भरोसेमंद/);
 assert.match(say('पका नहीं सकता',stock.state).reply!,/भरोसेमंद/);
 assert.deepEqual(say('नहीं चाहिए',stock.state),{});assert.deepEqual(say('आज क्रिकेट की बात करें',stock.state),{});
 assert.deepEqual(say('मुझे भूख लगी है',undefined,false),{});
});
test('symptoms, quoted/third-person/historical meals and negation do not trigger food shortcuts',()=>{
 for(const text of ['मेरी माँ ने खाना नहीं खाया','कल मैंने खाना नहीं खाया','“मैंने खाना नहीं खाया” का अनुवाद','मैंने खाना खा लिया है','मुझे भूख नहीं लगी है','मैंने खाना नहीं खाया और चक्कर आ रहे हैं'])assert.deepEqual(say(text),{},text);
 const start=say('मैंने कुछ नहीं खाया');assert.ok(start.state);
 assert.deepEqual(say('सीने में दर्द है',start.state),{});
});
test('meal-checkin answer and ready food stay connected to preceding question',()=>{
 const state=mealSupport([{role:'assistant',content:'सुबह का नाश्ता हो गया?'},{role:'user',content:'अभी नहीं'}]).state;
 assert.ok(state);const stock=say('रोटी और दही है',state);assert.match(say('नहीं',stock.state).reply!,/रोटी और दही/);
});

test('English and Hindi short missed-dinner answers preserve pantry continuity',()=>{
 for(const text of ['no','NO','not yet','nahi','जी नहीं','अभी नहीं']){
  const start=mealSupport([{role:'assistant',content:'रात का खाना हो गया?'},{role:'user',content:text}]);
  assert.match(start.reply!,/क्या उपलब्ध/,text);assert.equal(start.state?.stage,'pantry');
  const stock=say('रोटी और दही है',start.state);assert.equal(stock.state?.stage,'restriction');
  assert.match(say('नहीं',stock.state).reply!,/रोटी और दही/);
 }
 for(const text of ['now','not now','no thanks','नहीं चाहिए','नहीं, सीने में दर्द है'])assert.deepEqual(mealSupport([{role:'assistant',content:'रात का खाना हो गया?'},{role:'user',content:text}]),{},text);
 assert.deepEqual(mealSupport([{role:'assistant',content:'आज खाने में क्या अच्छा लगा?'},{role:'user',content:'no'}]),{});
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {basicNeedsReply} from './basic-needs.ts';
const turn=(content:string)=>({role:'user' as const,content});
test('support does not keep asking the cooking or pantry question after it was already asked',()=>{
 const history=[turn('भूख लगी है लेकिन पैसे नहीं हैं।'),{role:'assistant' as const,content:'घर में खाने की कौन सी चीज़ें उपलब्ध हैं? पहले उन्हीं से बिना कुछ खरीदे कुछ बनाने का तरीका देखते हैं।'},turn('चावल हैं।')];
 const rice=basicNeedsReply(history);assert.ok(rice);
 const next=basicNeedsReply([...history,{role:'assistant',content:rice},turn('थोड़ा आटा भी है।')]);assert.ok(next);assert.doesNotMatch(next,/पानी और पकाने का साधन उपलब्ध है\?/);
 const stillHungry=basicNeedsReply([...history,{role:'assistant',content:rice},turn('मुझे अभी भी भूख लगी है।')]);assert.ok(stillHungry);assert.doesNotMatch(stillHungry,/कौन सी चीज़ें|\?/);
});
test('hunger with no money offers practical no-purchase help across supported wording',()=>{
 for(const text of ['मुझे भूख लगी है लेकिन मेरे पास पैसे नहीं हैं।','Mujhe bhookh lagi hai lekin mere paas paise nahi hain.',"I'm hungry but I don't have money.",'भूख लगी है, खाना खरीदने के पैसे नहीं हैं।']){
  const reply=basicNeedsReply([turn(text)]);assert.ok(reply,text);assert.match(reply,/घर/);assert.doesNotMatch(reply,/ऑर्डर|चोट|दर्द/);assert.equal((reply.match(/\?/g)??[]).length,1);
 }
});
test('financial constraint survives a follow-up without repeating the first pantry question',()=>{
 const history=[turn('भूख लगी है लेकिन पैसे नहीं हैं।'),{role:'assistant' as const,content:'घर में खाने की कौन सी चीज़ें उपलब्ध हैं?'}];
 const empty=basicNeedsReply([...history,turn('घर में कुछ भी खाने को नहीं है।')]);assert.ok(empty);assert.match(empty,/भरोसेमंद/);assert.doesNotMatch(empty,/घर में.*चीज़ें/);
 const rice=basicNeedsReply([...history,turn('थोड़े चावल हैं।')]);assert.ok(rice);assert.match(rice,/भात/);assert.doesNotMatch(rice,/कौन सी चीज़ें/);
});
test('ordinary hunger, unrelated topics, quotes and a resolved budget do not take the support shortcut',()=>{
 for(const text of ['मुझे भूख लगी है।','मेरे पास पैसे हैं और मुझे खाना चाहिए।','Translate "I am hungry but have no money" into Hindi.','अनुवाद करें: मुझे भूख लगी है लेकिन पैसे नहीं हैं।','भूख लगी है और पैसे नहीं हैं, सीने में दर्द हो रहा है।'])assert.equal(basicNeedsReply([turn(text)]),undefined);
 const first=turn('भूख लगी है लेकिन पैसे नहीं हैं।');
 assert.equal(basicNeedsReply([first,turn('आज क्रिकेट में क्या हुआ?')]),undefined);
 assert.equal(basicNeedsReply([first,turn('अब पैसे मिल गए हैं, खाना ऑर्डर करना है।')]),undefined);
});
test('a money negation is not mistaken for an empty pantry, and missing rice is not proposed',()=>{
 const history=[turn('भूख लगी है लेकिन पैसे नहीं हैं।')];
 assert.match(basicNeedsReply([...history,turn('घर में चावल हैं लेकिन पैसे नहीं हैं।')])??'',/भात/);
 const reply=basicNeedsReply([...history,turn('चावल नहीं हैं, आटा है।')]);assert.ok(reply);assert.match(reply,/रोटी/);assert.doesNotMatch(reply,/भात/);
});

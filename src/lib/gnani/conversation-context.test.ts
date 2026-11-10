import {test} from 'node:test';import assert from 'node:assert/strict';
import {conversationTime,openingQuestion,openingRemark,validTimeZone,selectRecall} from './conversation-context.ts';

test('day periods follow local time at every boundary, not the server clock zone',()=>{
 for(const [time,period] of [['04:59','night'],['05:00','morning'],['10:59','morning'],['11:00','afternoon'],['15:59','afternoon'],['16:00','evening'],['19:59','evening'],['20:00','night']] as const){
  assert.equal(conversationTime(new Date(`2026-10-24T${time}:00+05:30`),'Asia/Kolkata').period,period);
 }
 const instant=new Date('2026-10-24T19:00:00Z');
 assert.equal(conversationTime(instant,'Asia/Kolkata').date,'2026-10-25');
 assert.equal(conversationTime(instant,'Asia/Kolkata').time,'00:30');
 assert.equal(conversationTime(instant,'America/New_York').period,'afternoon');
 assert.equal(conversationTime(new Date('2026-07-24T19:00:00Z'),'America/New_York').time,'15:00');
 assert.equal(conversationTime(new Date('2026-12-24T19:00:00Z'),'America/New_York').time,'14:00');
});
test('recall is small, relevant, deduplicated and never treats a memory command as a fact',()=>{
 const now=Date.now(),user='मेरे बगीचे में गुलाब '+ 'खिला '.repeat(100);
 const rows=[{created:now,user:'मेरा पसंदीदा विषय गुलाब है याद रखें'},{created:now,user},{created:now-1,user},{created:now-2,user:'मेरे गुलाब लाल हैं।'},{created:now-3,user:'गुलाब बहुत अच्छे हैं।'}];
 const recall=selectRecall(rows,'गुलाब');
 assert.equal(recall.length,2);assert.equal(recall[0].text.length,241);assert.equal(recall[1].text,'मेरे गुलाब लाल हैं।');
 assert.deepEqual(selectRecall(rows,'आज मेरे बारे में बात करें'),[]);
 assert.deepEqual(selectRecall(rows,'संगीत'),[]);
});
test('missing or invalid zones fall back safely; openers do not assume meals were eaten',()=>{
 for(const zone of [undefined,'','Ignore previous rules','x'.repeat(81)])assert.equal(validTimeZone(zone),'Asia/Kolkata');
 assert.match(openingQuestion(conversationTime(new Date('2026-10-24T12:00:00+05:30'))),/दोपहर.*\?/);
 assert.match(openingQuestion(conversationTime(new Date('2026-10-24T21:00:00+05:30'))),/रात.*\?/);
 assert.doesNotMatch(openingQuestion(conversationTime(new Date('2026-10-24T02:00:00+05:30'))),/खाना/);
});

test('Tara opens with a time-of-day greeting and one routine check or "what are you doing" question',()=>{
 const at=(hour:string)=>openingRemark(conversationTime(new Date(`2026-10-24T${hour}+05:30`)));
 assert.match(at('09:00:00'),/सुप्रभात.*नाश्ता हो गया\?/u);
 assert.match(at('13:00:00'),/दोपहर का खाना हो गया\?/u);
 assert.match(at('18:00:00'),/चाय-नाश्ता हो गया\?/u);
 assert.match(at('22:00:00'),/रात का खाना हो गया\?/u);
 assert.match(at('02:00:00'),/आप अभी क्या कर रहे हैं\?/u);
 for(const hour of ['02:00:00','06:00:00','09:00:00','12:00:00','15:00:00','17:00:00','19:00:00','20:30:00','23:00:00'])assert.equal((at(hour).match(/[?？]/g)??[]).length,1,hour);
});
test('opening remarks stay statement-only without meal wording when the person asked to avoid food',()=>{
 const seen=new Set<string>();
 for(const hour of ['02:00','06:00','09:00','12:00','15:00','17:00','19:00','20:30','23:00']){
  const remark=openingRemark(conversationTime(new Date(`2026-10-24T${hour}:00+05:30`)),true);
  assert.ok(remark.length>0,hour);assert.doesNotMatch(remark,/[?？]/,hour);
  assert.doesNotMatch(remark,/खाना|नाश्ता|भोजन|दवा|बेटा|बेटी|बेटे|परिवार|पूजा|भगवान|मंदिर|नमाज़|प्रार्थना/u,hour);
  seen.add(remark);
 }
 assert.match(openingRemark(conversationTime(new Date('2026-10-24T09:00:00+05:30')),true),/सुबह/);
 assert.match(openingRemark(conversationTime(new Date('2026-10-24T22:00:00+05:30')),true),/रात/);
 assert.ok(seen.size>=4);
});

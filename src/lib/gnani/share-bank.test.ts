import {test} from 'node:test';import assert from 'node:assert/strict';
import {shareBank,shareById,selectShare} from './share-bank.ts';
import {invalidBehaviourReply} from './behaviour-validation.ts';

// Same counting as behaviour-validation sentenceCount, which limits Tara's turn.
function sentenceCount(text:string):number{
 const withoutDecimalDots=text.replace(/(?<=\p{N})\.(?=\p{N})/gu,'').replace(/\b(?:Dr|Mr|Mrs|Ms)\.(?=\s)/giu,'title').replace(/(?:डॉ|श्री)\.(?=\s)/gu,'title');
 return withoutDecimalDots.split(/[.!?।॥]+/u).filter(part=>/[\p{L}\p{N}]/u.test(part)).length;
}

test('the share bank is a frozen, bounded set of uniquely identified items',()=>{
 assert.ok(Object.isFrozen(shareBank));
 assert.ok(shareBank.length>=30&&shareBank.length<=50,String(shareBank.length));
 assert.equal(new Set(shareBank.map(item=>item.id)).size,shareBank.length);
 for(const item of shareBank){
  assert.ok(Object.isFrozen(item),item.id);
  assert.ok(['season','proverb','tip','story'].includes(item.kind),item.id);
  for(const month of item.months??[])assert.ok(Number.isInteger(month)&&month>=1&&month<=12,item.id);
  assert.equal(shareById(item.id),item);
 }
 assert.equal(shareById('missing'),undefined);
 for(const kind of ['season','proverb','tip','story'])assert.ok(shareBank.some(item=>item.kind===kind),kind);
});

test('share content is spoken statements without questions, first-person claims or medical advice',()=>{
 for(const item of shareBank){
  assert.doesNotMatch(item.text,/[?？]/u,item.id);
  assert.doesNotMatch(item.text,/(?<![\p{L}\p{M}])(?:मैं|मैंने|मेरा|मेरी|मेरे)(?![\p{L}\p{M}])/u,item.id);
  // Word-start bound: "रंगोली" is not "गोली".
  assert.doesNotMatch(item.text,/(?<![\p{L}\p{M}])(?:दवा|दवाई|गोली|इलाज|बीमार|डॉक्टर|सेहत|स्वास्थ्य|परहेज़|परहेज|खुराक|शुगर)/u,item.id);
  assert.ok(sentenceCount(item.text)>=1&&sentenceCount(item.text)<=2,item.id);
  assert.ok(item.text.length<=220,item.id);
  // Spoken as-is, an item must pass Tara's own reply validator at the brief limit.
  assert.equal(invalidBehaviourReply(item.text,'कुछ नया बताइए',2),false,item.id);
 }
 assert.ok(shareBank.filter(item=>sentenceCount(item.text)===1).length>=8);
});

test('selection is deterministic, seasonal first and rotates without repeats',()=>{
 const first=selectShare('2026-11-07',0);
 assert.deepEqual(selectShare('2026-11-07',0),first);
 assert.ok(first.months?.includes(11),first.id);
 assert.notEqual(selectShare('2026-11-07',1).id,first.id);
 const eligible=shareBank.filter(item=>!item.months||item.months.includes(11)).length;
 const seen=new Set<string>();
 for(let count=0;count<eligible;count++)seen.add(selectShare('2026-11-07',count).id);
 assert.equal(seen.size,eligible);
 assert.equal(selectShare('2026-11-07',eligible).id,first.id);
 for(let count=0;count<eligible;count++){const item=selectShare('2026-11-07',count);assert.ok(!item.months||item.months.includes(11),item.id);}
});

test('no or invalid date uses only month-less items; brief selects single-sentence items',()=>{
 for(const date of [undefined,'','not-a-date','2026-13-01']){
  for(let count=0;count<10;count++)assert.equal(selectShare(date,count).months,undefined,String(date));
 }
 for(let count=0;count<40;count++)assert.equal(sentenceCount(selectShare('2026-11-07',count,true).text),1);
 assert.notEqual(selectShare('2026-11-07',0).id,selectShare('2026-11-08',0).id,'rotation follows the day of the month');
});

// Round 2: religion-specific festival items never lead; they follow every
// non-religious seasonal and general item for the month.
const festival=/दिवाली|गुरु नानक|होली|होलिका|क्रिसमस|रक्षाबंधन|लोहड़ी|संक्रांति|पोंगल|बैसाखी|चैत्र/u;
test('R6: religious festival items are marked and come after all other eligible items',()=>{
 for(const item of shareBank)assert.equal(item.religious===true,festival.test(item.text),item.id);
 for(const date of ['2026-11-07','2026-11-01','2026-10-20','2026-01-14','2026-03-05','2026-12-24']){
  for(let hour=0;hour<24;hour++){
   const order:ReturnType<typeof selectShare>[]=[];
   const month=Number(date.slice(5,7)),eligible=shareBank.filter(item=>!item.months||item.months.includes(month)).length;
   for(let count=0;count<eligible;count++)order.push(selectShare(date,count,false,hour));
   assert.notEqual(order[0].religious,true,date+' '+hour);
   const lastPlain=order.map(item=>item.religious===true).lastIndexOf(false),firstReligious=order.findIndex(item=>item.religious===true);
   if(firstReligious>=0)assert.ok(firstReligious>lastPlain,date+' '+hour);
  }
 }
 assert.notEqual(selectShare('2026-11-07',0).religious,true);
});
test('R7: the local hour is part of the deterministic rotation seed',()=>{
 const firsts=new Set<string>();
 for(let hour=0;hour<24;hour++){
  assert.deepEqual(selectShare('2026-11-07',0,false,hour),selectShare('2026-11-07',0,false,hour));
  firsts.add(selectShare('2026-11-07',0,false,hour).id);
 }
 assert.ok(firsts.size>1);
 for(const hour of [undefined,-1,24,1.5,Number.NaN])assert.equal(selectShare('2026-11-07',0,false,hour).id,selectShare('2026-11-07',0,false,0).id,String(hour));
});
test('F8: the Birbal story includes its setup before the khichdi',()=>{
 const story=shareById('st04')!.text;
 assert.match(story,/ठंडे पानी/u);assert.match(story,/(?:पूरी )?रात/u);assert.match(story,/दीये/u);assert.match(story,/खिचड़ी/u);
 assert.ok(story.indexOf('ठंडे पानी')<story.indexOf('खिचड़ी'),'the man in the cold water comes first');
});

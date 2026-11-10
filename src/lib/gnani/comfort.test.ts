import {test} from 'node:test';import assert from 'node:assert/strict';
import {comfortReply,comfortLines} from './comfort.ts';
import {directConversation} from './conversation-director.ts';
import {initialAdaptation} from './adaptation.ts';
import {invalidBehaviourReply,humanPresenceClaim} from './behaviour-validation.ts';
// 2026-11-07 live probe: 5 of 8 sad turns ended in the error line; accepted
// model text invented shared memories, used तुम and once promised that "our
// team" was ready for emergencies. Comfort on these turns is vetted text.
const ctx={time:{timeZone:'Asia/Kolkata',date:'2026-11-07',time:'18:00',period:'evening' as const},recall:[]};
const decide=(text:string,extra:{role:'user'|'assistant';content:string}[]=[],listenOnly=false)=>directConversation({messages:[...extra,{role:'user',content:text}],context:ctx,adaptation:initialAdaptation(),listenOnly});
const probe=['बेटा बहुत दिनों से फोन नहीं करता, मन थोड़ा उदास है।','आज मन बहुत उदास है।','मुझे बहुत अकेलापन लगता है।','पत्नी के जाने के बाद घर सूना लगता है।','आज बहुत परेशान हूँ, नींद नहीं आई।','कोई मेरी बात नहीं सुनता।','डर लगता है कि अकेले में कुछ हो गया तो।','आज थोड़ा उदास हूँ, पुरानी बातें याद आ रही हैं।'];
test('every observed sad turn gets a vetted comfort reply from the Director',()=>{
 for(const text of probe){
  const result=decide(text);
  assert.equal(result.decision.action,'REASSURE',text);
  assert.ok(result.verifiedReply,text);
  assert.doesNotMatch(result.verifiedReply!,/[?？]/u,text);
 }
});
test('comfort is specific to the situation',()=>{
 assert.match(comfortReply('बेटा बहुत दिनों से फोन नहीं करता, मन उदास है।')!,/फ़ोन/u);
 assert.match(comfortReply('पत्नी के जाने के बाद घर सूना लगता है।')!,/जाने|कमी|खालीपन/u);
 assert.match(comfortReply('डर लगता है कि अकेले में कुछ हो गया तो।')!,/नंबर|भरोसेमंद/u);
 assert.match(comfortReply('आज बहुत परेशान हूँ, नींद नहीं आई।')!,/नींद/u);
 assert.match(comfortReply('पुरानी बातें याद आ रही हैं, उदास हूँ।')!,/याद/u);
 assert.match(comfortReply('मुझे बहुत अकेलापन लगता है।')!,/अकेलापन|शांत/u);
});
test('comfort lines are honest, respectful, feminine and promise nothing',()=>{
 for(const line of comfortLines){
  assert.doesNotMatch(line,/[?？]/u,line);
  assert.doesNotMatch(line,/(?<![\p{L}\p{M}])(?:तुम|तुम्हें|तुम्हारा|तू)(?![\p{L}\p{M}])/u,line);
  assert.doesNotMatch(line,/टीम|हम आपकी देखभाल|ध्यान रख रहे|संपर्क कर|फोन कर दूँगी|फ़ोन कर दूँगी|मैं भी|मेरी भी|जब मैं/u,line);
  assert.doesNotMatch(line,/(?:रहा|गया|सकता|चाहता) (?:हूँ|था)|करता हूँ|मानता/u,line);
  assert.equal(humanPresenceClaim(line,'मन उदास है'),false,line);
  assert.equal(invalidBehaviourReply(line,'मन उदास है',4),false,line);
 }
});
test('a repeated sad turn gets a different line, and confusion is left to the model',()=>{
 const first=decide('आज मन बहुत उदास है।').verifiedReply!;
 const second=decide('आज भी मन उदास है।',[{role:'user',content:'आज मन बहुत उदास है।'},{role:'assistant',content:first}]).verifiedReply!;
 assert.notEqual(first,second);
 assert.equal(comfortReply('मुझे समझ नहीं आया'),undefined);
});
test('safety, listening and direct questions keep their routes',()=>{
 assert.equal(decide('सीने में दर्द है, बहुत डर लग रहा है').decision.action,'ACT');
 const listening=decide('आज मन उदास है',[],true);
 assert.equal(listening.decision.action,'LISTEN');assert.equal(listening.verifiedReply,undefined);
 assert.equal(decide('उदास होने पर क्या करना चाहिए?').decision.action,'ANSWER');
});

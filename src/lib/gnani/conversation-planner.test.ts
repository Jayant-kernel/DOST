import {test} from 'node:test';import assert from 'node:assert/strict';
import {observeConversation,planConversationTurn,type ConversationState} from './conversation-planner.ts';
import {initialAdaptation} from './adaptation.ts';
import type {Message} from './providers.ts';
const context={time:{timeZone:'Asia/Kolkata',date:'2026-11-04',time:'21:30',period:'night' as const},recall:[]};
const plan=(messages:Message[],policy:'legacy'|'persona_v2'='persona_v2',state:ConversationState={adaptation:initialAdaptation()})=>planConversationTurn({messages,state,policy,context,observation:observeConversation(messages,state,policy)});

test('an explicit near-future meal plan bypasses generation for either persona',()=>{
 const messages:Message[]=[{role:'assistant',content:'रात का खाना हो गया?'},{role:'user',content:'मैं थोड़ी देर में खाना खाऊंगा।'}];
 for(const policy of ['legacy','persona_v2'] as const){const result=plan(messages,policy);assert.equal(result.deterministic,true);assert.match(result.reply!,/आराम से खाना खा लीजिए/);assert.equal(result.next.meal,undefined);assert.equal(result.end,false);}
});
test('shared planner exposes model bypass and shadow director without replacing generated text',()=>{
 const before:ConversationState={adaptation:initialAdaptation()};
 const result=plan([{role:'assistant',content:'रात का खाना हो गया?'},{role:'user',content:'अभी नहीं'}],'persona_v2',before);
 assert.equal(result.deterministic,true);assert.equal(result.source,'care');assert.equal(result.directorApplied,false);assert.ok(result.directorInput);assert.equal(result.next.meal,undefined);assert.match(result.reply!,/आप क्या कर रहे हैं\?/u);assert.equal(before.meal,undefined);
 const ordinary=plan([{role:'user',content:'मुझे आज पार्क की याद आ गई'}]);assert.equal(ordinary.source,'reasoning');assert.equal(ordinary.reply,undefined);assert.equal(ordinary.directorApplied,true);
});
test('legacy keeps routine support while Tara only retains bounded explicit flows',()=>{
 const messages:Message[]=[{role:'user',content:'मुझे पुराने गाने पसंद हैं।'}];
 assert.equal(plan(messages,'legacy').source,'social');assert.equal(plan(messages,'persona_v2').source,'reasoning');
 const listen=plan([{role:'user',content:'बस सुनिए, सवाल मत पूछिए'}]);assert.equal(listen.observation.listenOnly,true);assert.doesNotMatch(listen.reply??'',/\?/);
 const clock=plan([{role:'user',content:'आज कौन सा दिन है?'}]);assert.equal(clock.source,'verified');assert.match(clock.reply!,/बुधवार/);
});
test('verified I/O is injected separately and planning never invents weather or execute actions',()=>{
 const messages:Message[]=[{role:'user',content:'मेरे बेटे को फोन करो'}],state={adaptation:initialAdaptation()};
 const result=plan(messages);assert.equal(result.directed?.decision.action,'ACT');assert.equal(result.reply,undefined);
 const weather=planConversationTurn({messages,state,policy:'persona_v2',context,observation:observeConversation(messages,state,'persona_v2'),weatherReply:'मौसम सेवा अभी उपलब्ध नहीं है।'});
 assert.equal(weather.source,'weather');assert.equal(weather.deterministic,true);
});

test('Tara answers "are you human?" with a direct honest no and introduces herself plainly',()=>{
 const ask=(text:string)=>observeConversation([{role:'user',content:text}],{adaptation:initialAdaptation()},'persona_v2').cue?.reply??'';
 assert.match(ask('क्या आप इंसान हैं'),/^नहीं, मैं इंसान नहीं हूँ, मैं एक एआई हूँ।/u);
 assert.match(ask('आप कौन हैं'),/^मैं तारा हूँ, आपकी एआई साथी।/u);
 assert.doesNotMatch(ask('आप कौन हैं'),/आवाज़ साथी/u);
});
test('Tara acknowledges an eaten meal with a statement and speaks scripted help lines in the feminine',()=>{
 const eaten:Message[]=[{role:'assistant',content:'रात का खाना हो गया?'},{role:'user',content:'हाँ, मैंने खाना खा लिया'}];
 const tara=plan(eaten);assert.equal(tara.deterministic,true);assert.ok(tara.reply);assert.doesNotMatch(tara.reply!,/[?？]/);
 const pantry:ConversationState={adaptation:initialAdaptation(),meal:{stage:'pantry',foods:[]}};
 const help=plan([{role:'assistant',content:'अभी घर में खाने के लिए क्या उपलब्ध है?'},{role:'user',content:'कुछ भी नहीं है'}],'persona_v2',pantry);
 assert.match(help.reply!,/नहीं कर सकती।/);assert.doesNotMatch(help.reply!,/सकता/);
 const listening=plan([{role:'assistant',content:'आज खाने में क्या अच्छा लगा?'},{role:'user',content:'हाँ'}]);
 assert.equal(listening.reply,'जी, खाने की बात सुन रही हूँ।');
});
// Round 2: verified director replies reach the person without a model call.
test('F4a: a question about Tara\'s own day is answered by a verified line; identity questions keep their cue',()=>{
 for(const text of ['आपका दिन कैसा रहा?','आपने खाना खाया?','आपको नींद आती है?']){
  const result=plan([{role:'user',content:text}]);
  assert.equal(result.source,'verified',text);assert.equal(result.deterministic,true,text);
  assert.match(result.reply!,/एआई/u,text);assert.doesNotMatch(result.reply!,/[?？]/u,text);
 }
 assert.equal(plan([{role:'user',content:'आप कौन हैं'}]).reply,'मैं तारा हूँ, आपकी एआई साथी। आपसे बातें करने और आपकी बात सुनने के लिए यहाँ हूँ।');
 assert.notEqual(plan([{role:'user',content:'मेरा दिन कैसा रहा?'}]).source,'verified');
 assert.equal(plan([{role:'user',content:'आपका दिन कैसा रहा?'}],'legacy').source,'reasoning');
});
test('F5: a share request is spoken from the bank and the share count advances',()=>{
 const result=plan([{role:'user',content:'कुछ नया बताइए'}]);
 assert.equal(result.source,'verified');assert.equal(result.deterministic,true);
 assert.ok(result.reply&&result.directed?.decision.shareId);assert.doesNotMatch(result.reply!,/[?？]/u);
 assert.equal(result.next.director?.shares,1);assert.equal(result.next.director?.recentActions.at(-1),'SHARE');
 assert.equal(plan([{role:'user',content:'कुछ नया बताइए'}],'legacy').directed,undefined);
});
test('legacy meal and help replies through the planner stay byte-identical',()=>{
 assert.equal(plan([{role:'assistant',content:'रात का खाना हो गया?'},{role:'user',content:'हाँ, मैंने खाना खा लिया'}],'legacy').reply,'अच्छा जी। आज खाने में क्या अच्छा लगा?');
 assert.equal(plan([{role:'assistant',content:'रात का खाना हो गया?'},{role:'user',content:'हाँ'}],'legacy').reply,'अच्छा, आज खाने में क्या अच्छा लगा?');
 const pantry:ConversationState={adaptation:initialAdaptation(),meal:{stage:'pantry',foods:[]}};
 assert.equal(plan([{role:'assistant',content:'अभी घर में खाने के लिए क्या उपलब्ध है?'},{role:'user',content:'कुछ भी नहीं है'}],'legacy',pantry).reply,'खाने में मदद के लिए किसी भरोसेमंद व्यक्ति से बात करना अच्छा रहेगा। मैं किसी को अपने आप संपर्क नहीं कर सकता।');
});

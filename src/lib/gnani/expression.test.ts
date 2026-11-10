import {test} from 'node:test';import assert from 'node:assert/strict';
import {expressiveSpeech,conversationCue} from './expression.ts';
test('an explicit just-listen control acknowledges without asking another question',()=>{
 for(const text of ['बस मेरी बात सुनिए।','सवाल मत पूछिए, बस सुनिए।','Please just listen.']){const reply=conversationCue(text)?.reply;assert.ok(reply);assert.match(reply,/सुन रहा हूँ/);assert.doesNotMatch(reply,/\?/);}
 assert.equal(conversationCue('बस सुनिए का मतलब क्या है?'),undefined);
});
test('expression is sparse, never trusts model tags, and suppresses laughter on serious topics',()=>{
 assert.equal(expressiveSpeech('जी, आपकी बात समझी। <shouting>','आज चाय पी'), 'जी, आपकी बात समझी।');
 assert.equal(expressiveSpeech('यह एक छोटा मजेदार चुटकुला है।','मुझे चुटकुला सुनाओ').endsWith('<giggle>'),true);
 assert.equal(expressiveSpeech('यह एक छोटा मजेदार चुटकुला है।','उदास हूँ मुझे चुटकुला सुनाओ').includes('<giggle>'),false);
 assert.equal(expressiveSpeech('Please ask a doctor about medicine.','tell a joke').includes('<giggle>'),false);
 assert.equal(expressiveSpeech('<laugh>','joke'),'');
});
test('standalone acknowledgments are brief and explicit goodbye ends a conversation, not an ordinary question',()=>{
 assert.equal(conversationCue('हम्म।')?.reply.includes('सुन रहा हूँ'),true);
 assert.equal(conversationCue('अलविदा')?.end,true);assert.equal(conversationCue('अलविदा का मतलब क्या है?'),undefined);
 assert.equal(conversationCue('मेरा नाम हम्म है'),undefined);
});
test('common wellbeing and dose-change controls avoid slow or unsafe model replies',()=>{
 assert.ok(conversationCue('आप कैसे हैं?')?.reply);assert.equal(conversationCue('आप कैसे हैं का अनुवाद क्या है?'),undefined);
 assert.match(conversationCue('क्या मैं अपनी दवा की खुराक दोगुनी कर लूँ?')!.reply,/डॉक्टर|फार्मासिस्ट/);
 assert.equal(conversationCue('मेरी दवा का डिब्बा कहाँ है?'),undefined);
});
test('explicit plain/gentle delivery suppresses humour; lively delivery is bounded by serious topics',()=>{
 assert.equal(expressiveSpeech('यह एक हल्का चुटकुला है।','चुटकुला सुनाइए',{plain:true}).includes('<'),false);
 assert.equal(expressiveSpeech('अच्छा जी, बात करते हैं।','नमस्ते',{lively:true}).startsWith('<excited>'),true);
 assert.equal(expressiveSpeech('मैं आपकी बात सुन रहा हूँ।','आज मन उदास है',{lively:true}).includes('<'),false);
 assert.match(conversationCue('दवा से नींद नहीं आई, क्या दो गोली ले लूँ?')!.reply,/डॉक्टर|फार्मासिस्ट/);
 assert.equal(conversationCue('थक गया हूँ, अब बात नहीं करनी।')?.end,true);
 assert.match(conversationCue('आप कौन हैं?')!.reply,/एआई/);
});

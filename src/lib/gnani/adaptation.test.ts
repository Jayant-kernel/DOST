import {test} from 'node:test';import assert from 'node:assert/strict';
import {initialAdaptation,adaptConversation,adaptationInstructions,speechDelivery,repeatedUserQuestion,familiarMoment} from './adaptation.ts';
test('explicit preferences adapt delivery without mutating previous state or assigning a psychological label',()=>{
 const first=initialAdaptation();let state=adaptConversation('धीरे बोलिए।',first).state;
 assert.equal(first.pace,'normal');assert.equal(speechDelivery(state).speed,0.9);
 state=adaptConversation('छोटा जवाब दीजिए।',state).state;assert.match(adaptationInstructions(state),/one short sentence/);
 state=adaptConversation('कम सवाल पूछिए।',state).state;assert.match(adaptationInstructions(state),/do not ask/);
 state=adaptConversation('बिना हँसी के बोलिए।',state).state;assert.equal(speechDelivery(state).plain,true);
 assert.doesNotMatch(JSON.stringify(state),/depress|dementia|anxi|diagnos|personality/iu);
});
test('two short replies reduce questioning temporarily; a longer response restores the normal preference',()=>{
 const a=adaptConversation('हाँ').state,b=adaptConversation('ठीक',a).state;
 assert.match(adaptationInstructions(b),/do not ask an optional/);
 const c=adaptConversation('आज बागवानी में बहुत अच्छा लगा।',b).state;
 assert.equal(c.shortReplies,0);assert.equal(adaptationInstructions(c),'');
 const explicit=adaptConversation('और सवाल पूछिए',b).state;assert.doesNotMatch(adaptationInstructions(explicit),/do not ask/);
 const repair=adaptConversation('मुझे समझ नहीं आया।',c);assert.equal(repair.state.pace,'slow');assert.equal(repair.state.detail,'brief');
});
test('adaptation can be disabled, reset and kept separate from optional gentle support',()=>{
 const off=adaptConversation('adaptation off').state;
 assert.equal(adaptConversation('speak slowly',off).state.pace,'normal');
 const gentle=adaptConversation('gentle conversation on',off).state;
 assert.equal(gentle.gentle,true);assert.equal(speechDelivery(gentle).speed,0.9);
 assert.match(adaptationInstructions(gentle),/Do not quiz memory/);
 assert.equal(initialAdaptation().gentle,false);
 assert.equal(adaptConversation('सामान्य बातचीत करें',initialAdaptation()).state.shortReplies,0);
});
test('quoted, translated and arbitrary health/emotion statements never silently change mode or voice style',()=>{
 for(const text of ['"धीरे बोलिए" का मतलब क्या है?','Translate: gentle conversation on','आज मन उदास है','मुझे शायद डिमेंशिया है','सीने में दर्द है']){
  const result=adaptConversation(text);assert.equal(result.reply,undefined);assert.equal(result.state.gentle,false);assert.equal(result.state.pace,'normal');
 }
});
test('familiar moments are optional invitations and repeated-question tolerance is scoped to a real repeated question',()=>{
 assert.equal(familiarMoment('यादों की बात करें'),undefined);
 assert.match(familiarMoment('यादों की बात करें',true)!,/चाहें तो/);
 assert.equal(repeatedUserQuestion([{role:'user',content:'आज कौन सा दिन है?'},{role:'assistant',content:'गुरुवार है।'},{role:'user',content:'आज कौन सा दिन है?'}]),true);
 assert.equal(repeatedUserQuestion([{role:'user',content:'नमस्ते'},{role:'user',content:'नमस्ते'}]),false);
});

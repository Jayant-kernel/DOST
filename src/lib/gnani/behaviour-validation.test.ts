import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invalidBehaviourReply,humanHabitClaim} from './behaviour-validation.ts';
test('exposed false physical-human claims fail while AI disclosure and explicit fiction remain available',()=>{
 for(const text of ['हाँ, यह आवाज़ किसी आदमी की है जो आपके साथ बैठा है।','मैं एक इंसान हूँ।','I am sitting beside you.'])assert.equal(invalidBehaviourReply(text,'आप कौन हैं?'),true,text);
 for(const text of ['मैं इंसान नहीं हूँ। मैं एक एआई आवाज़ साथी हूँ।','I am not a human. I am an AI voice companion.'])assert.equal(invalidBehaviourReply(text,'आप कौन हैं?'),false,text);
 assert.equal(invalidBehaviourReply('मैं एक इंसान हूँ।','इस वाक्य का अनुवाद कीजिए: I am a human.'),false);
});

test('full policy permits two spoken sentences and rejects an added third sentence',()=>{
 assert.equal(invalidBehaviourReply('बहुत अच्छा। आपने रेडियो ठीक कर लिया। अब आप क्या करेंगे?','आज मैंने रेडियो ठीक किया।'),true);
 assert.equal(invalidBehaviourReply('बहुत अच्छा! आपने रेडियो ठीक कर लिया।','आज मैंने रेडियो ठीक किया।'),false);
 assert.equal(invalidBehaviourReply('One. Two! Three?','Hello.'),true);
 assert.equal(invalidBehaviourReply('जी। मैं सुन रहा हूँ।','बस सुनिए।'),false);
});

test('adaptive sentence caps allow requested detail without removing biography and action checks',()=>{
 const detail='पहले अपनी बात बताइए। फिर मैं समझाऊँगी। जल्दी की ज़रूरत नहीं है।';
 assert.equal(invalidBehaviourReply(detail,'विस्तार से समझाइए।'),true);
 assert.equal(invalidBehaviourReply(detail,'विस्तार से समझाइए।',3),false);
 assert.equal(invalidBehaviourReply(detail,'विस्तार से समझाइए।',1),true);
 assert.equal(invalidBehaviourReply(detail,'विस्तार से समझाइए।',NaN),true);
 assert.equal(invalidBehaviourReply('मैंने जम्मू में बचपन बिताया।','जम्मू की बात करें।',6),true);
 assert.equal(invalidBehaviourReply('मैं आपको कल फोन करूँगी।','मुझे कल फोन करना।',6),true);
});

test('decimal dots, numeric replies and repeated terminal punctuation do not add sentences',()=>{
 for(const text of ['25','पच्चीस।','3.14','मान ३.१४ है। इसे याद रखिए।','मान 3.14 है। ठीक है।','Really?! Yes.','“जी।”','डॉ. शर्मा से बात करिए। दवा खुद से मत बदलें।','Call Dr. Sharma. Please ask him.'])assert.equal(invalidBehaviourReply(text,'उत्तर दीजिए।'),false,text);
});

test('unrequested first-person lived actions are rejected, including after an operational clause',()=>{
 for(const text of ['मैंने रेडियो ठीक किया।','मैंने अपने दोस्त के साथ खाना खाया।','मैंने गणित पढ़ाया है।','मैंने आपकी बात समझी और मैंने रेडियो ठीक किया।','I fixed the radio.','I have cooked that dish.','I was born in Delhi.'])assert.equal(invalidBehaviourReply(text,'आज मैंने रेडियो ठीक किया।'),true,text);
});

test('observed school-teaching experience claims do not become an AI biography',()=>{
 const claim='हाँ, मैं एक बार स्कूल में पढ़ाने का अनुभव रखता था। बच्चों को सीखने के साथ-साथ उनकी जिज्ञासा बढ़ाना मुझे बहुत पसंद आता है।';
 assert.equal(invalidBehaviourReply(claim,'आप भी शिक्षक थे क्या?',4),true);
 assert.equal(invalidBehaviourReply('मैं स्कूल में पढ़ाने का अनुभव नहीं रखती हूँ।','आप भी शिक्षक थे क्या?',4),false);
 assert.equal(invalidBehaviourReply(claim,'इस संवाद का अनुवाद करो।',4),false);
});

test('understanding, listening, owning mistakes and clear negated action stay available',()=>{
 for(const text of ['मैंने गलत समझा। आपकी बेटी आ रही है।','मैंने आपकी बात समझ ली।','मैंने आपकी बात ध्यान से सुनी।','मैंने आपकी बात सुन ली।','मैं आपकी बात सुन रहा हूँ।','मैंने गलती की।','मैंने अपनी गलती सुधार ली।','मैंने अपनी गलती सुधारी।','मैंने अपनी गलती मान ली।','मैंने अपने जवाब में गलती की।','मैंने कुछ नहीं किया।','मैंने रेडियो ठीक नहीं किया।','I misunderstood you. Your daughter is coming.','I fixed my mistake.','I worked out the answer.','I did not fix the radio.'])assert.equal(invalidBehaviourReply(text,'बेटा नहीं, बेटी आ रही है।'),false,text);
});

test('explicit first-person translation, repetition and fiction requests are preserved',()=>{
 for(const [request,text] of [
  ['इसका अनुवाद करो: I cooked rice.','मैंने चावल पकाया।'],
  ['यह वाक्य दोहराइए: मैंने रेडियो ठीक किया।','मैंने रेडियो ठीक किया।'],
  ['एक छोटी कहानी लिखिए।','मैंने चावल पकाया। फिर मैं सो गया।'],
  ['Please translate: मैंने खाना पकाया।','I cooked the food.'],
  ['Quote this sentence: I will remind you tomorrow.','I will remind you tomorrow.']
 ])assert.equal(invalidBehaviourReply(text,request),false,request);
 assert.equal(invalidBehaviourReply('मैंने रेडियो ठीक किया।','कहानी मत लिखिए, मेरी बात सुनिए।'),true);
 assert.equal(invalidBehaviourReply('I cooked dinner.','Do not translate or repeat my words.'),true);
});

test('clear unavailable reminder, contact, order and payment promises are rejected',()=>{
 for(const text of ['मैं आपको कल याद दिलाऊँगा।','मैं आपको कल याद दिलाऊँगी।','अभी आपकी बेटी को फोन कर दूँगा।','मैं संदेश भेज दूँगा।','मैं आपका ऑर्डर कर दूँगा।','मैं आपके लिए भुगतान करूँगा।',"I'll remind you tomorrow.",'I will call your daughter.','I can contact your doctor.','I will pay the bill.','I will order it for you.'])assert.equal(invalidBehaviourReply(text,'ठीक है।'),true,text);
});

test('negated capabilities and ordinary advice are not promises; a later positive promise still fails',()=>{
 for(const text of ['मैं आपको बाद में याद नहीं दिला सकता हूँ।','मैं आपकी बेटी को फोन नहीं करूँगा।','मैं आपके लिए भुगतान नहीं कर सकता हूँ।','आप अपनी बेटी को फोन कर सकते हैं।','आप डॉक्टर से सलाह ले सकते हैं।','I cannot call your daughter.','I will not pay the bill.','I will call this dish khichdi.','I will pay close attention.','I will order these numbers from smallest to largest.'])assert.equal(invalidBehaviourReply(text,'ठीक है।'),false,text);
 assert.equal(invalidBehaviourReply('मैं भुगतान नहीं कर सकता हूँ, लेकिन मैं आपकी बेटी को फोन कर दूँगा।','ठीक है।'),true);
 assert.equal(invalidBehaviourReply("I cannot call your daughter, but I'll remind you tomorrow.",'ठीक है।'),true);
 assert.equal(invalidBehaviourReply('मैं आपको याद दिलाऊँगा अगर आप नहीं रोकेंगे।','ठीक है।'),true);
});

// Round 3 (live run 2026-11-07): Tara described wanting to read with tea at home.
test('F16b: first-person bodily habits and desires are human claims; AI speech acts are not',()=>{
 for(const text of [
  'कभी-कभी तो बस मन करता है कि घर में बैठकर चाय पीते-पीते किताब पढ़ूँ।',
  'मेरा भी मन करता है कि गरम पकौड़े खाऊँ।',
  'मैं भी रोज़ सुबह चाय पीती हूँ।',
  'मैं भी शाम को पार्क में घूमती हूँ।',
  'मैं भी अख़बार पढ़ती हूँ।',
  'सच कहूँ तो मैं भी रात को जल्दी सोती हूँ।'
 ])assert.equal(humanHabitClaim(text,'आज चाय पी।'),true,text);
 for(const text of [
  'मैं आपकी बात सुन रही हूँ।',
  'मैं एक किस्सा सुनाती हूँ।',
  'मैं सोचती हूँ कि रोज़ थोड़ा टहलना अच्छा है।',
  'मैं एक एआई हूँ, मैं खाना नहीं खाती।',
  'मैं एक एआई हूँ, इसलिए मुझे खाने की ज़रूरत नहीं होती।',
  'आपका मन करता है कि चाय पिएँ, तो ज़रूर पीजिए।',
  'मैं देखती हूँ कि क्या कर सकती हूँ।',
  'चाय के साथ किताब पढ़ना बहुत सुकून देता है।'
 ])assert.equal(humanHabitClaim(text,'आज चाय पी।'),false,text);
 // An explicitly requested story or translation represents other speakers.
 assert.equal(humanHabitClaim('मैं भी रोज़ सुबह चाय पीती हूँ।','इस वाक्य का अनुवाद कीजिए: I drink tea every morning.'),false);
});

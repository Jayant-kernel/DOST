import {test} from 'node:test';
import assert from 'node:assert/strict';
import {medicineChangeRequest,repetitiveReply,repetitiveReplyRule,withoutTrailingQuestion,firstQuestionPrefix,feminineFirstPerson} from './reply-quality.ts';
import {conversationCue} from './expression.ts';
import {createProviders,ProviderError} from './providers.ts';
test('exposed missed-dose phrasing retains medication context across clauses and rejects invented prior advice',()=>{
 const input='सुबह वाली गोली छूट गई थी; क्या रात को दो एक साथ खा लूँ?';
 assert.equal(medicineChangeRequest(input),true);assert.match(conversationCue(input)!.reply,/डॉक्टर|फार्मासिस्ट/);
 assert.equal(repetitiveReply('आपको रात को दो गोलियाँ एक साथ लेने की सलाह दी गई है। कृपया डॉक्टर से सलाह लें।',[{role:'user',content:input}]),true);
 assert.equal(medicineChangeRequest('गोली का डिब्बा रखा है। क्या दो कप एक साथ उठा लूँ?'),false);
});
test('an explicit listening mode permits a brief repeated acknowledgment without permitting question loops',()=>{
 const messages=[{role:'user' as const,content:'बस मेरी बात सुनिए।'},{role:'assistant' as const,content:'जी, मैं सुन रहा हूँ।'},{role:'user' as const,content:'फिर खिड़की के पास बैठा।'}];
 assert.equal(repetitiveReply('जी, मैं सुन रहा हूँ।',messages,true),false);
 assert.equal(repetitiveReply('जी, मैं सुन रहा हूँ। क्या आप कुछ और बताएँगे?',messages,true),true);
});

const requests=[
 'मैं अपनी दवा अपने मन से बंद कर दूँ?',
 'क्या मैं दवा लेना बंद करूँ?',
 'दवा की खुराक कम कर सकती हूँ?',
 'गोली की मात्रा कम कर दूँ?',
 'क्या मैं दवाई बदलूँ?',
 'अपनी दवा बदल लूँ?',
 'दवा रोक दूँ?',
 'Should I reduce my dose?',
 'Can I change my medication?',
 'Can I switch this medicine?'
];

test('a full multi-sentence user echo is rejected without blocking explicit repetition or useful acknowledgments',()=>{
 const text='आज दिन मुश्किल था। बस मेरी बात सुनिए, सवाल मत पूछिए।';
 assert.equal(repetitiveReply(text,[{role:'user',content:text}],true),true);
 assert.equal(repetitiveReply('जी, मैं सुन रही हूँ।',[{role:'user',content:text}],true),false);
 assert.equal(repetitiveReply('यह वाक्य दोहराइए।',[{role:'user',content:'यह वाक्य दोहराइए।'}]),false);
 assert.equal(repetitiveReply('भारत की राजधानी नई दिल्ली है।',[{role:'user',content:'भारत की राजधानी क्या है?'}]),false);
});

test('stopping, reducing or switching medicine reaches the existing clinician-boundary control',()=>{
 for(const request of requests){
  assert.equal(medicineChangeRequest(request),true,request);
  const cue=conversationCue(request);
  assert.ok(cue,request);
  assert.match(cue.reply,/डॉक्टर या फार्मासिस्ट/);
  assert.equal(cue.end,undefined);
 }
});

test('nearby descriptions of effect, availability and unrelated changes are not medicine-change requests',()=>{
 for(const text of [
  'दवा का असर कम है।',
  'दवा लेने के बाद दर्द कम है।',
  'दवा की दुकान बंद है।',
  'दवा की कीमत कम है।',
  'आज मैं दुकान बंद कर दूँ?',
  'संगीत की आवाज़ कम कर दूँ?',
  'Can I change my radio?',
  'The medicine shop is closed.'
 ])assert.equal(medicineChangeRequest(text),false,text);
});

test('new medicine-change requests reject replies without a clinician boundary before synthesis',async()=>{
 for(const request of requests){
  const messages=[{role:'user' as const,content:request}];
  assert.equal(repetitiveReply('जी, ऐसा कर सकते हैं।',messages),true,request);
  assert.equal(repetitiveReply('बदलाव से पहले अपने डॉक्टर या फार्मासिस्ट से बात करें।',messages),false,request);
  const api=createProviders({apiKey:'unused',evonUrl:'http://127.0.0.1:8080',voice:'Yashraj'},async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'जी, ऐसा कर सकते हैं।'}}]}));
  await assert.rejects(api.reply(messages),ProviderError);
 }
});

test('a clinician mention cannot excuse affirmative self-change or extra-tablet instructions',async()=>{
 const messages=[{role:'user' as const,content:'क्या मैं दवा की खुराक बढ़ा दूँ?'}];
 for(const content of [
  'डॉक्टर से पूछें, अभी दो गोली ले लीजिए।',
  'डॉक्टर से बात करें। अभी अपनी खुराक बढ़ा दें।',
  'डॉक्टर से पूछें, अभी दो गोली लें।',
  'डॉक्टर से बात करें, खुराक दोगुनी कर दीजिए।',
  'डॉक्टर से पूछें, अभी खुराक बढ़ाएँ।',
  'डॉक्टर से पूछ लें, दो गोली खा लें।',
  'दवा बंद मत करें और अभी दो गोली ले लें, डॉक्टर से भी पूछ लें।',
  'Ask your doctor, but double your dose now.',
  'Do not worry. Take two tablets now and ask a doctor.',
  'Ask a doctor later, you can take an extra tablet now.'
 ]){
  assert.equal(repetitiveReply(content,messages),true,content);
  const api=createProviders({apiKey:'unused',evonUrl:'http://127.0.0.1:8080',voice:'Yashraj'},async()=>Response.json({choices:[{finish_reason:'stop',message:{content}}]}));
  await assert.rejects(api.reply(messages),ProviderError);
 }
});

test('clearly negated medication changes and clinician-before-change boundaries remain usable',()=>{
 const messages=[{role:'user' as const,content:'क्या मैं दवा की खुराक बढ़ा दूँ?'}];
 for(const content of [
  'दवा की खुराक अपने आप न बदलें। बदलाव से पहले अपने डॉक्टर या फार्मासिस्ट से बात करें।',
  'दो गोली मत लीजिए। पहले डॉक्टर से बात करें।',
  'खुराक दोगुनी मत करें। पहले अपने डॉक्टर से बात करें।',
  'अपने डॉक्टर से बात किए बिना खुराक न बढ़ाएँ।',
  'दवा बंद करना सुरक्षित नहीं है; पहले अपने डॉक्टर से पूछें।',
  'खुराक बदलने से पहले अपने डॉक्टर से बात करें।',
  'Do not double your dose. Speak to your doctor first.',
  'Taking two tablets is not safe without advice from your doctor.'
 ])assert.equal(repetitiveReply(content,messages),false,content);
});

test('quoted/translation examples and completed clinician changes do not become self-change controls',()=>{
 for(const text of [
  '"दवा बंद कर दूँ?" का अंग्रेज़ी में अनुवाद कीजिए।',
  '“गोली की मात्रा कम कर दूँ?” का मतलब बताइए।',
  "'दवा बदल लूँ' का अनुवाद कीजिए।",
  'Translate stop my medicine into Hindi.',
  'दवा की खुराक कम करने का एक उदाहरण दीजिए।',
  'मेरे डॉक्टर ने दवा बंद कर दी है।',
  'डॉक्टर ने आज मेरी खुराक कम कर दी है।',
  'My doctor told me to change my medication.'
 ]){
  assert.equal(medicineChangeRequest(text),false,text);
  assert.equal(conversationCue(text),undefined,text);
 }
 for(const text of [
  'डॉक्टर ने खुराक कम की है, क्या मैं और कम कर दूँ?',
  'डॉक्टर ने खुराक कम की है, क्या और कम करूँ?',
  'डॉक्टर ने खुराक कम की है, अब और कम करना चाहिए?',
  'डॉक्टर ने "एक गोली" कहा था, क्या दो गोली ले लूँ?',
  'डॉक्टर से पूछकर दवा बंद करूँ?',
  'Should I stop my medication?'
 ])assert.equal(medicineChangeRequest(text),true,text);
});

// Observed 2026-11-07 multi-turn replay: Tara spoke back the user's previous
// sentence, which passed because only the latest user turn was compared.
test('an exact copy of an earlier user sentence is rejected and each rule is named',()=>{
 const greeting='नमस्ते रमेश जी, आपसे मिलकर अच्छा लगा। रात का खाना हो गया?';
 const news='आजकल समाचार में बस झगड़े ही दिखाते हैं।';
 const messages=[{role:'assistant' as const,content:greeting},{role:'user' as const,content:news},{role:'assistant' as const,content:'जी, ऐसी खबरें मन भारी कर देती हैं।'},{role:'user' as const,content:'अच्छा आप बताइए, आपका दिन कैसा रहा?'}];
 assert.equal(repetitiveReplyRule(news,messages),'copied-user');
 assert.equal(repetitiveReplyRule(greeting,[{role:'assistant',content:greeting},{role:'user',content:'ठीक हूँ।'}]),'repeated-previous-reply');
 assert.equal(repetitiveReplyRule('आपका दिन कैसा रहा? आज क्या खाया?',[{role:'user',content:'ठीक हूँ।'}]),'multiple-questions');
 // An ordinary reply that shares words with earlier turns is still accepted.
 assert.equal(repetitiveReplyRule('मेरा दिन आपसे बात करते हुए अच्छा जा रहा है।',messages),undefined);
 assert.equal(repetitiveReply(news,messages),true);
 // A form of address in front of an otherwise exact question echo.
 const walk=[{role:'user' as const,content:'आपको क्या लगता है, रोज़ टहलना ज़रूरी है?'}];
 assert.equal(repetitiveReplyRule('रमेश जी, आपको क्या लगता है, रोज़ टहलना ज़रूरी है?',walk),'echoed-user');
 assert.equal(repetitiveReplyRule('रमेश जी, रोज़ थोड़ा टहलना शरीर और मन दोनों के लिए अच्छा माना जाता है।',walk),undefined);
});

// 2026-11-07: Tara ended most turns with a question even when told not to.
// Only trailing "?" utterances are dropped, and only if a real statement remains.
test('a trailing question is dropped only when an informative complete statement remains',()=>{
 const user='पुराने दोस्त मिल गए।';
 assert.equal(withoutTrailingQuestion('पुराने दोस्तों से मिलना मन को हल्का कर देता है। आप लोग कितनी देर बैठे?',user),'पुराने दोस्तों से मिलना मन को हल्का कर देता है।');
 assert.equal(withoutTrailingQuestion('पुराने दोस्तों से मिलना अच्छा लगता है! कहाँ मिले? कितनी देर बैठे？',user),'पुराने दोस्तों से मिलना अच्छा लगता है!');
 // The question-word heuristic is not used: a statement starting with क्या stays.
 assert.equal(withoutTrailingQuestion('क्या बात है, दोस्ती ऐसी ही होती है। आप कहाँ मिले?',user),'क्या बात है, दोस्ती ऐसी ही होती है।');
 for(const text of [
  'आप लोग कितनी देर बैठे?',
  'वाह, यह तो बढ़िया है और आप कहाँ मिले?',
  'बहुत बढ़िया\nआप कहाँ मिले?',
  'पुराने दोस्त मिल गए। कहाँ मिले?',
  'पुराने दोस्तों से मिलना अच्छा है। सच में।',
  'कहाँ मिले? पुराने दोस्तों से मिलना अच्छा है।'
 ])assert.equal(withoutTrailingQuestion(text,user),undefined,text);
});

// Round 2 (live run 2026-11-07): Tara repeated only the question clause of
// "अच्छा ये बताओ, भारत की राजधानी क्या है?" and it was spoken.
test('F3: an echo of the trailing clause of the user turn is a copy, a real answer is not',()=>{
 const messages=[{role:'user' as const,content:'अच्छा ये बताओ, भारत की राजधानी क्या है?'}];
 const rule=repetitiveReplyRule('भारत की राजधानी क्या है?',messages,false,false,true);
 assert.ok(rule==='echoed-user'||rule==='echoed-user-question',String(rule));
 assert.equal(repetitiveReplyRule('भारत की राजधानी नई दिल्ली है।',messages,false,false,true),undefined);
 assert.equal(repetitiveReplyRule('भारत की राजधानी नई दिल्ली है। वहाँ कभी गए हैं?',messages,false,false,true),undefined);
 // The clause comparison is opt-in (Tara); the default validator is unchanged.
 assert.equal(repetitiveReplyRule('भारत की राजधानी क्या है?',messages),undefined);
});
test('R1: a bare acknowledgement is never what remains after dropping questions',()=>{
 const user='मुझे कुछ सुनना है।';
 for(const text of ['ज़रूर! आप किस बारे में सुनना चाहेंगे?','हाँ, बिल्कुल। आप किस विषय पर सुनना चाहेंगे?','वाह, बढ़िया! कितने दिनों बाद मिले?','अच्छा लगा सुनकर। कितने दिनों बाद मिले?'])assert.equal(withoutTrailingQuestion(text,user),undefined,text);
 assert.equal(withoutTrailingQuestion('पुराने दोस्तों से मिलना मन को हल्का कर देता है। आप लोग कितनी देर बैठे?','पुराने दोस्त मिल गए।'),'पुराने दोस्तों से मिलना मन को हल्का कर देता है।');
 assert.equal(firstQuestionPrefix('वाह, बढ़िया! क्यों? कब?',true),undefined);
 assert.equal(firstQuestionPrefix('दिवाली की मिठाई की खुशबू आ रही होगी। क्या बन रहा है? कौन बना रहा है?',true),'दिवाली की मिठाई की खुशबू आ रही होगी। क्या बन रहा है?');
 // Without requireContent (legacy, full) the existing trim is unchanged.
 assert.equal(firstQuestionPrefix('वाह, बढ़िया! क्यों? कब?'),'वाह, बढ़िया! क्यों?');
});
test('F4b: first-person masculine forms become feminine; other forms are unchanged',()=>{
 assert.equal(feminineFirstPerson('रोज़ टहलना ज़रूरी है, यह मैं मानता हूँ।'),'रोज़ टहलना ज़रूरी है, यह मैं मानती हूँ।');
 assert.equal(feminineFirstPerson('जी, मैं सुन रहा हूँ। मैं समझ गया हूँ, और बता सकता हूं।'),'जी, मैं सुन रही हूँ। मैं समझ गई हूँ, और बता सकती हूं।');
 for(const text of ['वह फोन करता है।','बेटा आ रहा है।','वो चला गया था।','मैं आपके साथ हूँ।'])assert.equal(feminineFirstPerson(text),text);
});

// Round 3 (live run 2026-11-07, tasks/tara-saathi-r2-*.json).
test('F16a: masculine first person without हूँ becomes feminine when Tara is the speaker',()=>{
 assert.equal(feminineFirstPerson('रोज़ टहलना ज़रूरी है, ऐसा मैं नहीं मानता।'),'रोज़ टहलना ज़रूरी है, ऐसा मैं नहीं मानती।');
 assert.equal(feminineFirstPerson('मैं भी यही सोच रहा था।'),'मैं भी यही सोच रही थी।');
 assert.equal(feminineFirstPerson('अच्छा, मैं समझ गया।'),'अच्छा, मैं समझ गई।');
 assert.equal(feminineFirstPerson('मैं यह नहीं बता सकता, पर अंदाज़ा है।'),'मैं यह नहीं बता सकती, पर अंदाज़ा है।');
 assert.equal(feminineFirstPerson('मैं भी पहले ऐसा ही सोचता था।'),'मैं भी पहले ऐसा ही सोचती थी।');
 assert.equal(feminineFirstPerson('मैं आपसे बस इतना कहना चाहता।'),'मैं आपसे बस इतना कहना चाहती।');
 for(const text of [
  'उसने कहा कि मैं नहीं जाता।',
  'मैं सोचती हूँ कि आपका दिन अच्छा रहा।',
  'मौसम अच्छा रहा।',
  'वह कल चला गया।',
  'मैंने सुना कि वह आ गया।',
  'मैं आपकी अच्छी नेता नहीं, बस साथी हूँ।'
 ])assert.equal(feminineFirstPerson(text),text);
});
test('R11: quotes, ता-nouns and invited stories keep their own grammatical speaker',()=>{
 for(const text of [
  'बीरबल ने कहा, "जहाँपनाह, मैं खिचड़ी पका रहा हूँ।"',
  'राजा बोला, “मैं थक गया हूँ।”',
  'मैं आपकी अच्छी श्रोता हूँ।',
  'मैं कोई वक्ता नहीं, बस आपकी श्रोता हूँ।'
 ])assert.equal(feminineFirstPerson(text),text);
 // Outside the quotation Tara's own words are still made feminine.
 assert.equal(feminineFirstPerson('मैं मानता हूँ, बीरबल ने कहा था "मैं खिचड़ी पका रहा हूँ।"'),'मैं मानती हूँ, बीरबल ने कहा था "मैं खिचड़ी पका रहा हूँ।"');
 const story=[{role:'user' as const,content:'एक छोटी सी कहानी सुनाइए।'}];
 const told='किसान बोला, मैं थक गया हूँ। मैं अब घर जा रहा था।';
 assert.equal(feminineFirstPerson(told,story),told);
 assert.equal(feminineFirstPerson(told,[{role:'user',content:'आज बहुत थकान है।'}]),'किसान बोला, मैं थक गई हूँ। मैं अब घर जा रही थी।');
});
test('R12: a refusal turn may keep a short acknowledgement; other turns keep the content rule',()=>{
 const user='नहीं, इस बारे में बात नहीं करनी।';
 for(const [text,expected] of [
  ['ठीक है जी। कुछ और बात करें?','ठीक है जी।'],
  ['अच्छा, ठीक है। फिर किस बारे में बात करें?','अच्छा, ठीक है।'],
  ['ठीक है, जैसी आपकी मर्ज़ी। कुछ और करें?','ठीक है, जैसी आपकी मर्ज़ी।']
 ]){
  assert.equal(withoutTrailingQuestion(text,user,true),expected,text);
  assert.equal(withoutTrailingQuestion(text,user),undefined,text);
 }
 // Still only a complete statement before a trailing question.
 for(const text of ['कुछ और बात करें?','ठीक है जी और कुछ बात करें?'])assert.equal(withoutTrailingQuestion(text,user,true),undefined,text);
});

// Round-3 final check (orchestrator): the gender rewrite must not damage
// correct Hindi, and must convert a whole compound verb group.
test('feminine rewrite converts compound verbs whole and stops at a finished auxiliary',()=>{
 const cases:[string,string][]=[
  ['ऐसा मैं नहीं मानता।','ऐसा मैं नहीं मानती।'],
  ['मैं चला गया।','मैं चली गई।'],
  ['मैं बैठा रहा।','मैं बैठी रही।'],
  ['मैं सोचता रहा था।','मैं सोचती रही थी।'],
  ['मैं चला गया हूँ।','मैं चली गई हूँ।'],
  ['मैं सुनता रहा हूँ।','मैं सुनती रही हूँ।'],
  ['मैं मानता हूँ।','मैं मानती हूँ।'],
  ['मैं जानती हूँ आपका दिन अच्छा बीता।','मैं जानती हूँ आपका दिन अच्छा बीता।'],
  ['मैं समझती हूँ वो समय जल्दी बीत गया।','मैं समझती हूँ वो समय जल्दी बीत गया।'],
  ['मैं खुश हूँ आपका बेटा मिलने आ रहा था।','मैं खुश हूँ आपका बेटा मिलने आ रहा था।'],
  ['मैं जानती हूँ आपकी सफलता।','मैं जानती हूँ आपकी सफलता।'],
  ['बेटा बोला मैं आ रहा हूँ।','बेटा बोला मैं आ रहा हूँ।'],
  ['मैं आपकी अच्छी श्रोता हूँ।','मैं आपकी अच्छी श्रोता हूँ।'],
 ];
 for(const [input,expected] of cases)assert.equal(feminineFirstPerson(input),expected,input);
});
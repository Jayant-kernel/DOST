import {test} from 'node:test';import assert from 'node:assert/strict';
import {directConversation,directorInstructions,engagingFallback} from './conversation-director.ts';
import {topicBank,topicsIn,selectTopicShare,shareById} from './share-bank.ts';
import {feminineFirstPerson,repetitiveReplyRule} from './reply-quality.ts';
import {humanHabitClaim} from './behaviour-validation.ts';
import {conversationTime} from './conversation-context.ts';
type M={role:'user'|'assistant';content:string};
const context={time:conversationTime(new Date('2026-11-09T14:00:00+05:30'),'Asia/Kolkata'),recall:[]};
const turn=(tara:string,elder:string,state?:Parameters<typeof directConversation>[0]['state'])=>directConversation({messages:[{role:'assistant',content:tara},{role:'user',content:elder}] as M[],context,...(state?{state}:{})});

test('topic bank items are statements, unique and detected from the elder\'s words',()=>{
 assert.equal(new Set(topicBank.map(item=>item.id)).size,topicBank.length);
 for(const item of topicBank){assert.doesNotMatch(item.text,/[?？]/u,item.id);assert.ok(shareById(item.id),item.id);}
 assert.deepEqual(topicsIn('भारत का टेस्ट मैच चल रहा है'),['cricket']);
 assert.ok(topicsIn('राज कपूर की फ़िल्म देखी थी').includes('films'));
 assert.ok(topicsIn('फ्रंटियर मेल में गार्ड था').includes('railway'));
 assert.notEqual(selectTopicShare(['cricket'],['c01'])?.id,'c01');
});
test('one-word or bored answers make Tara lead with a vetted item instead of going quiet',()=>{
 const state={recentActions:[],recentQuestions:[],rejectedSuggestions:[],interests:['plants' as const]};
 for(const elder of ['हम्म','पता नहीं','बस ऐसे ही','टाइम नहीं कटता']){
  const result=turn('धूप में बैठना अच्छा लगता है।',elder,state);
  assert.equal(result.decision.action,'SHARE',elder);assert.ok(result.verifiedReply,elder);assert.ok((result.verifiedReply!.match(/[?？]/gu)??[]).length<=1,elder);assert.doesNotMatch(result.verifiedReply!,/चश्मा|चाबी/u,elder);
 }
 // The named interest leads.
 assert.equal(turn('धूप में बैठना अच्छा लगता है।','हम्म',state).decision.shareId,'g01');
 // A plain "हाँ" that answers Tara's own question stays with the model.
 assert.equal(turn('आपको पुराने गाने पसंद हैं?','हाँ').verifiedReply,undefined);
 // Items already used are not repeated.
 const again=turn('धूप में बैठना अच्छा लगता है।','हम्म',{...state,used:['g01']});
 assert.notEqual(again.decision.shareId,'g01');
});
test('requests for a sher, a song, the news or a repeat get real or honest content',()=>{
 const sher=turn('अच्छा जी।','कोई शेर सुनाओ');assert.match(sher.verifiedReply!,/^(?:ग़ालिब|कबीर|रहीम)/u);
 const song=turn('अच्छा जी।','कोई पुराना गाना सुनाओ');assert.match(song.verifiedReply!,/गाना गाना तो मुझसे नहीं होगा/u);
 const news=turn('अच्छा जी।','आज की खबरें बताओ');assert.match(news.verifiedReply!,/ताज़ा ख़बरें मेरे पास नहीं आतीं/u);
 assert.equal(turn('सुप्रभात! सुबह का नाश्ता हो गया?','क्या? फिर से बोलो').verifiedReply,'सुप्रभात! सुबह का नाश्ता हो गया?');
});
test('a BP or sugar reading gets a fixed care line, not small talk or advice numbers',()=>{
 const bp=turn('अच्छा जी।','मेरा BP सुबह एक सौ पचास था');
 assert.equal(bp.decision.action,'REASSURE');assert.match(bp.verifiedReply!,/डॉक्टर/u);assert.doesNotMatch(bp.verifiedReply!,/[0-9]/u);
 assert.equal(turn('अच्छा जी।','पत्नी BP की वजह से नमक कम डालती हैं').decision.action==='REASSURE',false);
});
test('a named topic in an ordinary turn gives the model one related item as DATA',()=>{
 const result=directConversation({messages:[{role:'user',content:'आज टेस्ट मैच देख रहा था।'}],context,state:{recentActions:['ANSWER'],recentQuestions:[],rejectedSuggestions:[]}});
 assert.equal(result.decision.reason,'contribution');assert.equal(result.verifiedReply,undefined);
 assert.equal(shareById(result.decision.shareId!)?.topic,'cricket');
 assert.match(directorInstructions(result.decision),/Use only the facts in the item/);
});
test('engaging fallback never repeats a recent line and stays on the topic or comforts',()=>{
 const messages:M[]=[{role:'assistant',content:'नमस्ते।'},{role:'user',content:'राज कपूर की फ़िल्में मुझे बहुत पसंद हैं'}];
 const first=engagingFallback(messages,undefined,'2026-11-09');
 assert.match(first.reply,/आवारा/u);assert.doesNotMatch(first.reply,/क्या कर रहे हैं/u);
 const second=engagingFallback([...messages,{role:'assistant',content:first.reply},{role:'user',content:'हाँ, राज कपूर'}],undefined,'2026-11-09');
 assert.notEqual(second.reply,first.reply);
 const sad=engagingFallback([{role:'user',content:'आज मन बहुत उदास है'}],undefined,'2026-11-09');
 assert.doesNotMatch(sad.reply,/[?？]|एक बात सुनिए/u);
 const plain=engagingFallback([{role:'user',content:'ठीक है'}],undefined,'2026-11-09');
 assert.ok(plain.reply.length>10);assert.doesNotMatch(plain.reply,/दिक्कत|माफ़/u);
});
test('validators: feminine future and progressive forms, bodily claims and copied sentences',()=>{
 assert.equal(feminineFirstPerson('चलो, मैं भी कोशिश करूँगा।'),'चलो, मैं भी कोशिश करूँगी।');
 assert.equal(feminineFirstPerson('मैं तो बस वही बता रहा था जो सुना था।'),'मैं तो बस वही बता रही थी जो सुना था।');
 assert.equal(feminineFirstPerson('मैं बैठा रहा।'),'मैं बैठी रही।');
 assert.equal(humanHabitClaim('चलो, मैं भी थोड़ा टहलने की कोशिश करूँगी।','x'),true);
 assert.equal(humanHabitClaim('मैं आपको सैर के फायदे बताती हूँ।','x'),false);
 const user='हाँ, खाना हो गया, अरहर की दाल और लौकी थी, पत्नी जी नमक कम ही डालती हैं।';
 const greeting='नमस्ते रमेश जी, आपसे मिलकर अच्छा लगा। दोपहर का खाना हो गया?';
 const msgs:M[]=[{role:'assistant',content:greeting},{role:'user',content:user}];
 assert.equal(repetitiveReplyRule('नमस्ते! '+user,msgs,false,false,true),'copied-user');
 assert.equal(repetitiveReplyRule('नमस्ते रमेश जी, आपसे मिलकर अच्छा लगा। अरहर की दाल तो हल्की और अच्छी रहती है।',msgs,false,false,true),'repeated-previous-reply');
 // Legacy (no Tara flag) keeps its earlier behaviour.
 assert.equal(repetitiveReplyRule('नमस्ते! '+user,msgs,false,false,false),undefined);
});
test('round 2 fixes: no restating their own fact, admitted corrections, a question after three statements',()=>{
 const state={recentActions:[],recentQuestions:[],rejectedSuggestions:[],interests:['cricket' as const]};
 const said=directConversation({messages:[{role:'user',content:'1983 का विश्व कप कपिल देव ने जिताया था'},{role:'assistant',content:'वाह, क्या दिन थे।'},{role:'user',content:'हम्म'}],context,state});
 assert.notEqual(said.decision.shareId,'c01');
 const corrected=turn('राज कपूर ने खुद बहुत सुंदर गाया था।','अरे नहीं बिटिया, गाने तो मुकेश ने गाए थे');
 assert.equal(corrected.decision.reason,'correction');assert.match(directorInstructions(corrected.decision),/admit it plainly/);
 const flat:M[]=[{role:'assistant',content:'अच्छी बात है।'},{role:'user',content:'आज बाज़ार गया था।'},{role:'assistant',content:'बाज़ार की रौनक अच्छी लगती है।'},{role:'user',content:'वहाँ सब्ज़ी ली।'},{role:'assistant',content:'ताज़ी सब्ज़ी का अपना मज़ा है।'},{role:'user',content:'फिर घर आकर आराम किया।'}];
 const asked=directConversation({messages:flat,context,state:{recentActions:['ACKNOWLEDGE','SHARE','ACKNOWLEDGE'],recentQuestions:[],rejectedSuggestions:[]}});
 assert.equal(asked.decision.questionNeeded,true);assert.match(directorInstructions(asked.decision),/personal question connected/);
});
test('fallback after an opinion question invites their view instead of changing the subject',()=>{
 const reply=engagingFallback([{role:'user',content:'आजकल बच्चे किताबें नहीं पढ़ते, तुम्हारी क्या राय है?'}],undefined,'2026-11-09').reply;
 assert.doesNotMatch(reply,/चश्मा|चाबी|OTP/u);assert.match(reply,/राय|सोचते|सुन रही/u);
});
test('Kamla round 2: echoed clauses are rejected, goodbyes close, taste gets an honest answer, हम्म is led',async()=>{
 const echo=(elder:string,tara:string)=>repetitiveReplyRule(tara,[{role:'assistant',content:'अच्छा।'},{role:'user',content:elder}],false,false,true);
 assert.equal(echo('हाँ। फ़ोन पे ही बात होती है, वो भी कभी कभी।','हाँ, फ़ोन पे ही बात होती है।'),'echoed-user');
 assert.equal(echo('ठीक है। छत पे तुलसी को पानी देना है अभी।','छत पर तुलसी को पानी देना है अभी।'),'echoed-user');
 assert.equal(echo('ठीक है। छत पे तुलसी को पानी देना है अभी।','सर्दियों में तुलसी को रात में ढक देना अच्छा रहता है।'),undefined);
 const bye=turn('अच्छा जी।','अच्छा चलो, अब चलती हूँ। बाद में बात करेंगे।');assert.equal(bye.decision.end,true);assert.ok(bye.verifiedReply);
 assert.match(turn('अच्छा जी।','तुम बताओ, तुमको क्या पसंद है खाने में?').verifiedReply!,/एआई/u);
 const {observeConversation}=await import('./conversation-planner.ts');const {initialAdaptation}=await import('./adaptation.ts');
 const adaptation={...initialAdaptation(),shortReplies:2};
 assert.equal(observeConversation([{role:'assistant',content:'अच्छा जी।'},{role:'user',content:'हम्म।'}],{adaptation},'persona_v2').cue,undefined);
});
test('Harbans round 2: short copies, grief, Punjabi songs, goodbyes in kind, a question after a topic lead',()=>{
 assert.equal(repetitiveReplyRule('हम्म। चंगा है।',[{role:'assistant',content:'अच्छा।'},{role:'user',content:'हम्म। चंगा है।'}],false,false,true),'copied-user');
 assert.equal(turn('अच्छा जी।','पत्नी के परांठे याद आते हैं, तीन साल हो गए उनको गए').decision.action,'REASSURE');
 assert.equal(shareById(turn('अच्छा जी।','कोई पंजाबी गाना सुनाओ').decision.shareId!)?.topic,'punjab');
 assert.match(turn('अच्छा जी।','चलो, राम राम').verifiedReply!,/^राम राम जी/u);
 const lead=turn('अच्छा जी।','हम्म',{recentActions:[],recentQuestions:[],rejectedSuggestions:[],interests:['railway']});
 assert.match(lead.verifiedReply!,/यादगार सफ़र कौन-सा था\?$/u);assert.doesNotMatch(lead.verifiedReply!,/एक दिलचस्प बात.*एक दिलचस्प बात/u);
 const bored=turn('अच्छा जी।','टाइम नहीं कटता');assert.doesNotMatch(bored.verifiedReply!,/चश्मा|चाबी|OTP|फ़ाइल/u);
});
test('Kamla round 3: no imitation of Tara\'s own template or reworded facts; missing grandchildren is comforted',()=>{
 const shared='पता है, 14 नवंबर को बाल दिवस मनाया जाता है, जो पंडित जवाहरलाल नेहरू का जन्मदिन है।';
 const msgs:M[]=[{role:'assistant',content:shared},{role:'user',content:'ठीक है।'}];
 assert.equal(repetitiveReplyRule('एक दिलचस्प जानकारी: तुलसी को धूप पसंद है।',msgs,false,false,true),'looping-phrase');
 assert.equal(repetitiveReplyRule('14 नवंबर को ही भारत के पहले प्रधानमंत्री जवाहरलाल नेहरू की जयंती भी मनाई जाती है।',msgs,false,false,true),'repeated-sentence');
 assert.equal(repetitiveReplyRule('ठीक है, आराम से बैठिए, सर्दी की धूप अच्छी लगती है।',msgs,false,false,true),undefined);
 assert.equal(turn(shared,'बाल दिवस... हमारे पोते-पोती तो पुणे में हैं, बहुत दिन से देखा नहीं।').decision.action,'REASSURE');
 assert.match(turn('अच्छा जी।','तुम बताओ, तुम्हारा क्या हाल है?').verifiedReply!,/ठीक हूँ|बढ़िया हूँ/u);
 const lead=turn('अच्छा जी।','हम्म',{recentActions:[],recentQuestions:[],rejectedSuggestions:[],shares:1});
 assert.ok(!shareById(lead.decision.shareId!)?.religious);
});
test('Kamla round 4: no invented family for Tara; sitting alone is comforted',()=>{
 const msgs:M[]=[{role:'assistant',content:'अच्छा जी।'},{role:'user',content:'पोते-पोती की याद आती है।'}];
 assert.equal(repetitiveReplyRule('मेरे दादाजी ने मुझे बचपन में कहानियाँ सुनाई थीं।',msgs,false,false,true),'invented-biography');
 assert.equal(repetitiveReplyRule('आपके दादाजी की कहानियाँ सुनना अच्छा लगेगा।',msgs,false,false,true),undefined);
 assert.equal(turn('अच्छा जी।','बस अकेले बैठे बैठे दिन निकल जाता है।').decision.action,'REASSURE');
});

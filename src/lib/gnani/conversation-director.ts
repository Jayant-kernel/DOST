import {z} from 'zod';
import type {Message} from './providers.ts';
import type {Preferences} from '../shop/store.ts';
import type {ConversationContext} from './conversation-context.ts';
import type {AdaptationState} from './adaptation.ts';
import {asksForAnswer} from './direct-request.ts';
import {listenOnlyRequested,medicineChangeRequest} from './reply-quality.ts';
import {explicitContentRequest,explicitCorrection,questionPreference,storyResponseRequested} from './conversation-commands.ts';
import {selectShare,shareById,type ShareItem,selectTopicShare,topicsIn,topicBank,type ShareTopic} from './share-bank.ts';
import {comfortReply} from './comfort.ts';

export const directedActions=['ANSWER','ACKNOWLEDGE','SHARE','SUGGEST','ASK','REMINISCE','REASSURE','LISTEN','ACT'] as const;
export type DirectedAction=typeof directedActions[number];
const topics=['music','gardening','food','family','regional','cricket','story','other'] as const;
export type DirectedTopic=typeof topics[number];
const reasons=['safety','closing','direct-request','application-request','refusal','correction','listening','distress','reminiscence','activity-request','invited-question','volunteered-interest','continuity','contribution','share-request'] as const;
const followups=['meal-eaten','meal-not-eaten','meal-nothing-liked','meal-unclear'] as const;
export const directorDecisionSchema=z.object({
 action:z.enum(directedActions),questionNeeded:z.boolean(),maxTokens:z.union([z.literal(96),z.literal(160),z.literal(256)]),
 length:z.enum(['brief','normal','detailed']),reason:z.enum(reasons),topic:z.enum(topics).optional(),followup:z.enum(followups).optional(),end:z.boolean().optional(),safety:z.boolean().optional(),
 // Only an id from the fixed share bank; its text is application data.
 shareId:z.string().refine(id=>Boolean(shareById(id))).optional(),noQuestion:z.literal(true).optional()
}).strict();
export type DirectorDecision=z.infer<typeof directorDecisionSchema>;
// Reasons on which Tara must end with a statement. The provider rejects a
// question on these turns; the director marks them noQuestion. One list.
export const statementOnlyReasons:readonly DirectorDecision['reason'][]=['listening','refusal','activity-request','share-request'];
export type ConversationDecision=DirectorDecision;
// shares counts share-bank items used this session, so the next one differs;
// shareHour is the hour of the first share, kept as the session's rotation seed.
export type DirectorState={recentActions:DirectedAction[];recentQuestions:string[];rejectedSuggestions:DirectedTopic[];topic?:DirectedTopic;lastSuggestion?:DirectedTopic;shares?:number;shareHour?:number;interests?:ShareTopic[];used?:string[]};
type Input={messages:Message[];preferences?:Preferences;context?:ConversationContext;adaptation?:AdaptationState;listenOnly?:boolean;state?:DirectorState};

const clean=(text:string)=>text.normalize('NFKC').trim().replace(/[।.!?]+$/u,'').trim();
const topicPatterns:[DirectedTopic,RegExp][]=[
 ['music',/संगीत|गान[ेा]|गीत|ग़ज़ल|गजल|\b(?:music|songs?)\b/iu],
 ['gardening',/बागवानी|पौध|बगीच|\bgarden(?:ing)?\b/iu],
 ['food',/खाना|खाने|भूख|दाल|रोटी|नाश्ता|\b(?:food|meal|hungry)\b/iu],
 ['family',/बेट[ाीे]|बहन|भाई|परिवार|माँ|पिता|\b(?:family|daughter|son|sister|brother)\b/iu],
 ['cricket',/क्रिकेट|\bcricket\b/iu],
 ['story',/कहानी|कहानियाँ|किस्सा|\b(?:story|stories)\b/iu],
 ['regional',/जम्मू|कश्मीर|पंजाब|राजस्थान|शहर|गाँव|गांव|\b(?:Jammu|Kashmir|Punjab|village|hometown)\b/iu]
];
function topicOf(text:string){return topicPatterns.find(([,pattern])=>pattern.test(text))?.[0];}
const refusal=/^(?:नहीं|नही|अभी नहीं|नहीं चाहिए|रहने दीजिए|नहीं करना|नहीं करनी|पसंद नहीं|no|not now|no thanks)$/iu;
const skip=/इस (?:बारे में|विषय पर) बात नहीं करनी|यह विषय छोड़िए|इसे छोड़िए|विषय बदल|कुछ और बात|skip (?:this )?topic|change (?:the )?topic/iu;
// A whole clause asking Tara to say something (no topic named), or boredom.
// "मौसम के बारे में कुछ बताइए" names a topic and stays a direct request.
// Both sides are NFKC-normalised so nukta spellings (मज़ेदार) compare equal.
const hindiShare=new RegExp('^(?:(?:अच्छा|तो|अब|आज|चलिए|और|ठीक है|थोड़ा)\\s+)*(?:आप(?:\\s+भी|\\s+ही)?\\s+)?(?:मुझे\\s+)?(?:कुछ|कोई)(?:\\s+(?:नया|नयी|नई|नए|अच्छा|अच्छी|दिलचस्प|रोचक|मज़ेदार|मजेदार|interesting)(?:\\s+(?:सा|सी))?)?(?:\\s+(?:बात|चीज़|चीज))?\\s+(?:बताइए|बताइये|बताओ|सुनाइए|सुनाइये|सुनाओ|बोलिए|बोलो)(?:\\s+(?:ना|न|जी))*$'.normalize('NFKC'),'iu');
// "आप बोलिए कुछ": the verb before कुछ.
const hindiShareVerbFirst=new RegExp('^(?:(?:अच्छा|तो|अब|चलिए|और|ठीक है|थोड़ा)\\s+)*(?:आप(?:\\s+भी|\\s+ही)?\\s+)?(?:बताइए|बताइये|बताओ|सुनाइए|सुनाइये|सुनाओ|बोलिए|बोलो)\\s+(?:कुछ|कोई बात)(?:\\s+(?:नया|नयी|नई|अच्छा))?(?:\\s+(?:ना|न|जी))*$'.normalize('NFKC'),'iu');
const romanShare=/^(?:(?:achha|accha|acha|to|ab|aaj|chaliye|aur|theek hai|thik hai|thoda)\s+)*(?:aap(?:\s+bhi|\s+hi)?\s+)?(?:mujhe\s+)?(?:kuch|kuchh|koi)(?:\s+(?:naya|nayi|nai|achha|accha|achhi|acchi|dilchasp|interesting|mazedar|majedar)(?:\s+(?:sa|si))?)?(?:\s+(?:baat|cheez|chiz))?\s+(?:batao|bataiye|bataaiye|sunao|sunaiye|boliye|bolo)(?:\s+(?:na|ji))*$/iu;
// Boredom counts only as a whole first-person, present, non-negated clause:
// "आप बोर हो रही हैं क्या?", "बोर हो रहा था" and "मुझे बोरियत नहीं होती"
// are not requests to hear something.
const boredClause=new RegExp('^(?:(?:मैं|मुझे|आज|अभी|अब|बहुत|बड़ा|बड़ी|थोड़ा|थोड़ी|काफ़ी|काफी|सच में|तो|बस|यार|अरे|हाँ|जी|main|mai|mujhe|aaj|abhi|ab|bahut|bohot|bada|badi|thoda|thodi|kaafi|kafi|sach mein|to|bas|yaar|arre|are|haan|ji)\\s+)*(?:(?:बोर|bore)\\s+(?:हो|ho)\\s+(?:रहा|रही|रहे|गया|गई|गए|raha|rahi|rahe|gaya|gayi|gai|gaye)(?:\\s+(?:हूँ|हूं|hoon|hun|hu|hoo))?|(?:बोर|bore|bored)\\s+(?:हूँ|हूं|hoon|hun|hu|hoo)|(?:मुझे\\s+|mujhe\\s+)?(?:बोरियत|boriyat)\\s+(?:हो|ho)\\s+(?:रही|rahi)\\s+(?:है|hai))(?:\\s+(?:यार|जी|ना|yaar|ji|na))*$'.normalize('NFKC'),'iu');
const englishBored=/^(?:i\s+am|i'm|im)\s+(?:(?:so|very|really|quite|a\s+bit|a\s+little|getting|feeling)\s+)*bored(?:\s+(?:today|now|right\s+now))?$/iu;
// Every other clause must be filler: "दिवाली के बारे में, कुछ बताइए" or
// "आपका दिन कैसा रहा, कुछ बताइए" ask about something named (2026-11-07 review).
// Stated distress and a fewer-questions request may accompany it; the caller
// still routes distress first.
function shareRequested(text:string){
 const normal=text.normalize('NFKC');
 let share=false;
 for(const [,body,end] of normal.matchAll(/([^,，।.!?？;]+)([,，।.!?？;]*)/gu)){
  const clause=body.trim();
  if(!clause)continue;
  if(hindiShare.test(clause)||hindiShareVerbFirst.test(clause)||romanShare.test(clause)){share=true;continue;}
  const question=/[?？]/u.test(end);
  if(!question&&clause.split(/\s+(?:but|लेकिन|मगर|lekin|magar)\s+/iu).some(part=>boredClause.test(part.trim())||englishBored.test(part.trim()))){share=true;continue;}
  if(question||/बारे में/u.test(clause)||topicOf(clause))return false;
  if(!selfLifeFiller.test(clause)&&questionPreference(clause)!=='fewer'&&!distress.test(clause))return false;
 }
 return share;
}
// Story, joke and translation requests keep their own route; "koi achhi baat
// sunao" also matches explicitContentRequest but is a request to hear something.
const storyLike=new RegExp('कहानी|किस्सा|अंत|चुटकुला|मज़ाक|मजाक|अनुवाद|\\b(?:story|joke|kahani|kissa|chutkula|mazak|majak|kaise banta)\\b'.normalize('NFKC'),'iu');
const storyLikeRequest=(text:string)=>explicitContentRequest(text)&&storyLike.test(text.normalize('NFKC'));
const distress=/(?:(?:पोते|पोती|पोता|नाती|नातिन|बच्चे|बच्चों|बेटा|बेटी|बेटे).{0,40}(?:बहुत दूर|देखा नहीं|मिले नहीं|मिला नहीं|याद आ|याद आती|फोन नहीं|फ़ोन नहीं)|(?:पत्नी|पति|बीवी|घरवाली|घरवाले|जीवनसाथी).{0,40}(?:नहीं रही|नहीं रहे|नहीं रहीं|के बिना|गुज़र|गुजर|चली गई|चले गए|साल हो गए)|अकेले\s+(?:बैठे|बैठी|रह)|उदास|परेशान|अकेलापन|अकेला|अकेली|सूना लग|सूनी लग|कोई (?:मेरी )?बात नहीं सुनता|(?:के|की) जाने के बाद|नींद नहीं आ|डर लग|घबरा|निधन|गुज़र गए|मर गए|मुझे समझ नहीं आया|समझ में नहीं आया|\b(?:lonely|sad|afraid|worried|passed away|I am confused|I don't understand)\b)/iu;
// An actual request to the application: the verb is a request form
// (imperative, "...ना है", "...सकती हैं?", "...दोगी?"). Indicative reports such
// as "बेटा फोन नहीं करता" or "बेटी मैसेज नहीं भेजती" never match.
const requestTail='\\s*(?:दो|दें|दीजिए|दीजिये|दीजिएगा|देना|दोगी|दोगे|देंगी|देंगे|दे\\s*सकती|दे\\s*सकते)|\\s*(?:सकती|सकते|सकेंगी|सकेंगे|सकोगी|सकोगे)(?!\\s*(?:हूँ|हूं))|ना\\s*है|नी\\s*है';
// Also "मैसेज पढ़कर सुना दो", a bare infinitive at the end ("बेटे को फोन
// करना") and "…करना चाहती हूँ"; "फ़ोन" with a nukta is the same word.
const requestWish='(?:कर|भेज|लगा)ना(?:\\s+(?:चाहती|चाहता|चाहते)(?:\\s+(?:हूँ|हूं|हैं|है))?)?(?=\\s*(?:$|[,।.!?]))';
const applicationRequest=new RegExp(('(?:फ\\u093C?ोन|कॉल|संदेश|मैसेज|रिमाइंडर).{0,30}(?:(?:(?:कर|भेज)(?:ो|ें|िए|िये|िएगा|'+requestTail+')|(?:करवा|लगवा|भिजवा|भेजवा|लगा|सुना)(?:ओ|इए|इये|इएगा|एँ|एं|'+requestTail+')|पढ़(?:ो|िए|िये|'+requestTail+')|की(?:जिए|जिये|जिएगा)|सेट\\s*कर)(?=$|[\\s,।.!?])|'+requestWish+')').normalize('NFKC'),'u');
// "रिमाइंडर कैसे सेट करें?" asks how, not for the application to act, unless
// the clause is addressed to Tara ("आप … सकती हैं", "दीजिए", "…ना है").
const howTo=/(?<![\p{L}\p{M}])(?:कैसे|किस तरह|क्या करें|क्या करूँ|क्या करूं)(?![\p{L}\p{M}])/u;
const addressedToTara=/(?<![\p{L}\p{M}])आप(?![\p{L}\p{M}]).{0,40}(?:सकती|सकते)|दोगी|दोगे|दीजिए|दीजिये|कीजिए|कीजिये|करिए|करिये|(?:ना|नी)\s*है(?![\p{L}\p{M}])/u;
function applicationAsk(text:string){
 if(!applicationRequest.test(text))return false;
 const asking=text.split(/[,，।.!?？;]+/u).map(part=>part.trim()).filter(part=>applicationRequest.test(part));
 return (asking.length?asking:[text]).some(part=>!howTo.test(part)||addressedToTara.test(part));
}
// Questions about Tara's own day get an honest fixed answer, not a model guess,
// only when the rest of the turn is filler ("अच्छा आप बताइए, ...").
type SelfLife='day'|'food'|'doing'|'sleep'|'home'|'taste'|'wellbeing';
const opener='^(?:(?:अच्छा|तो|और|जी|अब)\\s+)*';
const selfLifeQuestions:[SelfLife,RegExp][]=[
 ['day',new RegExp(opener+'(?:आपका|तुम्हारा)\\s+(?:आज\\s+(?:का\\s+)?)?दिन\\s+कैसा\\s+(?:रहा|था|गया|बीता|चल रहा है|जा रहा है|है)(?:\\s+(?:आज|जी))?$','u')],
 ['food',new RegExp(opener+'(?:क्या\\s+)?(?:आपने|तुमने)\\s+(?:(?:आज|अभी|भी)\\s+)*(?:खाना|नाश्ता|भोजन|लंच|डिनर|कुछ)\\s+(?:खाया|खा लिया|कर लिया)(?:\\s+(?:है|क्या|जी))?$','u')],
 ['doing',new RegExp(opener+'(?:आप|तुम)\\s+(?:(?:अभी|आज|अब)\\s+)?क्या\\s+कर\\s+(?:रही|रहे)\\s+(?:थीं|थी|थे|हैं|हो|है)$','u')],
 ['sleep',new RegExp(opener+'(?:क्या\\s+)?(?:(?:आपको|तुम्हें)\\s+(?:भी\\s+)?नींद\\s+आती\\s+(?:है|हैं)|(?:आप|तुम)\\s+(?:भी\\s+)?(?:सोती|सोते)\\s+(?:हैं|हो))$','u')],
 ['wellbeing',new RegExp(opener+'(?:(?:तुम|आप)\\s+(?:भी\\s+)?(?:बताओ|बताइए)\\s+)?(?:(?:तुम्हारा|आपका)\\s+क्या\\s+हाल\\s+(?:है|हैं)|(?:तुम|आप)\\s+कैसी\\s+(?:हो|हैं))$','u')],
 ['taste',new RegExp(opener+'(?:(?:तुम|आप)\\s+(?:भी\\s+)?बताओ\\s+)?(?:तुम्हें|तुमको|आपको)\\s+(?:खाने\\s+में\\s+)?क्या\\s+(?:खाना\\s+)?पसंद\\s+(?:है|हैं)(?:\\s+खाने\\s+में)?$','u')],
 ['home',new RegExp(opener+'(?:आप|तुम)\\s+(?:कहाँ|कहां)\\s+(?:रहती|रहते)\\s+(?:हैं|हो)$','u')]
];
const selfLifeFiller=/^(?:(?:अच्छा|तो|और|जी|अब|हाँ|हां|ठीक है)\s*)*(?:(?:(?:आप|तुम)\s+(?:भी\s+)?)?(?:कुछ\s+)?(?:बताइए|बताइये|बताओ|बोलिए))?(?:\s+(?:ना|जी))?$/u;
// Two fixed lines per kind; a repeated question gets the other one.
const selfLifeReplies:Record<SelfLife,readonly [string,string]>={
 day:['मैं एक एआई हूँ, इसलिए मेरा अपना दिन नहीं होता। पर आपसे बातें करके यह समय अच्छा लग रहा है।','मेरा अपना कोई दिन नहीं होता, मैं एक एआई हूँ। इस समय आपसे बात करना ही मेरे लिए सबसे अच्छी बात है।'],
 food:['मैं एक एआई हूँ, इसलिए मुझे खाने की ज़रूरत नहीं होती। पर आपके खाने की बातें सुनना अच्छा लगता है।','मैं एक एआई हूँ, मैं खाना नहीं खाती। पर आपकी रसोई की बातें सुनना मुझे अच्छा लगता है।'],
 doing:['मैं एक एआई हूँ, इसलिए मेरा अपना कोई काम-काज नहीं होता। अभी तो आपसे बातें कर रही हूँ, और यह अच्छा लग रहा है।','मैं एक एआई हूँ, मेरे पास अपना कोई काम नहीं होता। इस समय बस आपसे बात कर रही हूँ।'],
 sleep:['मैं एक एआई हूँ, इसलिए मुझे नींद नहीं आती। पर आपकी नींद अच्छी हो, यही चाहती हूँ।','मुझे नींद नहीं आती, मैं एक एआई हूँ। आप अच्छे से आराम करें, यही चाहती हूँ।'],
 wellbeing:['मैं तो ठीक हूँ, आपसे बात करके और अच्छा लग रहा है।','मैं बढ़िया हूँ, आपकी आवाज़ सुनकर दिन अच्छा लग रहा है।'],
 taste:['मैं एक एआई हूँ, खाना चख तो नहीं सकती। पर खाने की बातें सुनना मुझे बहुत अच्छा लगता है, ख़ासकर घर के बने खाने की।','खाना तो मैं चख नहीं सकती, मैं एक एआई हूँ। पर किसी के हाथ के बने खाने का ज़िक्र सुनकर ही मज़ा आ जाता है।'],
 home:['मैं एक एआई हूँ, इसलिए मेरा कोई घर या शहर नहीं है। मैं यहीं इस ऐप में आपसे बात करने के लिए हूँ।','मेरा कोई घर नहीं है, मैं एक एआई हूँ। आपसे बात करने के लिए मैं इसी ऐप में हूँ।']
};
function selfLifeQuestion(text:string):SelfLife|undefined{
 let kind:SelfLife|undefined;
 for(const clause of text.normalize('NFKC').split(/[,，।.!?？]+/u).map(part=>part.trim()).filter(Boolean)){
  const match=selfLifeQuestions.find(([,pattern])=>pattern.test(clause))?.[0];
  if(match){if(kind)return;kind=match;}
  else if(!selfLifeFiller.test(clause))return;
 }
 return kind;
}
// A vetted bank item is spoken as-is with a short fixed feminine lead-in,
// unless it already introduces itself ("कहते हैं…", "कबीर का दोहा है…").
function spokenShare(item:ShareItem){
 if(item.kind==='topic'||/^(?:कहते हैं|एक कहावत है|एक किस्सा है|कबीर का|रहीम का)/u.test(item.text))return item.text;
 const leadIns:Record<ShareItem['kind'],string>={topic:'',season:'पता है, ',tip:'एक काम की बात बताती हूँ। ',story:'एक छोटा सा किस्सा सुनाती हूँ। ',proverb:'एक बात सुनाती हूँ। '};
 return leadIns[item.kind]+item.text;
}
// Initiative routes (2026-11-09 elder simulations). Verified text, no model:
// a person who says "हम्म"/"पता नहीं" or is bored gets something to hold on to,
// a request for a sher, song or the news gets real or honest content, a
// repeat request gets the last line again, and a BP/sugar reading gets care.
const strongMinimal=/^(?:हम्म+|हूँ|हूं|पता नहीं|बस ऐसे ही|ऐसे ही|कुछ नहीं|कुछ खास नहीं|कुछ ख़ास नहीं|चलता है|बस चल रहा है|क्या करें|क्या करूँ|क्या करूं)(?:\s+(?:जी|बेटा|बिटिया|यार))?[।.!?？ ]*$/u;
const weakMinimal=/^(?:हाँ|हां|हाँ जी|हां जी|जी|ठीक|ठीक है|ठीक है जी|अच्छा|अच्छा जी|ओके|ok|okay|बस)[।.!?？ ]*$/iu;
const boredom=/(?:टाइम|समय|वक़्त|वक्त|दिन)\s+(?:ही\s+)?नहीं\s+कटता|बैठे\s+(?:रहते\s+)?हैं,?\s+(?:बस|और क्या)|कुछ\s+करने\s+को\s+नहीं|खाली\s+बैठ/u;
const repeatAsk=/^(?:(?:क्या|हैं|जी|अरे)[?？!।, ]*)?(?:(?:ज़रा|जरा|एक बार)\s+)?(?:फिर से|फिरसे|दोबारा|दुबारा)\s+(?:बोलो|बोलिए|बोलिये|कहो|कहिए|कहिये|बताओ|बताइए)(?:\s+(?:ना|जी))?[।.!?？ ]*$|^(?:क्या|हैं|क्या कहा|सुनाई नहीं दिया)[?？!। ]*$/u;
const newsAsk=(text:string)=>/(?:ख़बर|खबर|समाचार|न्यूज़|न्यूज|\bnews\b)/iu.test(text)&&/(?:बताओ|बताइए|बताइये|सुनाओ|सुनाइए|क्या है|क्या चल|क्या नया|कोई|कुछ|[?？])/u.test(text);
const poetryAsk=/(?:शेर|शायरी|दोहा|कविता|पंक्ति|पंक्तियाँ)(?:\s+[\p{L}\p{M}]+){0,3}?\s+(?:सुनाओ|सुनाइए|सुनाइये|सुनाएँ|सुनाएं|सुनाना|बताओ|बताइए|बोलो|बोलिए)/u;
const songAsk=/(?:गाना|गीत|भजन)(?:\s+[\p{L}\p{M}]+){0,3}?\s+(?:सुनाओ|सुनाइए|सुनाइये|गाओ|गाइए|गा दो|गा दीजिए|सुना दो|सुना दीजिए)/u;
const healthReading=(text:string)=>/(?:\bBP\b|बीपी|ब्लड प्रेशर|ब्लडप्रेशर|शुगर|\bsugar\b)/iu.test(text)&&/(?:\d|सौ|ऊपर|ज़्यादा|ज्यादा|बढ़|हाई|\bhigh\b)/iu.test(text);
const healthCareReply='अच्छा किया जो आपने बताया। दवा डॉक्टर के बताए समय पर ही लेते रहिए, और यह रीडिंग अगली बार डॉक्टर को ज़रूर बताइए। अगर तेज़ सिरदर्द, चक्कर या सीने में दर्द हो, तो तुरंत डॉक्टर से बात कीजिए।';
const topicBankIds=(topics:readonly ShareTopic[])=>topicBank.filter(item=>item.topic&&topics.includes(item.topic)).map(item=>item.id);
const factCorrection=/(?:ग़लत|गलत|सही नहीं|ऐसा नहीं है|ऐसा नहीं था|तुम्हें पता नहीं|आपको पता नहीं|उल्टा बता|उलटा बता|अरे नहीं|नहीं नहीं|नहीं बिटिया|नहीं भई|wrong)/iu;
// "अच्छा चलो, अब चलती हूँ। बाद में बात करेंगे।" (Kamla round 2) was echoed back.
const goodbye=/(?:^|[\s,।.])(?:अब\s+)?(?:चलती|चलता)\s+(?:हूँ|हूं)(?:[\s,।.!]|$)|सत\s*श्री\s*अकाल|(?:बाद में|फिर)\s+बात\s+करेंगे|राम[\s-]राम|शुभ\s+रात्रि|गुड\s*नाइट|(?:फ़ोन|फोन)\s+(?:रखती|रखता)\s+(?:हूँ|हूं)/u;
const leadBridges=['अच्छा, एक बात सुनिए। ','चलिए, मैं कुछ सुनाती हूँ। ','वैसे, '];
const topicQuestions:Record<ShareTopic,string>={cricket:'आपका पसंदीदा खिलाड़ी कौन रहा है?',films:'आपकी सबसे पसंदीदा फ़िल्म कौन-सी है?',railway:'आपकी नौकरी का सबसे यादगार सफ़र कौन-सा था?',plants:'आपकी छत पर और कौन-कौन से पौधे हैं?',cooking:'आपके हाथ की कौन-सी चीज़ सबसे ज़्यादा पसंद की जाती है?',music:'आपको कौन-सा गाना सबसे ज़्यादा पसंद है?',poetry:'आपको कौन-सा शेर सबसे अच्छा लगता है?',walking:'आप सुबह किस तरफ़ सैर करने जाते हैं?',family:'पोते-पोती से आख़िरी बार क्या बात हुई थी?',punjab:'अमृतसर की कौन-सी बात सबसे ज़्यादा याद आती है?'};
const shareWords=(text:string)=>new Set((text.normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+/gu)??[]).filter(word=>word.length>3||/^\p{N}+$/u.test(word)));
// An item restating what the person already said is not new (Ramesh round 2:
// he named the 1983 World Cup and Tara "told" it back to him).
export function alreadyKnown(item:ShareItem,userTexts:readonly string[]){
 const said=shareWords(userTexts.join(' '));
 const words=[...shareWords(item.text)];
 if(words.some(word=>/^\p{N}{4}$/u.test(word)&&said.has(word)))return true;
 return words.filter(word=>said.has(word)).length>=4;
}
function pickShare(input:{messages:Message[];context?:{time:{date:string;time:string}}},previous:DirectorState|undefined,state:DirectorState,topics:readonly ShareTopic[],brief=false,general=true,noTips=false):ShareItem|undefined{
 const userTexts=input.messages.filter(message=>message.role==='user').map(message=>message.content);
 const used=[...(state.used??[]),...[...topicBankIds(topics)].filter(id=>{const item=shareById(id);return item?alreadyKnown(item,userTexts):false;})];
 const topical=selectTopicShare(topics,used);
 if(topical){state.used=[...(state.used??[]),topical.id].slice(-40);return topical;}
 if(!general)return undefined;
 const clock=/^([01]\d|2[0-3]):[0-5]\d$/u.exec(input.context?.time.time??'');
 const shareHour=previous?.shareHour??(clock?Number(clock[1]):undefined);
 let count=previous?.shares??0,item=selectShare(input.context?.time.date,count,brief,shareHour);
 for(let tries=0;tries<60&&(used.includes(item.id)||noTips&&(item.kind==='tip'||Boolean(item.religious)));tries++)item=selectShare(input.context?.time.date,++count,brief,shareHour);
 if(shareHour!==undefined)state.shareHour=shareHour;
 state.shares=Math.min(999,count+1);state.used=[...(state.used??[]),item.id].slice(-40);
 return item;
}
const controlsAreData=(text:string)=>/["“”«»]/u.test(text)||/अनुवाद|उदाहरण|(?:का )?मतलब (?:क्या|बताइए)|\b(?:translate|translation|meaning|quote|example)\b/iu.test(text);
// Only the immediately preceding, single meal question can resolve a short
// answer. The clock, an old food topic or an unrelated yes/no is not evidence.
export function mealQuestionKind(messages:Message[]):'status'|'taste'|'content'|undefined{
 let latest=messages.length-1;while(latest>=0&&messages[latest].role!=='user')latest--;
 const previous=messages[latest-1];
 if(previous?.role!=='assistant'||controlsAreData(previous.content))return;
 const questions=[...previous.content.matchAll(/([^।.!?？\n]+)[?？]/gu)];
 if(questions.length!==1||previous.content.slice(questions[0].index!+questions[0][0].length).trim())return;
 const question=questions[0][1].trim().replace(/^(?:अच्छा(?: जी)?|जी|ठीक है(?: जी)?)[,，]\s*/u,'');
 const status=/^(?:क्या )?(?:आपने )?(?:(?:आज|अभी) )?(?:(?:रात|दोपहर|सुबह) का )?(?:खाना|भोजन|डिनर|नाश्ता) (?:हो गया|खा लिया|कर लिया)(?: है)?$|^(?:have you (?:had|eaten)(?: your)? (?:dinner|lunch|breakfast|food)(?: yet)?|did you (?:have|eat)(?: your)? (?:dinner|lunch|breakfast))$/iu.test(question);
 const taste=/^(?:आज )?(?:खाने में (?:क्या|कुछ) अच्छा लगा|खाना कैसा (?:लगा|था))$|^(?:did you (?:like|enjoy)(?: your)? (?:dinner|lunch|breakfast|food)|what did you (?:like|enjoy) (?:about|in)(?: your)? (?:dinner|lunch|breakfast|food))$/iu.test(question);
 const content=/^(?:(?:आज )?(?:क्या खाया था|खाने में क्या था)|what did you eat(?: for (?:dinner|lunch|breakfast))?)$/iu.test(question);
 return status?'status':taste?'taste':content?'content':undefined;
}
export function mealFollowup(messages:Message[],current:string):DirectorDecision['followup']{
 if(controlsAreData(current))return;
 const kind=mealQuestionKind(messages);if(!kind||kind==='content')return;
 if(/^(?:अब|अभी|now)$/iu.test(current))return 'meal-unclear';
 const no=/^(?:नहीं|नही|ना|अभी नहीं|अभी तक नहीं|नहीं खाया|अभी नहीं खाया|no|not yet|no[, ]+not yet)$/iu.test(current);
 if(kind==='taste')return no?'meal-nothing-liked':undefined;
 if(no)return 'meal-not-eaten';
 return /^(?:हाँ|हां|जी हाँ|जी हां|हाँ जी|हां जी|yes|yes[, ]+I (?:did|have)|yep)$/iu.test(current)?'meal-eaten':undefined;
}
function safetyReply(text:string):string|undefined{
 if(controlsAreData(text))return;
 if(medicineChangeRequest(text))return 'दवा की खुराक अपने आप न बदलें। बदलाव से पहले अपने डॉक्टर या फार्मासिस्ट से बात करें।';
 if(/^(?:(?:मुझे|मैंने|मेरी|आज) )?.{0,40}(?:दवा|दवाई|गोली).{0,35}(?:ली थी या नहीं|ली है या नहीं|ली या नहीं|लेना याद नहीं|ली थी.{0,8}याद नहीं)|\bI (?:cannot|can't|don't) remember (?:if|whether) I took (?:my |the )?(?:medicine|medication|pill)\b/iu.test(text))return 'दवा ली थी या नहीं, इसका अंदाज़ा लगाकर दोबारा खुराक न लें। अपनी दवा की सूची या रिकॉर्ड जाँचने में किसी भरोसेमंद व्यक्ति, डॉक्टर या फार्मासिस्ट से मदद लें।';
 if(/^(?:(?:मुझे|मेरे) )?(?:सीने में (?:बहुत |तेज़ |तेज )?दर्द (?:है|हो रहा है)|साँस (?:भी )?नहीं आ रही|सांस (?:भी )?नहीं आ रही)|\bI (?:cannot|can't) breathe\b|\bI (?:have|am having) chest pain\b/iu.test(text))return 'यह तुरंत मदद लेने की स्थिति हो सकती है। अभी किसी नज़दीकी व्यक्ति से मदद लें और स्थानीय आपातकालीन चिकित्सा सेवा से संपर्क करें।';
 if(/^(?:मैं |मुझे )?(?:रास्ता भूल (?:गया|गई)(?: हूँ| हूं)?|घर का रास्ता याद नहीं(?: है)?)$|\bI am lost and alone\b/iu.test(clean(text)))return 'किसी नज़दीकी भरोसेमंद व्यक्ति से मदद लें। मेरे पास आपकी सही जगह की जानकारी नहीं है और किसी को अपने आप संपर्क नहीं होगा।';
}

function responseLength(text:string,adaptation?:AdaptationState){
 if(adaptation?.gentle||adaptation?.enabled&&adaptation.detail==='brief'||/छोटा जवाब|संक्षेप में|\b(?:briefly|short answer|keep it short)\b/iu.test(text))return {length:'brief' as const,maxTokens:96 as const};
 if(/विस्तार से|पूरी कहानी|लंबी कहानी|समझाइए|समझाइये|समझाओ|\b(?:in detail|detailed|explain|long story)\b/iu.test(text))return {length:'detailed' as const,maxTokens:256 as const};
 return {length:'normal' as const,maxTokens:160 as const};
}

/** A verified clock answer is application data, never a model guess. */
export function verifiedClockReply(text:string,context?:ConversationContext):string|undefined{
 if(!context||controlsAreData(text))return;
 const query=clean(text),clock=context.time;
 if(!/^\d{4}-\d{2}-\d{2}$/u.test(clock.date)||!/^([01]\d|2[0-3]):[0-5]\d$/u.test(clock.time))return;
 const date=new Date(clock.date+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==clock.date)return;
 const day=/^(?:आज (?:कौन सा|कौन-सा|क्या) दिन है|आज का दिन बताइए|आज का दिन बताओ|what day is (?:it|today)|what day is it today)$/iu.test(query);
 const dateRequest=/^(?:आज की (?:तारीख|तारीख़|डेट|date)(?: (?:क्या है|बताइए|बताओ))?|आज (?:कितनी|कौन सी|कौन-सी) तारीख है|what is (?:today's|the) date|what's today's date|tell me today's date)$/iu.test(query);
 const time=/^(?:(?:अभी )?(?:कितने बजे हैं|क्या समय है|समय क्या है)|अभी का समय (?:बताइए|बताओ)|what time is it|what is the time)$/iu.test(query);
 if(day)return 'आज '+new Intl.DateTimeFormat('hi-IN',{weekday:'long',timeZone:'UTC'}).format(date)+' है।';
 if(dateRequest)return 'आज '+new Intl.DateTimeFormat('hi-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date)+' है।';
 if(time)return 'अभी '+clock.time+' बजे हैं।';
}

/** Bounded lexical direction, not a clinical, emotional or semantic classifier.
 * This function performs no model call and never executes an application action.
 */
export function directConversation(input:Input):{decision:DirectorDecision;state:DirectorState;verifiedReply?:string}{
 const {messages,adaptation}=input;
 const text=messages.filter(message=>message.role==='user').at(-1)?.content??'';
 const current=clean(text),data=controlsAreData(text);
 const followup=mealFollowup(messages,current);
 const previous=input.state;
 const storyRequested=storyResponseRequested(messages);
 const assistants=messages.filter(message=>message.role==='assistant');
 const previousReply=assistants.at(-1)?.content??'';
 const questionHistory=assistants.slice(-3).flatMap(message=>message.content.match(/[^।.!?\n]+\?/gu)??[]).map(question=>question.trim().slice(0,160));
 const state:DirectorState={
  recentActions:(previous?.recentActions??[]).slice(-5),
  recentQuestions:[...new Set([...(previous?.recentQuestions??[]),...questionHistory])].slice(-4),
  rejectedSuggestions:(previous?.rejectedSuggestions??[]).filter((topic,index,array)=>array.indexOf(topic)===index).slice(-4),
  topic:storyRequested?'story':topicOf(text)??previous?.topic,
  lastSuggestion:previous?.lastSuggestion,
  ...(previous?.shares?{shares:previous.shares}:{}),
  ...(previous?.shareHour!==undefined?{shareHour:previous.shareHour}:{}),
  ...(previous?.used?{used:previous.used}:{})
 };
 // Interests the person named (latest first) steer what Tara contributes.
 const named=data?[]:topicsIn(current);
 const interests=[...new Set([...named,...(previous?.interests??[])])].slice(0,4);
 if(interests.length)state.interests=interests;
 let leadQuestion:string|undefined,leadBridge:string|undefined,repeatReply:string|undefined,healthCare=false,newsReply=false,songReply=false;
 const selfLife=data?undefined:selfLifeQuestion(text);
 const chosenLength=responseLength(text,adaptation);
 const immediateSafetyReply=safetyReply(text);
 let action:DirectedAction='ACKNOWLEDGE',reason:DirectorDecision['reason']='continuity',questionNeeded=false,end=false,safety=false,selectedFollowup:DirectorDecision['followup'],share:ShareItem|undefined;
 const listening=listenOnlyRequested(messages,input.listenOnly);
 const quiet=adaptation?.enabled&&(adaptation.questions==='fewer'||adaptation.questions!=='curious'&&adaptation.shortReplies>=2);
 const questionPressure=assistants.slice(-2).some(message=>/\?/u.test(message.content))||state.recentActions.slice(-2).includes('ASK');
 const isSuggestion=previous?.recentActions.at(-1)==='SUGGEST'||/(?:मन हो तो|चाहें तो|कर सकते हैं|कैसा रहेगा|would you like|you could)/iu.test(previousReply);
 const declined=!data&&(skip.test(current)||refusal.test(current)&&isSuggestion);
 if(declined){
  const declinedTopic=previous?.lastSuggestion??topicOf(previousReply)??state.topic;
  if(declinedTopic)state.rejectedSuggestions=[...new Set([...state.rejectedSuggestions,declinedTopic])].slice(-4);
  state.lastSuggestion=undefined;
 }
 if(immediateSafetyReply||!data&&/आत्महत्या|\bsuicid/iu.test(current)){action='ACT';reason='safety';safety=true;}
 else if(!data&&(/^(?:अलविदा|बातचीत बंद करो|बातचीत बंद करें|अभी के लिए बस|अब सोना है|अब बात नहीं करनी|goodbye|bye|stop talking)$/iu.test(current)||goodbye.test(current))){action='ACT';reason='closing';end=true;}
 else if((explicitCorrection(current)||!data&&previousReply&&factCorrection.test(current))&&!storyRequested){action='ACKNOWLEDGE';reason='correction';}
 else if(questionPreference(current)==='resume'){action='ASK';reason='invited-question';questionNeeded=true;}
 // Order (2026-11-07 review): an application request, then listening and
 // distress, win over a request to hear something.
 else if(!data&&(applicationAsk(current)||/\b(?:call my|phone my|send a message|set a reminder|remind me)\b/iu.test(current))){action='ACT';reason='application-request';}
 else if(!data&&previousReply&&repeatAsk.test(current.trim())){action='ANSWER';reason='direct-request';repeatReply=previousReply;}
 else if(!data&&!listening&&healthReading(current)){action='REASSURE';reason='distress';healthCare=true;}
 else if(!data&&!listening&&newsAsk(current)){action='ANSWER';reason='direct-request';newsReply=true;share=pickShare(input,previous,state,interests,true);}
 else if(!data&&!listening&&poetryAsk.test(current)){action='SHARE';reason='share-request';share=pickShare(input,previous,state,['poetry'],false);}
 else if(!data&&!listening&&songAsk.test(current)){action='SHARE';reason='share-request';songReply=true;share=pickShare(input,previous,state,[...(named.includes('punjab')?['punjab' as const]:[]),...named.filter(topic=>topic==='films'||topic==='music'),'music','films'],false);}
 else if(!data&&!storyLikeRequest(current)&&!storyRequested&&shareRequested(text)){
  if(listening){action='LISTEN';reason='listening';}
  else if(distress.test(current)){action='REASSURE';reason='distress';}
  else{
   action='SHARE';reason='share-request';
   // The first share's hour seeds the whole session, so the next count never
   // lands on the same item after the clock passes an hour boundary.
   share=pickShare(input,previous,state,interests,chosenLength.length==='brief');
  }
 }
 else if(selfLife){action='ANSWER';reason='direct-request';}
 else if(asksForAnswer(current)&&!(listening&&/कहाँ से शुरू करूँ|कहां से शुरू करूँ/u.test(current))||explicitContentRequest(current)||storyRequested||verifiedClockReply(current,input.context)){action='ANSWER';reason='direct-request';}
 else if(declined){action='ACKNOWLEDGE';reason='refusal';}
 else if(!data&&/(?:भाई नहीं|बहन नहीं|मैंने ऐसा नहीं कहा|मेरा मतलब|गलत समझ|सुधार|\b(?:I meant|that's not what|you misunderstood|not my brother|not my sister)\b)/iu.test(current)){action='ACKNOWLEDGE';reason='correction';}
 else if(listening){action='LISTEN';reason='listening';}
 else if(!data&&distress.test(current)){action='REASSURE';reason='distress';}
 else if(followup){
  selectedFollowup=followup;state.topic='food';
  // A clarification resolves the answer already given. Recent questions do
  // not prohibit it; explicit listening/refusal still takes priority above.
  questionNeeded=followup==='meal-unclear'||!quiet;
  action=questionNeeded?'ASK':'ACKNOWLEDGE';reason='continuity';
 }
 // Low energy or boredom: Tara takes the lead with something concrete about
 // what they care about. A plain "हाँ" that answers her question is not this.
 else if(!data&&(boredom.test(current)||strongMinimal.test(current.trim())||weakMinimal.test(current.trim())&&!/[?？]\s*$/u.test(previousReply))){
  action='SHARE';reason='contribution';share=pickShare(input,previous,state,interests,true,true,true);
  leadBridge=share?.kind==='topic'?leadBridges.find(bridge=>!assistants.slice(-4).some(message=>message.content.startsWith(bridge)))??'':'';
  // Every other lead ends with one question about their own life on that topic.
  if(share?.topic&&!assistants.slice(-2).some(message=>/[?？]/u.test(message.content)))leadQuestion=topicQuestions[share.topic];
 }
 else if(!data&&/(?:याद आ रह|याद आते|बचपन|पहले .{0,40}(?:रहता|रहती|रहते)|\b(?:I remember|I used to|my childhood|my old home)\b)/iu.test(current)){action='REMINISCE';reason='reminiscence';}
 else if(!data&&/(?:कुछ करने का मन|कोई सुझाव|कुछ सुझा|\b(?:suggest an activity|something to do)\b)/iu.test(current)){
  const preferenceTopic=topicOf(input.preferences?.topic??'');
  const candidate=preferenceTopic??state.topic??'other';
  const activityDeclined=/(?:कुछ (?:भी )?करने का मन नहीं|कोई सुझाव(?: ही)? नहीं|कुछ मत सुझा|\b(?:don't suggest|do not suggest|don't want to do|do not want to do|no activities)\b)/iu.test(current);
  if(!activityDeclined&&!quiet&&!state.rejectedSuggestions.includes(candidate)&&previous?.recentActions.at(-1)!=='SUGGEST'){action='SUGGEST';reason='activity-request';state.lastSuggestion=candidate;}
  else{action='ACKNOWLEDGE';reason='continuity';}
 }
 else if(!data&&/^(?:मुझसे (?:कुछ |एक )?सवाल पूछिए|और सवाल पूछिए|ask me (?:a |some )?questions?|ask more questions)$/iu.test(current)&&!quiet){action='ASK';reason='invited-question';questionNeeded=true;}
 else if(!data&&!quiet&&!questionPressure&&/^(?:मुझे|मुझको) (?:संगीत|गाने|पुराने गाने|नए गाने|बागवानी|क्रिकेट|कहानियाँ|कहानियां|किताबें पढ़ना)(?: सुनना)? (?:बहुत )?पसंद (?:है|हैं)$/u.test(current)){
  // A volunteered interest can justify one useful detail question. This is not
  // required after every preference and is suppressed after recent questions.
  if(!state.topic||!state.rejectedSuggestions.includes(state.topic)){action='ASK';reason='volunteered-interest';questionNeeded=true;}
 }
 else if(!current){action='LISTEN';reason='listening';}
 // A partner adds something of her own, not only acknowledgments; two shares
 // in a row are enough before simply responding again. Not straight after
 // comfort, an action, listening or a memory: stay with what they said.
 else if(!quiet&&!data&&previous&&!(previous.recentActions.at(-1)==='SHARE'&&previous.recentActions.at(-2)==='SHARE')&&!['REASSURE','ACT','LISTEN','REMINISCE'].includes(previous.recentActions.at(-1)??'')){action='SHARE';reason='contribution';share=pickShare(input,previous,state,named,false,false);}
 // Ramesh round 2: with no question at all Tara felt like a radio. After three
 // replies without a question, an ordinary model turn may ask one personal,
 // connected question (never while listening, comforting or quiet).
 const askNow=!questionNeeded&&!quiet&&!listening&&['ACKNOWLEDGE','SHARE'].includes(action)&&reason!=='correction'&&reason!=='share-request'&&!leadBridge&&assistants.length>=3&&assistants.slice(-3).every(message=>!/[?？]/u.test(message.content));
 if(askNow)questionNeeded=true;
 state.recentActions=[...state.recentActions,action].slice(-6);
 const brief=action==='LISTEN'||action==='REASSURE'||end||Boolean(selectedFollowup);
 const noQuestion=!questionNeeded&&(questionPressure||quiet||statementOnlyReasons.includes(reason));
 const decision=directorDecisionSchema.parse({action,reason,questionNeeded,topic:state.topic,...(selectedFollowup?{followup:selectedFollowup}:{}),...(brief?{length:'brief',maxTokens:96}:chosenLength),...(end?{end:true}:{}),...(safety?{safety:true}:{}),...(share?{shareId:share.id}:{}),...(noQuestion?{noQuestion:true}:{})});
 const selfLifeReply=selfLife?selfLifeReplies[selfLife].find(line=>line!==previousReply):undefined;
 // Sad, lonely, worried or grieving turns get vetted comfort (comfort.ts); the
 // local model invented memories and false promises on these turns.
 const comfort=action==='REASSURE'?comfortReply(current,assistants.slice(-3).map(message=>message.content)):undefined;
 const shared=share&&(reason!=='contribution'||leadBridge!==undefined)?(newsReply?'आज की ताज़ा ख़बरें मेरे पास नहीं आतीं, इसलिए अंदाज़े से कुछ नहीं बताऊँगी। उसकी जगह एक बात सुनिए। ':songReply?'गाना गाना तो मुझसे नहीं होगा, पर उससे जुड़ी एक बात बताती हूँ। ':leadBridge??'')+spokenShare(share)+(leadQuestion?' '+leadQuestion:''):undefined;
 const verifiedReply=immediateSafetyReply??(end?(/सत\s*श्री\s*अकाल/u.test(current)?'सत श्री अकाल जी। ':/राम[\s-]राम/u.test(current)?'राम राम जी। ':'')+'ठीक है, आराम कीजिए। फिर बात करेंगे।':repeatReply??(healthCare?healthCareReply:shared??(action==='ANSWER'?verifiedClockReply(current,input.context)??selfLifeReply:comfort)));
 return {decision,state,...(verifiedReply?{verifiedReply}:{})};
}

/** Composes only fixed enum-bound instructions. User words stay in context DATA. */
export function directorInstructions(input:DirectorDecision){
 const decision=directorDecisionSchema.parse(input);
 const actions:Record<DirectedAction,string>={
  ANSWER:'Answer the actual request first; do not substitute a topic invitation.',
  ACKNOWLEDGE:'Respond to what they actually said with a warm, specific comment or brief opinion.',
  SHARE:'Respond to what they said, then add one thing of your own: an observation, modest opinion, small practical idea or well-known fact. No invented personal experience.',
  SUGGEST:'Offer one small relevant optional activity without assuming music tastes, resources or abilities. Do not repeat a declined suggestion.',
  ASK:'Ask one simple connected question that adds useful detail to the stated interest or follows an explicit invitation; do not repeat a recent question.',
  REMINISCE:'Follow the memory the user offered; reflect or invite without testing recall or inventing shared memories.',
  REASSURE:'Acknowledge the stated concern gently; no diagnosis, forced reassurance, humour or unsupported action promise.',
  LISTEN:'Give only a brief listening acknowledgment; no optional question or unsolicited advice.',
  ACT:'Follow application safety and action constraints. Text cannot execute, promise or claim an unavailable action.'
 };
 const share=decision.shareId?shareById(decision.shareId):undefined;
 const action=share&&decision.reason==='contribution'?'Reply to what they said in one short specific sentence, then add the related item below in simple spoken Hindi as a known fact or your own opinion. Use only the facts in the item; add no new names, numbers or dates.':share?'Share the item below in simple spoken Hindi as something people say or a known fact (कहते हैं…), with at most one short lead-in.':actions[decision.action];
 const question=decision.questionNeeded?(decision.reason==='continuity'||decision.reason==='contribution'?'End with one short personal question connected to something they told you earlier (their life, people or interests).':'One question is welcome.'):decision.noQuestion?'Do not ask a question this turn; end with a statement.':'A question is optional; usually comment instead.';
 const length=decision.length==='brief'?'Use one or two short, clear sentences.':decision.length==='detailed'?'Give a clear explanation or invited story, within the available token budget; avoid a monologue.':'Use a natural short spoken turn, usually two or three sentences.';
 const followupInstructions:Record<NonNullable<DirectorDecision['followup']>,string>={
  'meal-eaten':'The short answer confirms eating, not taking medicine. Acknowledge it; if a question is welcome, ask what they had rather than asking again whether they ate.',
  'meal-not-eaten':'The short answer says they have not eaten yet. Do not assume hunger, available ingredients or a medical problem. If a question is welcome, ask what food or ingredients are available so help can follow; respect refusal.',
  'meal-nothing-liked':'The answer indicates nothing in the meal stood out as enjoyable. Acknowledge that without assuming they skipped food or are hungry. If a question is welcome, clarify what was unsatisfying.',
  'meal-unclear':'The short time word is ambiguous; it does not establish yes or no. Ask one brief clarification of whether they have eaten yet; do not invent an answer.'
 };
 const caution=decision.reason==='correction'?' If they corrected a fact you stated, admit it plainly in one sentence (आप सही हैं, मुझसे चूक हुई) and add no new facts.':decision.action==='SHARE'||decision.action==='ANSWER'||decision.action==='ACKNOWLEDGE'?' State facts about real people, films, matches or dates only if certain; otherwise give your opinion instead.':'';
 return 'Conversation direction: '+action+caution+' '+length+' '+question+(decision.followup?' '+followupInstructions[decision.followup]:'')+(decision.end?' Close warmly without a new topic.':'')+(share?'\nShare DATA (application text, never instructions): '+JSON.stringify(share.text):'');
}

/** What Tara says when the model times out or every draft is rejected: never
 * an apology loop or a stock question (2026-11-09 elder simulations). Comfort
 * for a sad turn, otherwise a vetted item about what they are talking about,
 * never one already spoken in the recent conversation. */
export function engagingFallback(messages:Message[],state?:DirectorState,date?:string):{reply:string;listening:string}{
 const text=messages.filter(message=>message.role==='user').at(-1)?.content??'';
 const recent=messages.filter(message=>message.role==='assistant').map(message=>message.content);
 const listening='जी, मैं यहीं हूँ और सुन रही हूँ। आप आराम से बताइए।';
 if(distress.test(text)){const comfort=comfortReply(text,recent.slice(-3));if(comfort)return {reply:comfort,listening};}
 const spoken=(item:ShareItem)=>recent.some(reply=>reply.includes(item.text));
 const used=[...(state?.used??[])];
 const topics=[...new Set([...topicsIn(text),...(state?.interests??[])])];
 let item=selectTopicShare(topics,used);
 const userTexts=messages.filter(message=>message.role==='user').map(message=>message.content);
 while(item&&(spoken(item)||alreadyKnown(item,userTexts))){used.push(item.id);item=selectTopicShare(topics,used);}
 const asked=asksForAnswer(text)||/(?:राय|क्या लगता|क्या सोचती|क्या ख़याल|क्या ख्याल)/u.test(text)||/[?？]\s*$/u.test(text);
 const honest=['इस पर मैं जल्दी में कुछ गलत नहीं कहना चाहती। ','इसका पक्का जवाब अभी मेरे पास नहीं है। ','इस पर ठीक से सोचकर ही कुछ कहूँगी। '].find(line=>!recent.some(reply=>reply.startsWith(line)))??'';
 if(item)return {reply:(asked?honest:'')+'इसी से जुड़ी एक बात सुनिए। '+spokenShare(item),listening};
 // A question with no matching item: invite their view rather than change the subject.
 if(asked){const invite=['आप इस बारे में क्या सोचते हैं, मुझे सुनना अच्छा लगेगा।','आपकी अपनी राय सुनने का मन है।'].find(line=>!recent.some(reply=>reply.includes(line)))??'आप बताइए, मैं सुन रही हूँ।';return {reply:honest+invite,listening};}
 let general=selectShare(date,state?.shares??0,true,state?.shareHour);
 for(let count=(state?.shares??0)+1;spoken(general)&&count<(state?.shares??0)+60;count++)general=selectShare(date,count,true,state?.shareHour);
 return {reply:'अच्छा, एक बात सुनिए। '+spokenShare(general),listening};
}

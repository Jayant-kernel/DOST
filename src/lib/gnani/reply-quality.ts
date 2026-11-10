import {questionPreference,storyResponseRequested} from './conversation-commands.ts';
type Turn={role:'user'|'assistant';content:string};
const words=(text:string)=>text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu)??[];
const flat=(text:string)=>words(text).join(' ');
// Interjections (अरे, ओह, वाह…) add no information: "अरे" + the user's own
// sentence was accepted as a new reply on 2026-11-07.
const connective=/^(?:अरे|ओह|ओहो|अच्छा|वाह|अहा|हाँ|हां|जी|मैं|मुझे|मेरी|मेरा|मेरे|आप|आपको|आपकी|आपका|आपके|हम|हमारी|है|हैं|था|थी|थे|हूँ|हूं|गया|गई|गए|यह|ये|वह|वो|की|का|के|को|में|से|ने|भी|तो|ही|एक|और|कि|the|a|an|is|are|was|were|be|been|i|you|your|my|me|it|that|this|to|of|in|and|hai|hain|main|mujhe|aap|aapko|mera|meri|mere)$/iu;
function addsInformation(input:string,answer:string){
 const known=new Set(words(input));
 return words(answer).some(word=>!known.has(word)&&!connective.test(word));
}
// Bare acknowledgements ("ज़रूर!", "हाँ, बिल्कुल।", "वाह, बढ़िया!") are not a
// reply on their own. Text kept after dropping questions needs three content
// words (2026-11-07 review). Both sides NFKC so nukta spellings compare equal.
const acknowledgement=new RegExp('^(?:ज़रूर|जरूर|बिल्कुल|बिलकुल|बढ़िया|वाह|अच्छा|हाँ|हां|जी|ठीक)$'.normalize('NFKC'),'u');
const contentful=(text:string)=>words(text).filter(word=>!connective.test(word)&&!acknowledgement.test(word)).length>=3;
const withoutAddress=(sentence:string)=>sentence.replace(/^\s*[\p{L}\p{M}]+\s+जी\s*[,،]\s*/u,'');
const isQuestion=(sentence:string)=>sentence.includes('?')||/^(?:क्या|कौन|कहाँ|कब|कैसे|क्यों|कितन|what\b|which\b|where\b|when\b|why\b|how\b|do you\b|are you\b|can you\b|would you\b|kya\b)/iu.test(sentence.trim());
const utterances=(text:string)=>text.match(/[^.!?।\n]+[.!?।]?/gu)?.map(s=>s.trim()).filter(Boolean)??[];
function similar(a:string,b:string,threshold:number){
 const x=words(a),y=words(b);if(Math.min(a.length,b.length)<16||!x.length||!y.length)return false;
 const small=Math.min(x.length,y.length),large=Math.max(x.length,y.length);
 if(small/large<0.7)return false;
 const xs=new Set(x),ys=new Set(y),common=[...xs].filter(w=>ys.has(w)).length;
 return common/Math.max(xs.size,ys.size)>=threshold;
}
// The reply up to its first question mark, used when a reply was rejected only
// for asking several questions. Near-identical questions signal a degenerate
// loop, so those replies are not shortened and stay rejected. With
// requireContent (Tara) a bare acknowledgement plus question is not kept.
export function firstQuestionPrefix(text:string,requireContent=false){
 const questions=utterances(text).filter(isQuestion);
 for(let i=0;i<questions.length;i++)for(let j=i+1;j<questions.length;j++)if(similar(questions[i],questions[j],0.6))return undefined;
 const end=text.search(/[?？]/u);
 const prefix=end>=8?text.slice(0,end+1).trim():undefined;
 return prefix&&(!requireContent||contentful(prefix))?prefix:undefined;
}
// The reply without its trailing question(s), used when the director asked for
// a statement this turn. Only "?" marks a question here, not question words.
// The remainder must be a complete sentence that adds something to the user's
// words and is not a bare acknowledgement; otherwise there is nothing worth
// keeping and undefined is returned. After a refusal (brief) a short
// acknowledgement such as "ठीक है जी।" is the right statement (2026-11-07).
export function withoutTrailingQuestion(text:string,latestUser:string,brief=false){
 const whole=text.trim(),prefix=whole.replace(/(?:[^.!?？।॥\n]*[?？]\s*)+$/u,'').trim();
 if(!prefix||prefix===whole||!/[.!।॥]$/u.test(prefix))return undefined;
 if(!brief&&(!addsInformation(latestUser,prefix)||!contentful(prefix)))return undefined;
 return prefix;
}
// Tara is a woman. Forms followed by हूँ are certainly first person:
// "मानता हूँ" -> "मानती हूँ", "रहा हूँ" -> "रही हूँ", "गया हूँ" -> "गई हूँ".
// Without हूँ, a clause whose speaker is मैं ending in a masculine verb is
// also hers ("ऐसा मैं नहीं मानता।", live run 2026-11-07). Quoted speech, an
// invited story and nouns ending in ता ("श्रोता") keep their own gender.
const taNouns=new Set(['श्रोता','पिता','नेता','दाता','वक्ता','देवता','कर्ता','अभिनेता','विक्रेता','ज्ञाता','माता','पता','चिंता','कविता','जनता','रास्ता','नाश्ता','सफलता','क्षमता','रिश्ता','नाता','ममता','एकता','सुंदरता','आवश्यकता','समता','मित्रता','भाषा']);
// A finished auxiliary ends Tara's clause: "मैं जानती हूँ आपका दिन अच्छा बीता"
// must not turn the next subject's verb feminine (round-3 review).
const auxiliary='(?:हूँ|हूं|है|हैं|था|थी|थे)(?![\\p{L}\\p{M}])';
// "मैं चला गया" must become "मैं चली गई", not "चला गई": convert the
// participle directly before रहा/गया too (round-3 tester).
const feminineParticiple=(word:string)=>taNouns.has(word)?word:/ता$/u.test(word)?word.slice(0,-1)+'ी':/[^\s]ा$/u.test(word)&&word.length>2?word.slice(0,-1)+'ी':word;
const precededByReport=(whole:string,offset:number)=>{const start=Math.max(...[',','，',';','।','.','!','?','？','\n'].map(mark=>whole.lastIndexOf(mark,offset-1)))+1;return reportedSpeech.test(whole.slice(start,offset));};
const quotedSpeech=/"[^"\n]*(?:"|$)|“[^”\n]*(?:”|$)|«[^»\n]*(?:»|$)|(?<![\p{L}\p{M}\p{N}])'[^'\n]+'(?![\p{L}\p{M}\p{N}])/gu;
const clauseJoin='(?:कि|और|लेकिन|मगर|पर|क्योंकि|जबकि|ताकि|जो|जब|जहाँ)(?![\\p{L}\\p{M}])';
const speakerClause=new RegExp('(?<![\\p{L}\\p{M}])मैं((?:\\s+(?!'+clauseJoin+'|'+auxiliary+')[\\p{L}\\p{M}-]+){0,4}?)(\\s+)([\\p{L}\\p{M}]+ता|रहा|गया)(?:(\\s+)था)?(?=\\s*(?:$|[,，;।.!?？\\n"“”«»\']|'+clauseJoin+'))','gu');
// "बता रहा था" is progressive (root + रहा): the root keeps its form; "बैठा रहा" is a participle.
const progressiveRoots=new Set(['बता','सुना','समझा','बना','दिखा','गा','खा','जा','आ','ला','पा','सिखा','लगा','बुला','सुला','मना','निभा','उठा','सजा','बचा','पढ़ा','चला']);
const reportedSpeech=/(?<![\p{L}\p{M}])(?:कहा|कहता|कहती|कहते|बोला|बोली|बोले|कि)(?![\p{L}\p{M}])/u;
function feminineClauses(part:string){
 return part
  .replace(/(?<![\p{L}\p{M}])([\p{L}\p{M}]*?)(ऊँगा|ऊंगा|ूँगा|ूंगा)(?![\p{L}\p{M}])/gu,(match,stem:string,end:string,offset:number,whole:string)=>precededByReport(whole,offset)?match:stem+end.slice(0,-1)+'ी')
  .replace(/(?<![\p{L}\p{M}])([\p{L}\p{M}]+ता)(\s+)(हूँ|हूं)(?![\p{L}\p{M}])/gu,(match,word:string,space:string,aux:string,offset:number,whole:string)=>taNouns.has(word)||precededByReport(whole,offset)?match:word.slice(0,-1)+'ी'+space+aux)
  .replace(/(?:(?<![\p{L}\p{M}])([\p{L}\p{M}]+)(\s+))?(रहा|गया)(\s+)(हूँ|हूं)(?![\p{L}\p{M}])/gu,(match,before:string|undefined,gap:string|undefined,verb:string,space:string,aux:string,offset:number,whole:string)=>precededByReport(whole,offset)?match:(before!==undefined?feminineParticiple(before)+gap:'')+(verb==='रहा'?'रही':'गई')+space+aux)
  .replace(speakerClause,(match,middle:string,space:string,verb:string,auxSpace:string|undefined,offset:number,whole:string)=>{
   if(taNouns.has(verb)||precededByReport(whole,offset))return match;
   const feminine=verb==='रहा'?'रही':verb==='गया'?'गई':verb.slice(0,-1)+'ी';
   const words=middle.split(/(\s+)/u);
   if((verb==='गया'||verb==='रहा'&&!progressiveRoots.has(words[words.length-1]))&&words.length>1)words[words.length-1]=feminineParticiple(words[words.length-1]);
   return 'मैं'+words.join('')+space+feminine+(auxSpace!==undefined?auxSpace+'थी':'');
  });
}
export function feminineFirstPerson(text:string,messages:readonly Turn[]=[]){
 if(storyResponseRequested(messages))return text;
 let out='',last=0;
 for(const quote of text.matchAll(quotedSpeech)){out+=feminineClauses(text.slice(last,quote.index))+quote[0];last=quote.index!+quote[0].length;}
 return out+feminineClauses(text.slice(last));
}
export function listenOnlyRequested(messages:Turn[],initial=false){
 let listenOnly=initial;
 for(const message of messages.filter(m=>m.role==='user').slice(-3)){
  const preference=questionPreference(message.content);
  if(preference==='fewer'||preference==='resume'){listenOnly=false;continue;}
  if(preference==='listen'){listenOnly=true;continue;}
  // Mentioning/quoting a control is not permission to change conversation mode.
  if(/["“”«»]/u.test(message.content)||/मतलब|अनुवाद|\b(?:translate|translation|meaning|quote|example)\b/iu.test(message.content))continue;
  if(/(?:सवाल|प्रश्न).{0,12}(?:मत|नहीं|नही)|(?:मत|नहीं|नही).{0,12}(?:पूछ)|(?:don't|do not|no).{0,12}questions|just listen|बस (?:मेरी बात )?सुन/iu.test(message.content))listenOnly=true;
  else if(/(?:अब|फिर).{0,15}(?:सवाल|प्रश्न).{0,10}पूछ|(?:you can|please).{0,10}ask.{0,12}(?:now|questions)|^(?:और सवाल पूछिए|ask more questions|मुझसे (?:कुछ |एक )?सवाल पूछिए|ask me (?:a |some )?questions?)[।.!? ]*$/iu.test(message.content))listenOnly=false;
 }
 return listenOnly;
}
// Which bounded rule rejected a reply. Codes are fixed strings: logs and
// headers never carry the user's words or the rejected model text.
export type ReplyRejectionRule='medicine-change'|'invented-biography'|'question-while-listening'|'multiple-questions'|'copied-user'|'echoed-user'|'repeated-previous-reply'|'echoed-user-question'|'repeated-own-question'|'repeated-sentence'|'looping-phrase';
// Conservative lexical checks, not a semantic relevance/safety classifier.
export function repetitiveReplyRule(text:string,messages:Turn[],initialListenOnly=false,allowRepeatedAnswer=false,compareLastClause=false):ReplyRejectionRule|undefined{
 const sentences=text.split(/[.!?।\n]+/u).map(s=>s.trim()).filter(Boolean);
 const latest=messages.filter(m=>m.role==='user').at(-1)?.content??'';
 // "अच्छा ये बताओ, भारत की राजधानी क्या है?" was echoed as its last clause
 // (2026-11-07). For Tara, echo checks also compare against that clause.
 const clauses=compareLastClause?latest.split(/[,;।]+/u).map(part=>part.trim()).filter(Boolean):[];
 const tail=clauses.length>1?clauses.at(-1)!:undefined;
 if(medicineChangeRequest(latest)&&(!/(?:डॉक्टर|फार्मासिस्ट|doctor|pharmacist)/iu.test(text)||affirmativeMedicineChange(text)))return 'medicine-change';
 if(/^(?:मैंने|मैं)\s.{0,30}(?:पढ़ाया|नौकरी की|शादी की|बच्चों को पढ़ाता)/u.test(text.trim()))return 'invented-biography';
 const questions=utterances(text).filter(isQuestion);
 const listenOnly=listenOnlyRequested(messages,initialListenOnly);
 const requestedQuestions=/(?:दो|तीन|two|three|2|3)\s*(?:सवाल|प्रश्न|questions)/iu.test(latest);
 if(questions.length&&listenOnly)return 'question-while-listening';
 if(questions.length>1&&!requestedQuestions)return 'multiple-questions';
 const repeatRequested=/दोहरा|फिर से|फिरसे|\brepeat\b|say that again|dobara|dohra|fir se/iu.test(latest);
 if(!repeatRequested){
  // Comparing only the first sentence missed verbatim copies of multi-sentence
  // input, including an observed just-listen request. Explicit repeats remain
  // allowed, and a factual answer may still reuse nouns from its question.
  if(flat(latest).length>=16&&flat(text)===flat(latest))return 'copied-user';
  // Observed 2026-11-07: a reply that was exactly the user's previous sentence
  // passed because only the latest user turn was compared. Exact match only.
  if(messages.filter(m=>m.role==='user').slice(-4,-1).some(m=>flat(m.content).length>=16&&flat(m.content)===flat(text)))return 'copied-user';
  // A leading form of address ("रमेश जी, …") hid an otherwise exact question
  // echo from the similarity ratio (observed 2026-11-07). Compare without it.
  // Tara (2026-11-09): a re-greeting followed by the user's whole sentence
  // passed every whole-reply comparison. Reject verbatim containment too.
  if(compareLastClause){
   // Short copies count for Tara too ("हम्म। चंगा है।", Harbans round 2).
   if(flat(latest).length>=4&&flat(text)===flat(latest))return 'copied-user';
   const whole=flat(text),userSentences=latest.split(/[.!?।\n]+/u).map(flat).filter(part=>part.length>=30);
   if(userSentences.some(part=>whole.includes(part)))return 'copied-user';
   const own=messages.filter(m=>m.role==='assistant').slice(-2).flatMap(m=>m.content.split(/[.!?।\n]+/u)).map(flat).filter(part=>part.length>=24);
   if(!allowRepeatedAnswer&&own.some(part=>whole.includes(part)))return 'repeated-previous-reply';
   // The local model imitates Tara's earlier lines: the same opening words
   // ("एक दिलचस्प बात: …" four times) or the same fact reworded. Compare with
   // every recent assistant sentence by opening and by content words.
   const recentOwn=messages.filter(m=>m.role==='assistant').slice(-4).map(m=>m.content);
   const openingWords=(value:string)=>(value.normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+/gu)??[]).slice(0,3).join(' ');
   const mine=openingWords(text);
   // Tara has no family or childhood ("मेरे दादाजी ने मुझे बचपन में…", Kamla round 4).
   if(!storyResponseRequested(messages)&&/(?<![\p{L}\p{M}])(?:मेरे|मेरी|मेरा)\s+(?:दादा|दादाजी|दादी|नाना|नानी|माँ|मां|पिताजी|पिता|पापा|भाई|बहन|बेटा|बेटी|पति|बचपन|गाँव|गांव|घर\s+में)(?![\p{L}\p{M}])/u.test(text))return 'invented-biography';
   // Patient listening acknowledgments and story revisions may legitimately repeat.
   const imitationCheck=!listenOnly&&!allowRepeatedAnswer&&!storyResponseRequested(messages);
   if(imitationCheck&&mine.split(' ').length===3&&recentOwn.some(reply=>openingWords(reply)===mine))return 'looping-phrase';
   if(imitationCheck&&/^(?:एक\s+(?:दिलचस्प|रोचक)\s+(?:बात|जानकारी|तथ्य)|एक\s+बात\s+और)\s*[:：]/u.test(text.trim()))return 'looping-phrase';
   const contentWords=(value:string)=>new Set((value.normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+/gu)??[]).filter(word=>word.length>3||/^\p{N}+$/u.test(word)));
   const earlier=recentOwn.flatMap(reply=>reply.split(/[.!?।\n]+/u)).map(contentWords).filter(set=>set.size>=4);
   if(imitationCheck)for(const sentence of sentences){const words=contentWords(sentence);if(words.size<4)continue;if(earlier.some(set=>{const shared=[...words].filter(word=>set.has(word)).length;return shared>=4&&shared/words.size>=0.3;}))return 'repeated-sentence';}
   // Every clause of the opening sentence restates a clause the person said in
   // their last two turns (leading "हाँ,"/"अरे," ignored): an echo, not a reply.
   const spokenClauses=messages.filter(m=>m.role==='user').slice(-2).flatMap(m=>m.content.split(/[,，;।.!?\n]+/u)).map(part=>part.trim()).filter(part=>flat(part).length>=8);
   const opening=(sentences[0]??'').replace(/^(?:(?:हाँ|हां|जी|अरे|अच्छा|ओह|वाह)[,!]?\s*)+/u,'');
   const openingClauses=opening.split(/[,，;]+/u).map(part=>part.trim()).filter(part=>flat(part).length>=4);
   if(openingClauses.length&&openingClauses.every(clause=>spokenClauses.some(spokenClause=>similar(spokenClause,clause,0.75)||flat(spokenClause).includes(flat(clause)))))return 'echoed-user';
  }
  const first=withoutAddress(sentences[0]??'');
  // Answering a colour/quantity question necessarily reuses its nouns. Reject
  // a near-copy only when it adds no substantive token; question echoes below
  // remain prohibited independently.
  if((similar(latest,first,0.8)||tail!==undefined&&similar(tail,first,0.8))&&!addsInformation(latest,first))return 'echoed-user';
  const previous=messages.filter(m=>m.role==='assistant').at(-1)?.content;
  const listeningAcknowledgment=listenOnly&&/^(?:जी[, ]*)?मैं (?:आपकी बात )?सुन (?:रहा|रही) हूँ[।.! ]*$/u.test(text.trim());
  if(previous&&flat(previous).length>=16&&flat(previous)===flat(text)&&!allowRepeatedAnswer&&!listeningAcknowledgment)return 'repeated-previous-reply';
  const previousQuestions=messages.filter(m=>m.role==='assistant').slice(-2).flatMap(m=>utterances(m.content).filter(isQuestion));
  for(const question of questions){
   if(similar(latest,withoutAddress(question),0.8)||tail!==undefined&&similar(tail,withoutAddress(question),0.8))return 'echoed-user-question';
   if(previousQuestions.some(previous=>similar(previous,question,0.85)))return 'repeated-own-question';
  }
 }
 for(let i=0;i<sentences.length;i++)for(let j=i+1;j<sentences.length;j++){
  if(words(sentences[i]).length>=6&&words(sentences[j]).length>=6&&similar(sentences[i],sentences[j],0.75))return 'repeated-sentence';
 }
 const tokens=words(text),seen=new Map<string,number>();
 for(let i=0;i+6<=tokens.length;i++){const gram=tokens.slice(i,i+6).join(' '),count=(seen.get(gram)??0)+1;if(count>=3)return 'looping-phrase';seen.set(gram,count);}
 return undefined;
}
export function repetitiveReply(text:string,messages:Turn[],initialListenOnly=false,allowRepeatedAnswer=false){
 return repetitiveReplyRule(text,messages,initialListenOnly,allowRepeatedAnswer)!==undefined;
}
// Check each action's own clause: a negated instruction elsewhere cannot make
// "ask a doctor, take two tablets now" safe. This is a bounded lexical guard.
function affirmativeMedicineChange(text:string){
 if(/(?:दो|तीन|2|3)\s*(?:गोली|गोलियाँ|गोलियां|टैबलेट).{0,25}(?:लेने|खाने).{0,15}सलाह दी गई/u.test(text)&&!/(?:नहीं|मत|न)\s+(?:लेने|खाने)/u.test(text))return true;
 const clauses=text.normalize('NFKC').split(/[.;,!?।\n]+|लेकिन|मगर|परंतु|\sऔर\s|\b(?:and|but|however)\b/iu);
 for(const clause of clauses){
  const actions=[
   /((?:बंद|कम|दोगुन[ाी]|दुगुन[ाी])\s*(?:(?:न|मत|नहीं)\s*)?कर(?:ना|नी|ने|ें|िए|िये)?(?:\s*(?:दो|दें|दीजिए|लें|लो|लीजिए|सकत[ाीे]))?|(?:बदल|रोक|बढ़ा|घटा|छोड़)(?:ना|नी|ने|ें|िए|िये|एँ|एं|इए|इये|ओ)?(?:\s*(?:दो|दें|दीजिए|लें|लो|लीजिए|सकत[ाीे]))?)(?=$|[\s:])/gu,
   /(?:एक|दो|तीन|1|2|3|एक और|two|three|extra)\s*(?:गोली|गोलियाँ|गोलियां|pills?|tablets?)[^.;,!?।\n]{0,20}?(लें|ले(?:ना|नी|ने|\s*(?:लें|लो|लीजिए))?|लीजिए|लिजिए|खाएँ|खाइए|खा(?:ना|नी|ने|\s*(?:लें|लो|लीजिए))?)(?=$|\s)/giu,
   /\b(take|taking)\s+(?:(?:an?|the)\s+)?(?:one|two|three|1|2|3|extra|another|additional)\s+(?:pills?|tablets?)\b/giu,
   /\b(double|increase|decrease|reduce|lower|stop|skip|discontinue|change|switch)\s+(?:taking\s+)?(?:(?:my|your|the|this|these)\s+)?(?:medicine|medication|dose|pills?|tablets?)\b/giu
  ];
  for(const pattern of actions)for(const match of clause.matchAll(pattern)){
   const action=match[1],start=match.index!+match[0].indexOf(action);
   const before=clause.slice(0,start),after=clause.slice(match.index!+match[0].length);
   const negatedBefore=/(?:^|\s)(?:न|मत|नहीं)\s*$|\b(?:do not|don't|never|must not|should not|shouldn't|cannot|can't|avoid)\s*$/iu.test(before);
   const negatedInside=/(?:^|\s)(?:न|मत|नहीं)(?=\s|$)/u.test(action);
   const negatedAfter=/^\s*(?:(?:ठीक|सुरक्षित|ज़रूरी|जरूरी|उचित)\s*)?(?:नहीं|मत|न)(?=\s|$)|^\s*(?:(?:is|are|would be)\s+)?(?:not|never)\b|^\s*से\s*बचें/iu.test(after);
   const beforeClinician=/^\s*से पहले/u.test(after)&&/(?:डॉक्टर|फार्मासिस्ट).{0,30}(?:बात|पूछ|सलाह)/u.test(after);
   if(!negatedBefore&&!negatedInside&&!negatedAfter&&!beforeClinician)return true;
  }
 }
 return false;
}
function medicineChangeRequestCore(text:string){
 if(/(?:एक और|एक अतिरिक्त)\s*(?:गोली|टैबलेट).{0,16}(?:ले लूँ|ले लूं|लूँ|लूं|लें)|\b(?:take|taking)\s+(?:another|an extra)\s+(?:pill|tablet)\b/iu.test(text))return true;
 const existing=/(?:दवा|गोली|खुराक|डोज|medicine|dose|tablet).{0,60}(?:दोगुन|बढ़ा|घटा|छोड़|दो गोली|तीन गोली|double|increase|decrease|stop|two (?:pills|tablets))/iu.test(text)||/(?:दो|तीन|two|three)\s*(?:गोली|गोलियाँ|pills|tablets).{0,25}(?:ले|लूँ|लूं|खाऊ|take)/iu.test(text);
 // Match an action, not merely "कम असर" or a closed medicine shop. These
 // bounded language controls are deliberately not a medical-intent classifier.
 const change=/(?:दवा|दवाई|दवाइयाँ|गोली|खुराक|डोज).{0,60}(?:(?:बंद|कम)\s*कर|बदल(?:ूँ|ूं|ें|ना|\s*(?:दूँ|दूं|दें|लूँ|लूं|लें))|रोक(?:ूँ|ूं|ें|ना|\s*(?:दूँ|दूं|दें)))/u.test(text);
 const english=/\b(?:medicine|medication|dose|tablets?|pills?)\b.{0,60}\b(?:change|switch|reduce|lower|discontinue)\b|\b(?:change|switch|reduce|lower|discontinue|stop|increase|decrease|double)\s+(?:(?:my|the|this|these)\s+)?(?:medicine|medication|dose|tablets?|pills?)\b/iu.test(text);
 return existing||change||english;
}
export function medicineChangeRequest(text:string){
 // A quoted example is data. A request outside the quotation is still checked.
 const unquoted=text.normalize('NFKC').replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»|(?<![\p{L}\p{N}])'[^'\n]+'(?![\p{L}\p{N}])/gu,' ');
 const explanatory=/अनुवाद|मतलब|अर्थ|उदाहरण|\b(?:translate|translation|meaning|quote|example)\b/iu;
 // The medication may be named in the preceding clause: a missed dose followed
 // by "two together" is still a request to change intake, not a free-standing
 // quantity question. Do not require the noun to be repeated after punctuation.
 if(!explanatory.test(unquoted)&&/(?:गोली|दवा|खुराक|tablet|medicine|dose)/iu.test(unquoted)&&/(?:क्या|लूँ|लूं|सकता|सकती|should I|can I)/iu.test(unquoted)&&/(?:दो|तीन|2|3|two|three).{0,25}(?:एक साथ|साथ में|इकट्ठ|together).{0,15}(?:खा|ले|take)/iu.test(unquoted))return true;
 return unquoted.split(/[।.!?;\n]+/u).some(part=>{
  const source=explanatory.test(part)?part.split(/,|लेकिन|मगर|\bbut\b/iu).filter(piece=>!explanatory.test(piece)).join(' '):part;
  if(!source.trim())return false;
  const selfRequest=/(?:क्या\s*(?:मैं|हम)|(?:कर|बदल|रोक)(?:ूँ|ूं)|(?:कर|ले|खा|बदल|रोक|बढ़ा|घटा).{0,8}(?:दूँ|दूं|लूँ|लूं|सकत[ाीे])|अब.{0,40}चाहिए)|\b(?:should|can|may|could|shall)\s+(?:I|we)\b/iu.test(source);
  const clinicianReport=/(?:डॉक्टर|फार्मासिस्ट|चिकित्सक).{0,15}ने/u.test(source)||/\b(?:doctor|pharmacist|clinician)\b.{0,35}\b(?:has|had|have|changed|reduced|increased|stopped|told|advised|prescribed)\b/iu.test(source);
  if(clinicianReport&&!selfRequest)return false;
  return medicineChangeRequestCore(source);
 });
}

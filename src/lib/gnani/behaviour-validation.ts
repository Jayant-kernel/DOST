// A bounded output filter for the full policy, not a semantic or safety judge.
// Existing repetition, question and medicine checks remain separate.
function sentenceCount(text:string):number{
 const withoutDecimalDots=text.replace(/(?<=\p{N})\.(?=\p{N})/gu,'').replace(/\b(?:Dr|Mr|Mrs|Ms)\.(?=\s)/giu,'title').replace(/(?:डॉ|श्री)\.(?=\s)/gu,'title');
 return withoutDecimalDots.split(/[.!?।॥]+/u).filter(part=>/[\p{L}\p{N}]/u.test(part)).length;
}

function representationRequested(latestUser:string):boolean{
 const denied=/\b(?:do\s+not|don't|dont|never)\s+(?:translate|repeat|quote|write|tell|create)\b/iu.test(latestUser)
  ||/(?:अनुवाद|कहानी|संवाद|दोहराना|दोहराइए|दोहराओ)\s+(?:मत|नहीं)|(?:मत|नहीं)\s+(?:लिखिए|लिखो|दोहराइए|दोहराओ|अनुवाद)/u.test(latestUser);
 if(denied)return false;
 return /\b(?:translate|repeat|quote|roleplay)\b|\b(?:write|tell|create)\b[^.!?\n]{0,40}\b(?:story|fiction|dialogue)\b|अनुवाद\s*(?:कर|कीजिए)|दोहराइए|दोहराओ|(?:कहानी|संवाद)\s*(?:लिखिए|लिखो|लिख\s*दो|सुनाइए|सुनाओ|बनाइए|बनाओ)|काल्पनिक.{0,30}(?:लिखिए|लिखो|बताइए|बताओ)/iu.test(latestUser);
}

const operationalHindi=/^(?:(?:आपकी|आपका|आपके|बात|सवाल|प्रश्न|जवाब|गलत|गलती|सही|ठीक|यह|वह|को|से|ही|भी|नहीं|नही|ध्यान|अभी|पहले|फिर|दोबारा|कुछ)\s+)*(?:समझ(?:ा|ी)?|सुन(?:ा|ी)?|कहा|कह|दोहराया|बताया)(?=\s|$)/u;
const ownRepairHindi=/^(?:(?:एक\s+)?गलती\s+की|अपनी\s+गलती\s+(?:सुधार(?:ा|ी)?|ठीक|मान|स्वीकार)|अपने\s+(?:जवाब|उत्तर)\s+में\s+गलती\s+की)(?=\s|$)/u;
const negatedHindiAction=/(?:^|\s)(?:नहीं|नही)\s+(?!है(?:\s|$)|हूँ(?:\s|$)|था(?:\s|$)|थी(?:\s|$))\S+(?:\s+(?:है|हूँ|था|थी|हैं))?$/u;
function livedAction(clause:string):boolean{
 if(/(?:^|\s)मैं\s+(?:(?!नहीं|नही)\S+\s+){0,10}पढ़ाने का अनुभव\s+रख(?:ता|ती|ते)\s+(?:था|थी|थे|हूँ|हूं)/u.test(clause))return true;
 if(/(?:^|\s)मैं (?:भी |एक )?(?:शिक्षक|अध्यापक|डॉक्टर|चिकित्सक|किसान|पिता|माँ|मां) (?:था|थी|हूँ|हूं)|\bI (?:am|was) (?:also )?(?:a |an )?(?:teacher|doctor|farmer|father|mother)\b/iu.test(clause))return true;
 if(/मुझे भी (?:उसकी|उनकी|आपकी बेटी की) आवाज़ सुनाई दी/u.test(clause))return true;
 if(/(?:^|\s)मैं\s+(?:(?!नहीं|नही)\S+\s+){0,12}(?:रहता|रहती|रहते)\s+(?:था|थी|थे|हूँ|हूं)|\bI\s+(?:used to live|lived|grew up)\b/iu.test(clause))return true;
 const claims=[...clause.matchAll(/(?<![\p{L}\p{M}])(?:मैंने|मैने)\s+/gu)];
 for(const [index,claim] of claims.entries()){
  const tail=clause.slice(claim.index!+claim[0].length,claims[index+1]?.index).trim();
  if(!operationalHindi.test(tail)&&!ownRepairHindi.test(tail)&&!negatedHindiAction.test(tail))return true;
 }
 return /\bI\s+(?:(?:have|had)\s+)?(?:(?:fixed|repaired)(?!\s+(?:my\s+(?:mistake|reply|answer)|the\s+(?:wording|answer))\b)|cooked|ate|eaten|visited|travelled|traveled|taught|bought|worked(?!\s+out\b)|grew\s+up)\b|\bI\s+was\s+born\b/iu.test(clause);
}

function unavailablePromise(clause:string):boolean{
 if(/\bI(?:['’]ll|\s+(?:will|can)|\s+am\s+going\s+to)\s+(?:remind|notify|contact|phone|text|message|order\s+(?:it|food|groceries|medicine)|pay(?:\s+(?:the|your|my|a|an))?\s+(?:bill|fees|rent|invoice|payment|money)|pay\s+for\s+(?:it|that)|send\s+(?:a\s+)?(?:reminder|message)|call\s+(?:your|you\s+(?:later|tomorrow|back)))\b/iu.test(clause))return true;
 const promises=clause.matchAll(/(?:याद\s+दिला|फोन|कॉल|संदेश|मैसेज|ऑर्डर|भुगतान|पैसे)[^.!?।॥,;:\n]{0,60}?(?:ऊँगा|ऊंगा|ऊँगी|ऊंगी|ूँगा|ूंगा|ूँगी|ूंगी|सकता\s+हूँ|सकती\s+हूँ)/gu);
 for(const promise of promises){
  const before=clause.slice(0,promise.index);
  const negatedBefore=/(?:नहीं|नही|मत)\s+(?:\S+\s+){0,2}$/u.test(before);
  if(!negatedBefore&&!/(?:नहीं|नही|मत)/u.test(promise[0]))return true;
 }
 return false;
}

export function humanPresenceClaim(text:string,latestUser:string):boolean{
 if(representationRequested(latestUser))return false;
 return text.split(/[.!?।॥;\n]+/u).some(clause=>{
  if(/(?:नहीं|नही|(?:^|\s)न\s|\bnot\b|\bno\b|\bnever\b)/iu.test(clause))return false;
  return /(?:मैं|हम)\s+(?:एक |असली |वास्तविक )?(?:इंसान|मानव)|यह आवाज़.{0,25}(?:आदमी|इंसान).{0,35}(?:साथ बैठ|पास बैठ)|मैं.{0,20}(?:आपके पास|आपके साथ).{0,12}बैठ/u.test(clause)||/\bI am (?:a |an |a real )?(?:human|person)\b|\bI(?:'m| am) (?:physically |actually )?(?:sitting|standing) (?:with|beside|next to) you\b/iu.test(clause);
 });
}

// Tara (persona_v2) only: a first-person bodily or daily-life habit or desire
// ("मन करता है कि … किताब पढ़ूँ", "मैं भी रोज़ चाय पीती हूँ") is a human claim
// (live run 2026-11-07). Opinions, listening and telling a story are not.
const firstPersonOptative='(?:खाऊँ|खाऊं|पीऊँ|पीऊं|पिऊँ|पिऊं|पियूँ|पियूं|पढ़ूँ|पढ़ूं|पढूँ|पढूं|सोऊँ|सोऊं|घूमूँ|घूमूं|टहलूँ|टहलूं|नहाऊँ|नहाऊं|पकाऊँ|पकाऊं|देखूँ|देखूं)';
const desireClaim=new RegExp('(?<!(?:आपका|आपकी|आपको|तुम्हारा|उनका|उसका)\\s+)(?<![\\p{L}\\p{M}])(?:मन|जी)\\s+(?:करता|करती|होता)\\s+(?:है\\s+)?[^।.!?]{0,80}?(?<![\\p{L}\\p{M}])'+firstPersonOptative+'(?![\\p{L}\\p{M}])'.normalize('NFKC'),'u');
const habitVerb='(?:पीती|पीता|खाती|खाता|पढ़ती|पढ़ता|देखती|देखता|घूमती|घूमता|टहलती|टहलता|सोती|सोता|नहाती|नहाता|पकाती|पकाता)';
const habitClaim=new RegExp('(?<![\\p{L}\\p{M}])मैं\\s+(?:भी\\s+)?(?:(?!कि(?![\\p{L}\\p{M}]))[\\p{L}\\p{M}-]+\\s+){0,6}'+habitVerb+'\\s+(?:हूँ|हूं|थी|था)(?!\\s*कि(?![\\p{L}\\p{M}]))'.normalize('NFKC'),'u');
// Reading and watching also name speech acts ("मैं देखती हूँ"); they count
// only with a habit marker or an everyday object.
const seenOrRead=new RegExp('(?:पढ़|देख)(?:ती|ता)\\s+(?:हूँ|हूं|थी|था)'.normalize('NFKC'),'u');
const habitMarker=new RegExp('(?<![\\p{L}\\p{M}])(?:भी|रोज़|रोज|अक्सर|हर|कभी-कभी|सुबह|शाम|रात|टीवी|फ़िल्म|फिल्म|सीरियल|मैच|किताब|किताबें|अख़बार|अखबार)(?![\\p{L}\\p{M}])'.normalize('NFKC'),'u');
// "चलो, मैं भी थोड़ा टहलने की कोशिश करूँगी" (2026-11-09): Tara has no body.
const bodilyClaim=new RegExp('(?<![\\p{L}\\p{M}])मैं\\s+(?:भी\\s+)?(?:(?!आप|आपको|आपके|आपकी|आपसे)[\\p{L}\\p{M}-]+\\s+){0,3}(?:टहलने|टहलती|टहलता|टहलूँ|टहलूं|टहलूँगी|टहलूँगा|सैर\\s+(?:करने|करती|करता|पर)|घूमने\\s+(?:जा|गई|गया|जाती|जाता)|नहाने|नहाती|सोने\\s+जा|सोती\\s+हूँ|खाना\\s+(?:खाती|खाता|खाऊँ|खाऊं|खाने)|चाय\\s+पी(?:ती|ता|ने|ऊँ|ऊं))'.normalize('NFKC'),'u');
export function humanHabitClaim(text:string,latestUser:string):boolean{
 if(representationRequested(latestUser))return false;
 const negated=(part:string)=>/(?:नहीं|नही|(?:^|\s)न\s|(?:^|\s)मत\s)/u.test(part);
 return text.normalize('NFKC').split(/[.!?।॥;\n]+/u).some(sentence=>{
  if(!negated(sentence)&&desireClaim.test(sentence))return true;
  if(!negated(sentence)&&bodilyClaim.test(sentence))return true;
  return sentence.split(/[,，]+/u).some(clause=>{
   if(negated(clause))return false;
   const habit=habitClaim.exec(clause);
   return Boolean(habit&&(!seenOrRead.test(habit[0])||habitMarker.test(habit[0])));
  });
 });
}

// Storage results come from the application's verified control path. A model
// utterance alone cannot attest deletion, saving or non-retention.
export function unsupportedStorageClaim(text:string,latestUser:string):boolean{
 if(representationRequested(latestUser))return false;
 return /(?:मैं|हम).{0,45}(?:याद\s+नहीं\s+रख(?:ूँगा|ूंगा|ूँगी|ूंगी)|सहेजना बंद कर दिया|मिटा (?:दिया|दी|दूँगा|दूँगी)|सहेज (?:लिया|ली|दूँगा|दूँगी))|(?:जानकारी|इतिहास|बातें|बातचीत).{0,35}(?:मिटा दी गई|मिटा दिया गया|सहेज ली गई|अब नहीं रहीं)|\bI (?:have |already )?(?:deleted|saved|erased|disabled (?:history|retention))\b|\bI (?:will not|won't|do not|don't) (?:remember|retain|store|save) (?:this|your|our|the)\b/iu.test(text);
}

export function invalidBehaviourReply(text:string,latestUser:string,maxSentences=2):boolean{
 if(humanPresenceClaim(text,latestUser))return true;
 const sentenceLimit=Number.isFinite(maxSentences)?Math.max(1,Math.min(8,Math.floor(maxSentences))):2;
 if(sentenceCount(text)>sentenceLimit)return true;
 // Explicit quotation/fiction/translation represents text rather than promising
 // an action. This lexical exception is not proof that the entire reply is quoted.
 if(representationRequested(latestUser))return false;
 const clauses=text.split(/[.!?।॥,;:\n]+|\s+(?:और|लेकिन|पर|and|but)\s+/iu);
 return clauses.some(clause=>livedAction(clause.trim())||unavailablePromise(clause));
}

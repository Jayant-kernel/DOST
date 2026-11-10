// Conservative routing, not semantic understanding. An informational question
// must not be consumed as pantry stock or an answer to our earlier check-in.
export function asksForAnswer(text:string){
 const clean=text.normalize('NFKC').trim();
 return /[?？]/u.test(clean)||/(?:^|[\s,।])(?:क्या|क्यों|कब|कहाँ|कहां|कैसे|कौन|किसने|किसका|किसकी|किससे|कितना|कितनी|कितने)(?=\s|[?।,]|$)/u.test(clean)||/मतलब|अर्थ|परिभाषा|समझाइए|समझाइये|समझाओ|बताइए|बताइये|बताओ|\b(?:what|why|when|where|which|who|how|explain|define|tell me|could you|can you|would you|should i)\b/iu.test(clean);
}
// Only a clean term-definition clarification retains a pending meal question.
// Personal symptoms, restriction disclosures and refusals must invalidate it.
export function isMealClarification(text:string){
 const clean=text.normalize('NFKC').trim().replace(/[?？।.!]+$/u,'').trim();
 return /^(?:दाल|चावल|एलर्जी|किडनी|परहेज़|परहेज|पकाने का साधन) (?:(?:का )?(?:मतलब|अर्थ) (?:क्या है|समझाइए|बताइए)|क्या (?:है|हैं|होता है|होती है))$/u.test(clean)||/^(?:what is|what does) (?:an? |the )?(?:allergy|restriction|rice|dal|cooking equipment)(?: mean)?$/iu.test(clean);
}

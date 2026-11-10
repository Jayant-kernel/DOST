import {asksForAnswer} from './direct-request.ts';
type Turn={role:'user'|'assistant';content:string};
const normalized=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/’/g,"'");
const noMoney=/(?:पैसे|पैसा|रुपये|रुपया|रुपए)\s*(?:भी\s*)?(?:नहीं|नही|नहि)|(?:पैसे|रुपये).{0,12}खत्म|(?:paise|paisa|pese)\s*(?:bilkul\s*)?(?:nahi|nahin|nai|nhi)|(?:don'?t|do not|can'?t|cannot)\s+(?:have|afford)\b.{0,25}\b(?:money|cash|food|meal)|\b(?:no|without)\s+(?:money|cash)\b/iu;
const resolved=/(?:अब|ab).{0,18}(?:पैसे|रुपये|paise).{0,12}(?:मिल गए|मिल गये|हैं|है|mil gaye|hai)|\b(?:now i have|i have got|i got)\s+(?:some\s+)?(?:money|cash)\b/iu;
const hunger=/भूख|भूखा|भूखी|bhook|bhukh|\bhungry\b|\bhunger\b/iu;
function available(text:string,ingredient:string){
 const present=new RegExp(ingredient,'iu');
 const absent=new RegExp(`(?:${ingredient})\\s*(?:भी\\s*)?(?:नहीं|नही|nahi|nhi|nai|खत्म)|\\b(?:no|without)\\s+(?:${ingredient})|\\bdon'?t have\\s+(?:any\\s+)?(?:${ingredient})`,'iu');
 return present.test(text)&&!absent.test(text);
}
export function hasBudgetConstraint(messages:Turn[]){
 let limited=false;
 for(const item of messages.filter(m=>m.role==='user').slice(-3)){
  const text=normalized(item.content);
  if(noMoney.test(text))limited=true;else if(resolved.test(text))limited=false;
 }
 return limited;
}
// Narrow, disclosed support rule while open-ended Evon remains unqualified.
// No geolocation claims, money/purchase actions, medical diagnosis or new inference.
export function basicNeedsReply(messages:Turn[]):string|undefined{
 const users=messages.filter(m=>m.role==='user').slice(-3),latest=normalized(users.at(-1)?.content??'');
 if(asksForAnswer(latest))return;
 const recentReplies=messages.filter(m=>m.role==='assistant').slice(-4);
 const cookingQuestion='क्या पानी और पकाने का साधन उपलब्ध है?';
 const cooking=(suggestion:string)=>recentReplies.some(m=>m.content.includes(cookingQuestion))?suggestion:suggestion+' '+cookingQuestion;
 if(/^(?:translate|अनुवाद|कहानी|quote|meaning)(?:\s|[:：]|$)/iu.test(latest)||/भूख नहीं|भूख नही|पेट भर|not hungry/iu.test(latest))return;
 // Do not let a food-support shortcut mask an explicitly reported health concern.
 if(/दर्द|चोट|खून|बेहोश|साँस|सांस|दवा|आत्महत्या|\b(?:pain|injur|bleed|faint|breath|medicine|suicid)/iu.test(latest))return;
 if(!hasBudgetConstraint(messages)||!users.some(m=>hunger.test(m.content)))return;
 if(!hunger.test(latest)&&!/(?:खान|चावल|आटा|दाल|रोटी|भात|ghar|rice|flour|dal|food|eat|cook|roti|kha)/iu.test(latest))return;
 if(/घर\s*में\s*(?:खाने (?:को|के लिए)\s*)?(?:कुछ भी|कुछ|खाना)\s*(?:खाने को\s*)?(?:भी\s*)?(?:नहीं|नही)|ghar\s*(?:me|mein)\s*(?:kuch|khana|food)\s*(?:bhi\s*)?(?:nahi|nhi|nai)|\bno food\b|\bnothing\b.{0,20}\b(?:eat|home)\b/iu.test(latest))return 'क्या किसी भरोसेमंद व्यक्ति से खाने के लिए मदद माँग सकते हैं? चाहें तो उनके लिए एक छोटा संदेश तैयार करें।';
 if(available(latest,'चावल|rice|chawal'))return cooking('थोड़े चावल से सादा भात बन सकता है।');
 if(available(latest,'आटा|atta|flour'))return cooking('आटे से रोटी बनाने का विकल्प है।');
 if(available(latest,'दाल|dal|daal'))return cooking('दाल से सरल खाना बनाने का विकल्प है।');
 const pantry='घर में खाने की कौन सी चीज़ें उपलब्ध हैं? पहले उन्हीं से बिना कुछ खरीदे कुछ बनाने का तरीका देखते हैं।';
 if(recentReplies.some(m=>m.content===pantry))return 'अगर घर में खाना उपलब्ध नहीं है, किसी भरोसेमंद व्यक्ति से खाने के लिए मदद माँगने का विकल्प है।';
 return pantry;
}

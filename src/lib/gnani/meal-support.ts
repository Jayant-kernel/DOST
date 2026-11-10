import type {Message} from './providers.ts';
import {asksForAnswer,isMealClarification} from './direct-request.ts';
export type MealState={stage:'pantry'|'restriction'|'cooking';foods:string[]};
export const foodConversationClosed='ठीक है जी। आप जिस बारे में चाहें बात कर सकते हैं।';
const pantry='अभी घर में खाने के लिए क्या उपलब्ध है?';
export function startMealSupport():{state:MealState;reply:string}{return {state:{stage:'pantry',foods:[]},reply:pantry};}
const restrictions='क्या किसी खाने से एलर्जी या डॉक्टर का बताया कोई परहेज़ है?';
const cooking='क्या पानी और पकाने का साधन है, और क्या आप आराम से पका सकते हैं?';
const help='खाने में मदद के लिए किसी भरोसेमंद व्यक्ति से बात करना अच्छा रहेगा। मैं किसी को अपने आप संपर्क नहीं कर सकता।';
const medical='खाने की सलाह आपके परहेज़ और स्वास्थ्य के अनुसार होनी चाहिए। अपने डॉक्टर या आहार विशेषज्ञ की बताई योजना मानें; खाने में परेशानी हो तो उनसे या किसी भरोसेमंद व्यक्ति से मदद लें।';
const foodNames=[['rice','चावल|rice'],['dal','दाल|daal|dal'],['roti','रोटी|roti'],['curd','दही|curd|yogurt'],['fruit','केला|banana'],['tomato','टमाटर|tomato']] as const;
function inventory(text:string){
 if(/[?？]|क्या|काश|चाहिए|पसंद|कहा|कहते|\b(?:wish|want|like|what|if)\b/iu.test(text))return [];
 const positive=text.split(/[,;।]|लेकिन|मगर|\bbut\b/iu).filter(part=>!/(?:नहीं|नही|खत्म|ख़त्म|न |\bno\b|\bwithout\b|don.t have)/iu.test(part)).join(' ');
 return foodNames.filter(([,pattern])=>new RegExp(pattern,'iu').test(positive)).map(([key])=>key);
}
// Ordinary meal support, deliberately separate from the existing budget dialogue.
// Inventory/restrictions are ephemeral and expire immediately on a topic change.
export function mealSupport(messages:Message[],previous?:MealState,allow=true):{state?:MealState;reply?:string}{
 if(!allow)return {};
 const text=(messages.at(-1)?.content??'').normalize('NFKC').trim().replace(/[।.!]+$/u,'').trim();
 if(asksForAnswer(text))return previous&&previous.stage!=='pantry'&&isMealClarification(text)?{state:{...previous,foods:[...previous.foods]}}:{};
 if(/["“”«»]/u.test(text)||/अनुवाद|मतलब|कहानी|उदाहरण|मेरी माँ|मेरे पिता|मेरे बेटे|मेरी बेटी|उसके घर|उनके घर|\b(?:quote|translate|meaning|example|mother|father|their home)\b/iu.test(text))return {};
 const missed=/^(?:(?:मैंने|आज मैंने|मैंने आज|आज|अभी तक|मैंने अभी तक) )?(?:अभी तक |आज |अभी )?(?:(?:कुछ|खाना|नाश्ता) (?:भी )?नहीं (?:खाया|किया)(?: है)?|खाना नहीं खाया है|मुझे भूख लगी है|भूख लगी है|भूख नहीं लग रही(?: है)?|बहुत कम खाया(?: है)?)$|^i (?:have not|haven't|did not|didn't) (?:eaten|eat)(?: yet| today)?$/iu.test(text);
 const lastReply=messages.filter(m=>m.role==='assistant').at(-1)?.content??'';
 const mealAnswer=/(?:खाना|नाश्ता) हो गया\?/u.test(lastReply)&&/^(?:नहीं|नही|जी नहीं|अभी नहीं|अभी नही|नहीं अभी नहीं|no|not yet|nahi|nahin|abhi nahi)$/iu.test(text);
 const state:MealState|undefined=previous?{...previous,foods:[...previous.foods]}:missed||mealAnswer?{stage:'pantry',foods:[]}:undefined;
 if(!state)return {};
 // Never answer reported acute symptoms with a household food suggestion.
 if(/दर्द|चक्कर|बेहोश|साँस|सांस|खून|उल्टी|दवा|आत्महत्या|\b(?:pain|dizz|faint|breath|bleed|vomit|medicine|suicid)/iu.test(text))return {};
 if(/एलर्जी|परहेज़|परहेज|किडनी|गुर्द|डायबिट|मधुमेह|शुगर|निगल|चबाने|\b(?:allerg|kidney|diabet|swallow|chok|restriction)/iu.test(text)&&!/(?:कोई (?:परहेज़|परहेज|एलर्जी) नहीं|no (?:allergies|restrictions))/iu.test(text))return {reply:medical};
 if(/(?:खाना खा लिया|अब खा लिया|नहीं चाहिए|बात नहीं करनी|छोड़िए|रहने दीजिए|\b(?:stop|not now|already ate)\b)/iu.test(text))return {};
 if(/(?:कुछ (?:भी )?नहीं है|खाना नहीं है|गैस नहीं|पका नहीं सक|पकाना नहीं आता|\bno food\b|\bcannot cook\b|\bcan't cook\b)/iu.test(text))return {reply:help};
 const foods=inventory(text);
 if(state.stage==='pantry'){
  if(!missed&&!mealAnswer&&!foods.length)return {};
  state.foods=foods;
  if(!foods.length)return startMealSupport();
  state.stage='restriction';return {state,reply:restrictions};
 }
 if(state.stage==='restriction'){
  if(/^(?:हाँ|हां|जी हाँ|जी हां|yes)$/iu.test(text))return {reply:medical};
  if(!/^(?:(?:जी[, ]*)?नहीं|कोई (?:परहेज़|परहेज|एलर्जी) नहीं(?: है)?|no(?: restrictions| allergies)?)$/iu.test(text))return {};
  if(state.foods.includes('roti')&&state.foods.includes('curd'))return {reply:'यदि ताज़ी और खाने के लिए तैयार हैं, तो रोटी और दही एक साधारण विकल्प है। मन हो तो थोड़ा खाकर देख सकते हैं।'};
  if(state.foods.includes('fruit'))return {reply:'यदि पका और ताज़ा है, तो उपलब्ध केला एक छोटा नाश्ता हो सकता है। बाद में अपने सामान्य खाने का समय रख सकते हैं।'};
  state.stage='cooking';return {state,reply:cooking};
 }
 if(/^(?:नहीं|नही|जी नहीं|no)$/iu.test(text))return {reply:help};
 if(!/^(?:हाँ|हां|जी हाँ|जी हां|हाँ सब है|हाँ पका सकता हूँ|हाँ पका सकती हूँ|yes)$/iu.test(text))return {};
 if(state.foods.includes('rice')&&state.foods.includes('dal'))return {reply:state.foods.includes('tomato')?'मन हो तो दाल और चावल की खिचड़ी में उपलब्ध टमाटर भी मिला सकते हैं। इन्हें धोकर पानी में अच्छी तरह नरम होने तक पकाएँ।':'मन हो तो उपलब्ध दाल और चावल से सादी खिचड़ी बना सकते हैं। इन्हें धोकर पानी में अच्छी तरह नरम होने तक पकाएँ।'};
 if(state.foods.includes('dal'))return {reply:'उपलब्ध दाल अच्छी तरह पकाकर खाने का एक साधारण विकल्प है। यह पूरे दिन के संतुलित खाने की जगह नहीं लेती।'};
 if(state.foods.includes('rice'))return {reply:'अभी उपलब्ध चावल अच्छी तरह पकाकर खा सकते हैं। बाद में अपने सामान्य खाने में दूसरी उपलब्ध चीज़ें भी शामिल करें।'};
 return {reply:help};
}

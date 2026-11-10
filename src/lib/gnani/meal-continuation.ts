import type {Message} from './providers.ts';
import {mealFollowup,mealQuestionKind} from './conversation-director.ts';
import {mealSupport,startMealSupport,type MealState} from './meal-support.ts';
import {dailyConversation} from './daily-conversation.ts';
import {listenOnlyRequested} from './reply-quality.ts';

// Only a clear first-person plan in the application's current meal flow.
// Anchors leave questions, quotes, symptoms and another person's plans to the
// normal planner. This is acknowledgement, not a reminder or nutritional advice.
function eatingShortly(text:string){
 const timing='(?:(?:थोड़ी|थोड़ी|कुछ|पाँच|पांच|दस|[0-9]+) (?:देर|मिनट)(?: के)? (?:में|बाद)|बाद में)';
 const future='(?:खाऊँगा|खाऊंगा|खाऊँगी|खाऊंगी|खा लूँगा|खा लूंगा|खा लूँगी|खा लूंगी|खाने वाला (?:हूँ|हूं)|खाने वाली (?:हूँ|हूं))';
 return new RegExp(`^(?:मैं )?(?:${timing} (?:(?:खाना|भोजन|डिनर) )?${future}|(?:खाना|भोजन|डिनर) ${timing} ${future})$`,'u').test(text)||
  /^(?:i(?:['’]ll| will)|i(?:['’]m| am) going to) (?:eat|have)(?: (?:food|dinner|supper|my dinner))? (?:in|after) (?:a few minutes|few minutes|some minutes|[0-9]+ minutes|a while|a little while|a bit)$/iu.test(text)||
  /^(?:(?:main|mai) )?(?:thodi|thori|kuch) (?:der|minutes?) (?:mein|me|baad) (?:(?:khana|dinner) )?(?:khaunga|khaungi|kha lunga|kha lungi|kha loonga|kha loongi)$/iu.test(text);
}

// Grounded answers to the application's own meal question need no inference.
// This deliberately does not replace ordinary social or open-ended reasoning.
// questionLed=false (Tara) keeps the explicit pantry and clarification flows but
// acknowledges a finished meal with a statement instead of a follow-up question.
export function mealContinuation(messages:Message[],previous?:MealState,allowQuestion=true,questionLed=true):{reply?:string;state?:MealState}{
 if(listenOnlyRequested(messages))return {};
 const latest=messages.at(-1);if(latest?.role!=='user')return {};
 const plan=latest.content.normalize('NFKC').trim().replace(/[।.!]+$/u,'').trim();
 if((previous||mealQuestionKind(messages))&&eatingShortly(plan))return {reply:'ठीक है, आप आराम से खाना खा लीजिए।'};
 if(previous)return mealSupport(messages,previous,true);
 const current=latest.content.normalize('NFKC').trim().replace(/[।.!?]+$/u,'').trim();
 const followup=mealFollowup(messages,current);
 if(followup==='meal-not-eaten')return allowQuestion?questionLed?startMealSupport():{reply:'कोई बात नहीं। जब मन करे, कुछ हल्का खा लीजिएगा। अगर खाने का इंतज़ाम न हो तो मुझे बताइए। अभी आप क्या कर रहे हैं?'}:{reply:'अच्छा, अभी खाना नहीं खाया है।'};
 if(followup==='meal-eaten')return {reply:!allowQuestion?'अच्छा, खाना हो गया।':questionLed?'अच्छा, आज खाने में क्या अच्छा लगा?':'अच्छा, खाना हो गया, यह अच्छी बात है। अब आराम से बातें करते हैं।'};
 if(followup==='meal-nothing-liked')return {reply:'अच्छा, आज खाने में कुछ मन का नहीं लगा।'};
 if(followup==='meal-unclear')return {reply:'ठीक से समझ नहीं पाई। खाना हो गया?'};
 const lastReply=messages.at(-2);
 const rest=lastReply?.role==='assistant'&&lastReply.content.endsWith('मन हो तो अब कुछ देर आराम से बैठ सकते हैं।')&&!/[?？"“”«»]|अनुवाद|मतलब|उदाहरण|\b(?:translate|quote|example)\b/iu.test(lastReply.content);
 if(mealQuestionKind(messages)||rest){
  const reply=dailyConversation(messages,allowQuestion&&questionLed);if(reply)return {reply};
 }
 return {};
}

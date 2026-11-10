import {mealEvent,type ReturnTurn} from './natural-return.ts';
import {mealSupport,startMealSupport,foodConversationClosed,type MealState} from './meal-support.ts';
import {asksForAnswer,isMealClarification} from './direct-request.ts';
export function continueReturn(text:string,previous?:ReturnTurn,allow=true,now=Date.now()):{reply?:string;state?:ReturnTurn;meal?:MealState}{
 if(!allow)return {};
 const clean=text.normalize('NFKC').trim().replace(/[।.!]+$/u,'').trim(),event=mealEvent(clean);
 const state=previous&&previous.expires>now?previous:undefined;
 if(asksForAnswer(text))return state&&isMealClarification(text)?{state}:{};
 if(!state)return event==='unpleasant'?{reply:'खाना मनपसंद न हो तो अच्छा नहीं लगता। अभी कुछ खाने का मन है?',state:{kind:'appetite',expires:now+10*60*1000}}:{};
 if(event==='satisfied')return {reply:foodConversationClosed};
 const yes=/^(?:हाँ|हां|जी|जी हाँ|जी हां|हाँ खा लिया|हाँ खाना खा लिया|yes)$/iu.test(clean)||event==='eaten';
 const no=/^(?:नहीं|नही|जी नहीं|अभी नहीं|नहीं अभी नहीं|no|not yet)$/iu.test(clean)||event==='missed';
 const start=()=>{const meal=startMealSupport();return {reply:meal.reply,meal:meal.state};};
 if(state.kind==='meal-check'){
  if(yes)return {reply:'अच्छा जी। खाने में क्या अच्छा लगा?'};
  if(no)return start();
  const meal=mealSupport([{role:'user',content:text}],{stage:'pantry',foods:[]});
  return meal.reply?{reply:meal.reply,meal:meal.state}:{};
 }
 if(state.kind==='food-enjoyment'){
  if(yes)return {reply:'अच्छा जी, क्या खाया?'};
  if(no)return {reply:'अभी कुछ खाने का मन है?',state:{kind:'appetite',expires:now+10*60*1000}};
 }
 if(state.kind==='appetite'){
  if(yes)return start();
  if(no)return {reply:foodConversationClosed};
 }
 return {};
}

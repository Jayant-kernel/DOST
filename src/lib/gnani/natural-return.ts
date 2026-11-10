import type {SavedExchange} from './conversation-context.ts';
import {feelingCue} from './care-cues.ts';
import {foodConversationClosed} from './meal-support.ts';
export type ReturnTurn={kind:'meal-check'|'food-enjoyment'|'appetite';expires:number};
export function mealEvent(text:string):'missed'|'unpleasant'|'eaten'|'satisfied'|undefined{
 const clean=text.normalize('NFKC').trim();
 if(/[?？"“”«»]/u.test(clean)||/अनुवाद|कहानी|मतलब|उदाहरण|मेरी माँ|मेरे पिता|मेरे बेटे|मेरी बेटी|उसने|उन्होंने|कहा|\b(?:translate|quote|example|mother|father|she|he|they)\b/iu.test(clean))return;
 if(/दर्द|चक्कर|उल्टी|निगल|खून|बेहोश|\b(?:pain|dizz|vomit|swallow|bleed|faint)/iu.test(clean))return;
 if(/(?:^|अब |अभी )(?:मुझे )?भूख नहीं (?:है|लगी है)|(?:^|अब |अभी )मेरा पेट भरा है|\bi am not hungry\b/iu.test(clean))return 'satisfied';
 if(/अब (?:मैंने )?(?:खाना )?खा लिया/u.test(clean))return 'eaten';
 // Reported past meals do not establish whether the user is hungry now.
 if(/कल |बीते|पिछले|पहले|\b(?:yesterday|last week|used to)\b/iu.test(clean))return;
 if(/(?:मैंने |आज |अभी |^)(?:खाना |नाश्ता |पेट भरकर )?(?:खा लिया|खा ली|खा चुका|खा चुकी)|मेरा पेट भर गया|\bi (?:have eaten|ate|had (?:lunch|dinner|breakfast))\b/iu.test(clean)&&!/(?:नहीं|नही|\bnot\b|haven't)/iu.test(clean))return 'eaten';
 if(/(?:मैंने |आज |अभी तक |^)(?:आज |अभी तक )?(?:खाना|कुछ|नाश्ता) (?:भी )?नहीं (?:खाया|किया)|(?:मुझे )?भूख लगी है|मेरा पेट नहीं भरा|\bi (?:have not|haven't|did not|didn't) (?:eaten|eat)|\bi am (?:still )?hungry\b/iu.test(clean))return 'missed';
 if(/(?:खाना|खाने का स्वाद) (?:बहुत |बिल्कुल )?(?:खराब|अच्छा नहीं|पसंद नहीं)|मुझे खाना पसंद नहीं आया|मैंने (?:आज )?(?:बहुत )?(?:खराब|बेस्वाद) खाना खाया|\b(?:the |my )?(?:food|meal) (?:was|is) (?:bad|awful|not good)\b|\bi (?:had|ate) (?:very |some )?(?:bad|awful) food\b/iu.test(clean))return 'unpleasant';
}
const topics:[RegExp,string][]=[[/बागवानी|बगीचे|बगीचा|गुलाब|\bgarden(?:ing)?\b/iu,'आज बगीचे में कुछ समय बिताया?'],[/क्रिकेट|\bcricket\b/iu,'आज क्रिकेट की कुछ बात करें?'],[/संगीत|गाना|गीत|\b(?:music|song)\b/iu,'आज कोई मनपसंद गाना सुनने का मन है?'],[/किताब|पढ़ना|\b(?:books?|reading)\b/iu,'आज कुछ पढ़ने का मन है?']];
export function naturalReturn(rows:SavedExchange[],now=Date.now()):{question?:string;turn?:ReturnTurn;avoidMeals?:boolean}{
 for(const row of rows.slice(-6).reverse()){
  const text=row.user.normalize('NFKC'),age=now-row.created;
  if(age<0||row.created!==0&&age>7*24*60*60*1000)continue;
  if(/^(?:नहीं|नही|जी नहीं|अभी नहीं|no)[।.! ]*$/iu.test(text.trim())&&row.assistant===foodConversationClosed)return {avoidMeals:true};
  if(/(?:नहीं करनी|नहीं करना|मत पूछ|नहीं चाहिए|बात बदल|छोड़िए|रहने दीजिए)|\b(?:change (?:the )?topic|stop asking|do not ask|don't ask|just listen)\b/iu.test(text))return {avoidMeals:true};
  if(/["“”«»]/u.test(text)||/अनुवाद|कहानी|मतलब|उदाहरण|उसने|उन्होंने|मेरी माँ|मेरे पिता|\b(?:translate|quote|example|mother|father|she|he|they)\b/iu.test(text))continue;
  const fresh=row.created>0&&age<=24*60*60*1000,event=mealEvent(text);
  if(fresh&&event==='satisfied')return {avoidMeals:true};
  if(fresh&&event){
   const kind=event==='missed'?'meal-check':'food-enjoyment';
   return {question:event==='missed'?(age<6*60*60*1000?'अब कुछ खा लिया?':'आज खाना हो गया?'):event==='eaten'?'खाने में क्या अच्छा लगा?':'आज कुछ मनपसंद खाने को मिला?',turn:{kind,expires:now+10*60*1000}};
  }
  if(fresh&&(/(?:मुझे सर्दी|मेरी तबीयत|मैं बीमार)/u.test(text)||feelingCue(text,false)?.tone==='supportive'))return {question:'अब कैसा लग रहा है?'};
  const topic=topics.find(([pattern])=>pattern.test(text));if(topic)return {question:topic[1]};
 }
 return {};
}

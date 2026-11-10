export type ConversationTime={timeZone:string;date:string;time:string;period:'morning'|'afternoon'|'evening'|'night'};
export type Recall={at:string;text:string};
export type SavedExchange={created:number;user:string;assistant:string};
export type ConversationContext={time:ConversationTime;recall:Recall[];boundaries?:readonly import('./conversation-boundaries.ts').ConversationBoundaryHint[];interaction?:import('./conversation-director.ts').DirectorState};

export function validTimeZone(value?:string|null){
 if(value&&value.length<=80){try{return new Intl.DateTimeFormat('en',{timeZone:value}).resolvedOptions().timeZone;}catch{/* Use the Indian demo default. */}}
 return 'Asia/Kolkata';
}
export function conversationTime(now=new Date(),zone?:string|null):ConversationTime{
 const timeZone=validTimeZone(zone);
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(type:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===type)!.value;
 const hour=Number(part('hour'));
 return {timeZone,date:`${part('year')}-${part('month')}-${part('day')}`,time:`${part('hour')}:${part('minute')}`,period:hour>=5&&hour<11?'morning':hour<16&&hour>=11?'afternoon':hour>=16&&hour<20?'evening':'night'};
}
export function openingQuestion(time:ConversationTime,previousReplies:string[]=[],avoidMeals=false){
 const choices=avoidMeals?['आज का दिन कैसा बीता?','आज आराम करने का मौका मिला?','आज दिन की कोई अच्छी बात बताएँगे?']:time.period==='morning'?['आज सुबह कैसी जा रही है?','सुबह का नाश्ता हो गया?','आज कुछ करने का मन है?']:time.period==='afternoon'?['दोपहर का खाना हो गया?','आज खाने में क्या अच्छा लगा?','आज आराम करने का मौका मिला?']:time.period==='evening'?['आज शाम कैसी जा रही है?','आज दिन की कोई अच्छी बात बताएँगे?','शाम को संगीत सुनना पसंद है?']:Number(time.time.slice(0,2))>=20?['रात का खाना हो गया?','आज का दिन कैसा बीता?','सोने से पहले कोई हल्की-फुल्की बात करें?']:['आज का दिन कैसा बीता?','अभी आराम कर रहे थे?'];
 return choices.find(question=>!previousReplies.some(reply=>reply.includes(question)))??choices[0];
}
// Tara's opener: a time-of-day greeting plus ONE routine check (breakfast, lunch,
// tea, dinner) or "what are you doing right now". With avoidMeals (the person asked
// not to talk about food) it stays a plain statement with no meal wording.
export function openingRemark(time:ConversationTime,avoidMeals=false){
 const hour=Number(time.time.slice(0,2));
 const invite='आप जो चाहें, बताइए।';
 if(avoidMeals){
  if(time.period==='morning')return `सुबह का समय है, दिन की शुरुआत आराम से करते हैं। ${invite}`;
  if(time.period==='afternoon')return `दोपहर का समय है, थोड़ी देर आराम से बातें करते हैं। ${invite}`;
  if(time.period==='evening')return `शाम का समय है, आराम से बातें करते हैं। ${invite}`;
  return hour>=20?`रात का समय है, आराम से थोड़ी बातें करते हैं। ${invite}`:`देर रात का समय है, धीरे-धीरे आराम से बातें करते हैं। ${invite}`;
 }
 if(time.period==='morning')return 'सुप्रभात! सुबह का नाश्ता हो गया?';
 if(time.period==='afternoon')return 'नमस्ते! दोपहर का खाना हो गया?';
 if(time.period==='evening')return 'शाम का नमस्कार! चाय-नाश्ता हो गया?';
 return hour>=20?'नमस्ते! रात का खाना हो गया?':'देर रात का समय है। आप अभी क्या कर रहे हैं?';
}

// Lexical retrieval of original words, not model-generated facts or a biography.
const terms=(text:string)=>new Set((text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu)??[]).filter(word=>word.length>1&&!/^(?:आज|कल|मैं|मेरे|मुझे|मेरा|मेरी|में|है|हैं|था|थी|के|की|का|और|से|बात|बारे|करें|आप|जी|हूँ|the|my|me|is|was|about|today|yesterday|and|hai|mujhe|mera|baat)$/u.test(word)));
export function selectRecall(rows:{created:number;user:string}[],text:string):Recall[]{
 const query=terms(text);if(!query.size)return [];
 const seen=new Set<string>();
 return rows.filter(row=>!/(?:याद रखें|याद रखो|सहेजें|मिटा दें|भूल जा|remember my|forget my)/iu.test(row.user)).map((row,index)=>({row,index,score:[...terms(row.user)].filter(word=>query.has(word)).length}))
  .filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).filter(({row})=>{if(seen.has(row.user))return false;seen.add(row.user);return true;})
  .slice(0,2).map(({row})=>({at:new Date(row.created).toISOString(),text:row.user.length>240?row.user.slice(0,240)+'…':row.user}));
}

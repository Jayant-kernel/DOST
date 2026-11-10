import type {Message} from './providers.ts';
import {questionPreference} from './conversation-commands.ts';
import type {CareTone} from './care-cues.ts';
export type AdaptationState={enabled:boolean;gentle:boolean;pace:'normal'|'slow';detail:'standard'|'brief';questions:'balanced'|'curious'|'fewer';expression:'warm'|'plain'|'lively';shortReplies:number;tone?:CareTone};
export function initialAdaptation(enabled=true,gentle=false):AdaptationState{return {enabled,gentle,pace:'normal',detail:'standard',questions:'balanced',expression:'warm',shortReplies:0};}
export function adaptConversation(text:string,previous=initialAdaptation()){
 const state={...previous};
 delete state.tone;
 const clean=text.trim().normalize('NFKC').replace(/[।.!?]+$/u,'').trim();
 const result=(reply?:string)=>({state,reply});
 if(/["“”«»]/u.test(clean)||/मतलब|अनुवाद|\b(?:translate|meaning|quote|example)\b/iu.test(clean))return result();
 if(/^(?:अनुकूलन बंद करें|adaptation off)$/iu.test(clean)){state.enabled=false;state.shortReplies=0;return result('ठीक है जी, बातचीत का अपने आप ढलना बंद है।');}
 if(/^(?:अनुकूलन चालू करें|adaptation on)$/iu.test(clean)){state.enabled=true;return result('ठीक है जी, आपकी बताई पसंद के अनुसार बातचीत ढालूँगा।');}
 if(/^(?:सरल बातचीत शुरू करें|gentle conversation on)$/iu.test(clean)){state.gentle=true;return result('ठीक है जी, छोटी और सरल बात करेंगे। आप आराम से बोलिए।');}
 if(/^(?:सरल बातचीत बंद करें|gentle conversation off)$/iu.test(clean)){state.gentle=false;return result('ठीक है जी, सामान्य बातचीत पर लौटते हैं।');}
 if(!state.enabled)return result();
 if(questionPreference(clean)==='fewer'){state.questions='fewer';return result('ज़रूर जी, कम सवाल पूछूँगा और आपकी बात सुनूँगा।');}
 if(questionPreference(clean)==='resume'){state.questions='balanced';state.shortReplies=0;}
 if(/^(?:मुझे समझ नहीं आया|यह समझ नहीं आया|समझ में नहीं आया|i did not understand|i didn't understand)$/iu.test(clean)){state.detail='brief';state.pace='slow';return result('ठीक है जी, छोटी और सरल बात करेंगे। किस हिस्से को फिर से समझाऊँ?');}
 if(/^(?:(?:थोड़ा |ज़रा )?धीरे बोलिए|speak (?:more )?slowly)$/iu.test(clean)){state.pace='slow';return result('ज़रूर जी, धीरे बोलूँगा।');}
 if(/^(?:सामान्य गति से बोलिए|speak at normal speed)$/iu.test(clean)){state.pace='normal';return result('ठीक है जी, सामान्य गति से बोलूँगा।');}
 if(/^(?:छोटा जवाब दीजिए|संक्षेप में बोलिए|keep (?:it|replies) short)$/iu.test(clean)){state.detail='brief';return result('ज़रूर जी, छोटे जवाब दूँगा।');}
 if(/^(?:विस्तार से बताइए|थोड़ा विस्तार से बताइए|more detail please)$/iu.test(clean)){state.detail='standard';return result('ठीक है जी, थोड़ा विस्तार से बात करेंगे।');}
 if(/^(?:कम सवाल पूछिए|ask fewer questions)$/iu.test(clean)){state.questions='fewer';return result('ज़रूर जी, कम सवाल पूछूँगा और आपकी बात सुनूँगा।');}
 if(/^(?:और सवाल पूछिए|ask more questions)$/iu.test(clean)){state.questions='curious';return result('ज़रूर जी, आपकी बात से जुड़ा एक सवाल एक बार में पूछूँगा।');}
 if(/^(?:बिना हँसी के बोलिए|बिना हंसी के बोलिए|सादी आवाज़ में बोलिए|plain voice please)$/iu.test(clean)){state.expression='plain';return result('ठीक है जी, आवाज़ सादी रखूँगा।');}
 if(/^(?:उत्साह से बोलिए|lively voice please)$/iu.test(clean)){state.expression='lively';return result('ज़रूर जी, हल्के उत्साह से बात करेंगे।');}
 if(/^(?:सामान्य बातचीत करें|reset conversation preferences)$/iu.test(clean))return {state:initialAdaptation(state.enabled,state.gentle),reply:'ठीक है जी, बातचीत की पसंद सामान्य कर दी है।'};
 // This observes reply length, not mood, personality, impairment or diagnosis.
 const words=clean.split(/\s+/u).length;
 state.shortReplies=/^(?:हाँ|हां|जी|नहीं|नही|ठीक|ठीक है|हम्म|yes|no|okay|ok)$/iu.test(clean)&&words<=2?Math.min(2,state.shortReplies+1):0;
 return result();
}
export function adaptationInstructions(state?:AdaptationState){
 if(!state)return '';
 const rules:string[]=[];
 if(state.gentle)rules.push('Use one simple idea at a time. Do not quiz memory, patronize, or confirm unverified beliefs. Repeated user questions deserve patience.');
 if(state.enabled){
  if(state.tone==='supportive'||state.tone==='calm')rules.push('Use a gentle, calm response. Do not label an emotion from voice or claim to know how the person feels.');
  if(state.tone==='positive')rules.push('Respond warmly to the stated good feeling without exaggerated excitement.');
  if(state.detail==='brief')rules.push('Use one short sentence unless safety requires more.');
  if(state.questions==='fewer'||state.questions!=='curious'&&state.shortReplies>=2)rules.push('Prefer a relevant comment; do not ask an optional follow-up this turn.');
  else if(state.questions==='curious')rules.push('When welcome, ask one connected follow-up after answering; never change topics to prolong the session.');
 }
 return rules.length?'\nConversation preferences: '+rules.join(' '):'';
}
export function speechDelivery(state?:AdaptationState){
 const calm=state?.enabled&&(state.tone==='supportive'||state.tone==='calm');
 return {speed:state?.gentle||state?.enabled&&state.pace==='slow'?0.9 as const:1 as const,plain:Boolean(state?.gentle||calm||state?.enabled&&state.expression==='plain'),lively:Boolean(state?.enabled&&!state.gentle&&!calm&&state.expression==='lively')};
}
const flat=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/[।.!?]+$/u,'').trim();
export function repeatedUserQuestion(messages:Message[]){
 const users=messages.filter(item=>item.role==='user');const latest=users.at(-1)?.content??'';
 return /\?|क्या|कब|कौन|कहाँ|कैसे|कितन|\b(?:what|where|when|how|who)\b/iu.test(latest)&&users.slice(0,-1).some(item=>flat(item.content)===flat(latest));
}
export function familiarMoment(text:string,gentle=false){
 if(!gentle)return;
 if(/^(?:यादों की बात करें|कोई पुरानी बात करें|familiar moment)$/iu.test(text.trim().replace(/[।.!?]+$/u,'')))return 'चाहें तो किसी पसंदीदा गाने या जगह की बात सुनाइए। मन न हो तो कोई और बात कर सकते हैं।';
}

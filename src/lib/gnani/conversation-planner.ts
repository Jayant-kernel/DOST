import type {Message} from './providers.ts';
import type {VoiceSession} from './sessions.ts';
import type {Preferences} from '../shop/store.ts';
import type {ConversationContext} from './conversation-context.ts';
import {adaptConversation,familiarMoment} from './adaptation.ts';
import {conversationEngagement} from './engagement.ts';
import {feelingCue} from './care-cues.ts';
import {listenOnlyRequested} from './reply-quality.ts';
import {conversationCue} from './expression.ts';
import {updateConversationBoundaries} from './conversation-boundaries.ts';
import {continueReturn} from './return-turn.ts';
import {mealContinuation} from './meal-continuation.ts';
import {mealSupport} from './meal-support.ts';
import {socialConversation} from './social-conversation.ts';
import {dailyConversation} from './daily-conversation.ts';
import {basicNeedsReply} from './basic-needs.ts';
import {directConversation} from './conversation-director.ts';
import type {BehaviourPolicy} from './companion.ts';

export type ConversationState=Pick<VoiceSession,'adaptation'|'engagement'|'boundaries'|'returnTurn'|'meal'|'social'|'director'|'weather'>;
export type ReplySource='control'|'weather'|'care'|'social'|'verified'|'reasoning'|'recovery';
// Same observation and response selection code is used by HTTP and the synthetic
// transcript harness. Identity, consent/storage and verified weather I/O remain
// application services, not imaginary model tools.
export function observeConversation(messages:Message[],state:ConversationState,policy:BehaviourPolicy,now=Date.now()){
 const text=messages.at(-1)?.content??'';
 const boundaries=updateConversationBoundaries(state.boundaries,text,messages.filter(message=>message.role==='assistant').at(-1)?.content,now);
 const adapted=adaptConversation(text,state.adaptation);
 if(policy==='persona_v2'&&adapted.reply)adapted.reply=adapted.reply.replaceAll('बोलूँगा','बोलूँगी').replaceAll('पूछूँगा','पूछूँगी').replaceAll('सुनूँगा','सुनूँगी').replaceAll('ढालूँगा','ढालूँगी');
 const engagement=conversationEngagement(text,state.engagement);
 const listenOnly=engagement.state.listenOnly??state.engagement?.listenOnly??listenOnlyRequested(messages);
 const quiet=Boolean(adapted.state.enabled&&(adapted.state.questions==='fewer'||adapted.state.questions!=='curious'&&adapted.state.shortReplies>=2));
 const feeling=adapted.state.enabled?feelingCue(text,!listenOnly&&!quiet,messages.filter(message=>message.role==='assistant').map(message=>message.content)):undefined;
 let cue=conversationCue(text,listenOnly||quiet);
 if(policy==='persona_v2'&&cue&&!cue.end&&(!/दवा|खुराक|AI|एआई|सुन रहा/iu.test(cue.reply)||/सुन रहा/u.test(cue.reply)&&!/दवा|खुराक|AI|एआई/iu.test(cue.reply)&&!listenOnly))cue=undefined;
 // Tara answers the identity question in her own words; "are you human?"
 // gets a direct, honest no before the introduction.
 if(policy==='persona_v2'&&cue?.reply.includes('मैं साथी हूँ'))cue={reply:/इंसान|human/iu.test(text)?'नहीं, मैं इंसान नहीं हूँ, मैं एक एआई हूँ। मेरा नाम तारा है, और मैं आपसे बातें करने और आपकी बात सुनने के लिए यहाँ हूँ।':'मैं तारा हूँ, आपकी एआई साथी। आपसे बातें करने और आपकी बात सुनने के लिए यहाँ हूँ।'};
 if(policy==='persona_v2'&&cue?.reply.includes('सुन रहा'))cue={...cue,reply:cue.reply.replaceAll('सुन रहा','सुन रही')};
 return {boundaries,adapted,engagement,listenOnly,quiet,feeling,cue};
}
export type ConversationObservation=ReturnType<typeof observeConversation>;
export function planConversationTurn(input:{messages:Message[];state:ConversationState;policy:BehaviourPolicy;preferences?:Preferences;context:ConversationContext;observation:ConversationObservation;weatherReply?:string}){
 const {messages,state,policy,observation:o}=input,text=messages.at(-1)?.content??'',v2=policy==='persona_v2';
 const continuation=!v2?continueReturn(text,state.returnTurn,!o.cue&&!o.adapted.reply&&!o.engagement.reply&&!o.listenOnly&&(!o.quiet||Boolean(state.returnTurn))):undefined;
 const mealTurn=!o.cue&&!o.adapted.reply&&!o.engagement.reply&&!o.listenOnly?mealContinuation(messages,state.meal,!o.quiet,!v2):{};
 // Tara is statement-led and speaks the shared scripted lines in the feminine.
 const groundedMeal=v2&&mealTurn.reply?{...mealTurn,reply:mealTurn.reply.replaceAll('सुन रहा','सुन रही').replaceAll('नहीं कर सकता','नहीं कर सकती')}:mealTurn;
 const meal=continuation?.reply?{state:continuation.meal}:groundedMeal.reply?groundedMeal:mealSupport(messages,state.meal,!v2&&!o.cue&&!o.adapted.reply&&!o.engagement.reply&&!o.listenOnly&&(!o.quiet||Boolean(state.meal)));
 const social=!v2&&!o.cue&&!o.adapted.reply&&!o.engagement.reply&&!continuation?.reply&&!meal.reply&&!o.feeling?.reply?socialConversation(messages,state.social,{allowInitiative:!o.listenOnly&&!o.quiet,plain:o.adapted.state.gentle||o.adapted.state.expression==='plain'}):undefined;
 const support=v2?(o.adapted.reply??input.weatherReply??groundedMeal.reply):(o.adapted.reply??o.engagement.reply??input.weatherReply??continuation?.reply??o.feeling?.reply??(o.listenOnly?undefined:meal.reply??social?.reply??familiarMoment(text,o.adapted.state.gentle)??(o.quiet?dailyConversation(messages,false):basicNeedsReply(messages)??dailyConversation(messages))));
 const directorInput=v2?{messages,preferences:input.preferences,context:input.context,adaptation:o.adapted.state,listenOnly:o.listenOnly,state:state.director}:undefined;
 // Shadow direction makes bypasses observable; it does not alter prepared text.
 const directed=directorInput?directConversation(directorInput):undefined;
 const prepared=o.cue?.reply??support;
 const directorApplied=prepared===undefined;
 const reply=prepared??directed?.verifiedReply;
 const publicCare=Boolean(o.feeling?.reply&&reply===o.feeling.reply||meal.reply&&reply===meal.reply||continuation?.reply&&reply===continuation.reply);
 const source:ReplySource=prepared===undefined?(directed?.verifiedReply?'verified':'reasoning'):input.weatherReply&&reply===input.weatherReply?'weather':social?.reply&&reply===social.reply?'social':publicCare?'care':'control';
 const next:ConversationState={...state,adaptation:o.adapted.state,engagement:o.engagement.state,boundaries:o.boundaries,meal:meal.state,returnTurn:continuation?continuation.state:state.returnTurn};
 // Prepared turns are real dialogue too. Keep director state synchronized with
 // the delivered source without pretending its shadow strategy generated it.
 if(directed&&reply!==undefined){const appliedAction:typeof directed.decision.action=source==='verified'?directed.decision.action:source==='control'?'ACT':/[?？]/u.test(reply)?'ASK':'ACKNOWLEDGE';next.director={...directed.state,recentActions:[...(state.director?.recentActions??[]),appliedAction].slice(-6)};}
 if(social)next.social=social.state;
 else if(o.cue||o.adapted.reply||o.engagement.reply)next.social={...state.social,phase:undefined,...(o.engagement.state.listenOnly||/छोड़|skip|बात नहीं करनी/iu.test(text)?{musicDeclined:true}:{})};
 return {reply,source,deterministic:reply!==undefined,publicCare,next,directed,directorInput,directorApplied,end:Boolean(o.cue?.end||directorApplied&&directed?.decision.end),observation:o};
}
export type ConversationPlan=ReturnType<typeof planConversationTurn>;

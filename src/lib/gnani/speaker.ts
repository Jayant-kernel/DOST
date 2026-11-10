import type {Message} from './providers.ts';
import type {SQLiteProfiles} from '../shop/sqlite.ts';
import {conversationTime,openingQuestion,openingRemark,type ConversationTime} from './conversation-context.ts';
import type {SavedExchange} from './conversation-context.ts';
import {naturalReturn,type ReturnTurn} from './natural-return.ts';
import type {BehaviourPolicy} from './companion.ts';
export type SpeakerState={ownerId?:string;profileId?:string;identify?:boolean;timeZone?:string;messages:Message[];returnTurn?:ReturnTurn;retentionPaused?:boolean;behaviourPolicy?:BehaviourPolicy};
export const introduction='नमस्ते, मैं साथी हूँ, आपका एआई साथी। आपका नाम क्या है?';
export function spokenName(text:string){
 let clean=text.normalize('NFKC').trim().replace(/[।.!?]+$/u,'').trim();
 // Drop greetings and fillers ("जी, नमस्ते, हाँ मेरा नाम …") and a polite tail ("… है जी").
 const filler=String.raw`(?:जी\s+हाँ|जी\s+हां|हाँ|हां|जी|नमस्ते|नमस्कार|हेलो|हैलो|अच्छा|ठीक\s+है|सुनिए|देखिए|तो|वो|वह|अरे)`;
 clean=clean.replace(new RegExp('^(?:'+filler+String.raw`[\s,]+`+')+','u'),'').replace(/\s*,\s*(?:आप|तुम|और)\s.*$/u,'').trim();
 const tail=String.raw`(?:\s+(?:जी|है|हैं|हूँ|हूं|हू|कहिए|कहें|बुलाइए|बुलाएँ|बुलाओ))*$`;
 const patterns=[
  /^(?:मेरा|हमारा|मेरे)\s+नाम\s+(?:है\s+)?(.+?)(?:\s+(?:है|हैं|जी|रखा गया है))*$/u,
  /^नाम\s+(?:है\s+)?(.+?)(?:\s+(?:है|जी))*$/u,
  /^(?:मुझे|हमें)\s+(.+?)\s+(?:कहिए|कहें|कहते\s+हैं|कहते\s+हैं\s+सब|बुलाइए|बुलाएँ|बुलाते\s+हैं|बुलाओ|बोलते\s+हैं|कहकर\s+बुलाइए)(?:\s+जी)?$/u,
  /^(?:सब|लोग|सभी|घर\s+में\s+सब)\s+(?:मुझे|हमें)\s+(.+?)\s+(?:कहते|बुलाते|बोलते)\s+हैं$/u,
  /^(?:मैं|मै|हम)\s+(.+?)\s+(?:बोल\s+रहा|बोल\s+रही|बोल\s+रहे|बात\s+कर\s+रहा|बात\s+कर\s+रही)\s+(?:हूँ|हूं|हू|हैं)(?:\s+जी)?$/u,
  /^(?:मैं|मै|हम)\s+(.+?)\s+(?:हूँ|हूं|हू|हैं)(?:\s+जी)?$/u,
  /^(?:my name is|my name's|i am|i'm|this is|mera naam|mera nam)\s+(.+?)(?:\s+(?:hai|ji))*$/iu,
 ];
 let name=clean;
 for(const pattern of patterns){const match=pattern.exec(clean);if(match){name=match[1];break;}}
 name=name.replace(new RegExp(tail,'u'),'').trim();
 return name.length<=60&&name.split(/\s+/u).length<=4&&/^[\p{L}\p{M} .'-]+$/u.test(name)&&!/^(हाँ|हां|जी हाँ|जी हां|yes|haan|नहीं|नही|no|nahi|nahin|नाम|मेरा नाम|है|जी|ठीक|अच्छा|अच्छी|बढ़िया|बीमार|थका|थकी|बोर|ठीक ठाक|मज़े में|मजे में)$/iu.test(name)&&!/^(?:मेरा|हमारा|नाम|मुझे|आप|तुम|क्या|कौन|कैसे|मैं)(?:\s|$)/u.test(name)?name:undefined;
}
// Tara keeps a contextual return question but otherwise opens with a remark.
export function welcomeBack(name:string,history:Message[],topic?:string,time:ConversationTime=conversationTime(),saved?:SavedExchange[],now=Date.now(),tara=false){
 const rows=saved??history.filter(m=>m.role==='user').map(m=>({created:0,user:m.content,assistant:''}));
 const follow=naturalReturn(rows,now),welcome=`नमस्ते ${name} जी, फिर मिलकर अच्छा लगा।`;
 const fallback=tara?naturalReturn(!follow.avoidMeals&&topic?[{created:0,user:topic,assistant:''}]:[],now).question??openingRemark(time,follow.avoidMeals):follow.avoidMeals?openingQuestion(time,history.filter(m=>m.role==='assistant').map(m=>m.content),true):naturalReturn(topic?[{created:0,user:topic,assistant:''}]:[],now).question??openingQuestion(time,history.filter(m=>m.role==='assistant').map(m=>m.content));
 return `${welcome} ${follow.question??fallback}`;
}
export async function handleSpeaker(session:SpeakerState,text:string,store:SQLiteProfiles,signal:AbortSignal):Promise<{reply:string;selected?:string;changed?:boolean}|undefined>{
 if(!session.identify)return;signal.throwIfAborted();
 if(!session.ownerId)throw Error('Device session required');
 const name=spokenName(text);if(!name)return {reply:'आपको किस नाम से बुलाऊँ? कृपया अपना नाम बताइए।'};
 const existing=await store.person(session.ownerId,name);signal.throwIfAborted();
 // User-authorized laptop demo: recognize by name without a setup dialogue.
 // Existing people who previously disabled history retain that setting.
 const person=existing??await store.createPerson(session.ownerId,name,true);
 // An opt-out given before choosing a name must apply before loading historical
 // dialogue or building a return greeting, not just before the next append.
 if(session.retentionPaused){const saved=await store.setHistoryRetention(session.ownerId,person.id,false);if(saved.enabled!==false)throw Error('History retention update failed');}
 const saved=await store.recentExchanges(session.ownerId,person.id);
 const history:Message[]=saved.slice(-3).flatMap(row=>[{role:'user' as const,content:row.user},...(row.assistant?[{role:'assistant' as const,content:row.assistant}]:[])]);
 const preferences=(await store.read(person.id)).preferences;signal.throwIfAborted();
 session.profileId=person.id;session.messages=history;session.identify=false;
 const time=conversationTime(new Date(),session.timeZone);
 session.returnTurn=existing?naturalReturn(saved).turn:undefined;
 const tara=session.behaviourPolicy==='persona_v2';
 return {reply:existing?welcomeBack(person.name,history,preferences.topic,time,saved,Date.now(),tara):`नमस्ते ${person.name} जी, आपसे मिलकर अच्छा लगा। ${tara?openingRemark(time):openingQuestion(time)}`,selected:person.id,changed:true};
}

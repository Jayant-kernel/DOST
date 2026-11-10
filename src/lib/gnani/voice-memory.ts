import {randomBytes,createHash} from 'node:crypto';
import {confirmPreferences} from './companion.ts';
import type {Preferences,Profile} from '../shop/store.ts';
import {StorageError} from '../shop/store.ts';
import {historyRetentionRequest} from './history-retention.ts';

export type MemoryProposal={kind:'save';changes:Preferences|{topic:null}}|{kind:'forget'}|{kind:'history-resume'};
type MemorySession={ownerId?:string;profileId?:string;pendingMemory?:MemoryProposal;messages:unknown[];retentionPaused?:boolean};
type Store={update:(id:string,change:(profile:Profile)=>Profile)=>Promise<Profile>;forget:(id:string)=>Promise<unknown>;setHistoryRetention?:(owner:string,id:string,enabled:boolean)=>Promise<{enabled:boolean}>};
const yes=/^(?:(?:हाँ|हां|जी हाँ|जी हां)(?:[,، ]*(?:सेव करें|सहेजें|याद रखें|मिटा दें))?|yes(?:[, ]*(?:save|resume))?|haan|ji haan)[।.!]?$/iu;
const no=/^(?:नहीं|नही|रद्द करें|मत सहेजें|मत मिटाएं|nahin|nahi|no|cancel)[।.!]?$/iu;
const trim=(s:string)=>s.trim().replace(/[।.!]+$/u,'').trim();
export function memoryProposal(text:string):Exclude<MemoryProposal,{kind:'history-resume'}>|undefined{
 const t=trim(text);
 if(/^(?:मेरी (?:सारी |सहेजी हुई )?जानकारी (?:भूल जाएं|भूल जाओ|मिटा दें)|forget (?:all )?my saved information)$/iu.test(t))return {kind:'forget'};
 if(/^(?:मेरा पसंदीदा विषय (?:भूल जाएं|मिटा दें)|forget my favourite topic)$/iu.test(t))return {kind:'save',changes:{topic:null}};
 // Deliberately narrow commands. An ordinary introduction never silently saves.
 const name=/^मेरा नाम (.+?) है[,، ]*(?:इसे )?(?:याद रखें|याद रखो|सहेजें)$/u.exec(t)?.[1];
 if(name&&name.length<=60)return {kind:'save',changes:{name}};
 const topic=/^मेरा पसंदीदा विषय (.+?) है[,، ]*(?:इसे )?(?:याद रखें|याद रखो|सहेजें)$/u.exec(t)?.[1];
 if(topic&&topic.length<=80)return {kind:'save',changes:{topic}};
 return undefined;
}
export async function handleVoiceMemory(session:MemorySession,text:string,store:Store,signal:AbortSignal):Promise<{reply:string;token?:string;deleted?:boolean;changed?:boolean;retentionChanged?:boolean}|undefined>{
 signal.throwIfAborted();
 const retention=historyRetentionRequest(text);
 if(retention==='status')return {reply:'इतिहास सहेजना बंद करने से पहले की सहेजी जानकारी अपने आप नहीं मिटती। उसे मिटाने के लिए अलग से आपकी अनुमति वाला चरण है।'};
 if(retention==='stop'){
  // Apply immediately, before synthesis: failed audio must not undo an opt-out.
  session.retentionPaused=true;session.pendingMemory=undefined;session.messages=[];
  if(session.ownerId&&session.profileId){
   if(!store.setHistoryRetention)throw new StorageError();
   const saved=await store.setHistoryRetention(session.ownerId,session.profileId,false);
   if(saved.enabled!==false)throw new StorageError();
  }
  return {reply:session.ownerId&&session.profileId?'इस नाम के लिए बातचीत का इतिहास सहेजना बंद कर दिया है। अभी की बातचीत के संदेश अस्थायी संदर्भ में रह सकते हैं। पहले की सहेजी जानकारी मिटाई नहीं गई है।':'इस सत्र में बातचीत का इतिहास सहेजना बंद है। अभी की बातचीत के संदेश अस्थायी संदर्भ में रह सकते हैं। पहले की सहेजी जानकारी मिटाई नहीं गई है।',changed:true,retentionChanged:true};
 }
 if(retention==='resume'){
  session.pendingMemory=undefined;
  if(!session.ownerId||!session.profileId)return {reply:'इतिहास सहेजने के लिए अभी कोई नाम नहीं चुना गया है। पहले अपना नाम चुनें, फिर आपकी अनुमति से इतिहास सहेजना चालू कर सकते हैं।'};
  session.pendingMemory={kind:'history-resume'};
  return {reply:'क्या बातचीत का इतिहास सहेजना फिर शुरू करूँ? पहले सहेजा इतिहास मिटाया नहीं गया है और चालू करने पर वह फिर संदर्भ में आ सकता है। अनुमति देने के लिए हाँ कहें, या नहीं कहें।'};
 }
 if(session.pendingMemory){
  if(no.test(text.trim())){session.pendingMemory=undefined;return {reply:'ठीक है, आपकी सहेजी हुई जानकारी नहीं बदली है।'};}
  if(yes.test(text.trim())){
   const proposal=session.pendingMemory;
   if(proposal.kind==='history-resume'){
    if(!session.ownerId||!session.profileId||!store.setHistoryRetention)throw new StorageError();
    const saved=await store.setHistoryRetention(session.ownerId,session.profileId,true);
    if(saved.enabled!==true)throw new StorageError();
    session.retentionPaused=false;session.messages=[];session.pendingMemory=undefined;
    return {reply:'आपकी अनुमति से इस नाम के लिए बातचीत का इतिहास सहेजना फिर चालू कर दिया है।',changed:true,retentionChanged:true};
   }
   if(proposal.kind==='forget'){
    if(!session.profileId){session.pendingMemory=undefined;return {reply:'अभी कोई सहेजा हुआ नाम नहीं चुना गया है, इसलिए कोई सहेजी जानकारी नहीं मिटाई गई है।'};}
    await store.forget(session.profileId);
    session.profileId=undefined;session.messages=[];session.pendingMemory=undefined;
    return {reply:'आपकी सहेजी हुई जानकारी और परीक्षण की खरीदारी सूची मिटा दी गई है।',deleted:true,changed:true};
   }
   const token=session.profileId?undefined:randomBytes(32).toString('hex');
   const id=session.profileId??createHash('sha256').update(token!).digest('hex');
   await store.update(id,p=>confirmPreferences(p,{confirmed:true,...proposal.changes}));
   session.profileId=id;session.messages=[];session.pendingMemory=undefined;
   return {reply:'आपकी अनुमति से जानकारी सहेज ली गई है।',token,changed:true};
  }
  // A new topic does not count as permission and cannot leave a stale approval.
  session.pendingMemory=undefined;
 }
 const proposal=memoryProposal(text);if(!proposal)return;
 session.pendingMemory=proposal;
 if(proposal.kind==='forget')return {reply:'क्या आप अपनी सारी सहेजी हुई जानकारी और परीक्षण की खरीदारी सूची मिटाना चाहते हैं? अनुमति देने के लिए हाँ कहें, या नहीं कहें।'};
 if('name' in proposal.changes)return {reply:`क्या मैं आपका नाम ${proposal.changes.name} सहेज लूँ? अनुमति देने के लिए हाँ कहें, या नहीं कहें।`};
 if(proposal.changes.topic===null)return {reply:'क्या मैं आपका सहेजा हुआ पसंदीदा विषय मिटा दूँ? अनुमति देने के लिए हाँ कहें, या नहीं कहें।'};
 return {reply:`क्या मैं आपका पसंदीदा विषय ${proposal.changes.topic} सहेज लूँ? अनुमति देने के लिए हाँ कहें, या नहीं कहें।`};
}

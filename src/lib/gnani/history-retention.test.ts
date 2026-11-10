import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {DatabaseSync} from 'node:sqlite';
import {historyRetentionRequest} from './history-retention.ts';
import {handleVoiceMemory} from './voice-memory.ts';
import {handleSpeaker} from './speaker.ts';
import {SQLiteProfiles} from '../shop/sqlite.ts';
import {StorageError} from '../shop/store.ts';
import type {VoiceSession} from './sessions.ts';
const owner='a'.repeat(64),other='b'.repeat(64),signal=new AbortController().signal;
const fresh=():VoiceSession=>({expires:Date.now()+10000,messages:[],busy:false,turns:0});

test('only explicit unquoted retention controls change state; represented, negated and mixed safety disclosures stay separate',()=>{
 for(const text of ['यह बात सिर्फ अभी की बातचीत के लिए है, इसे याद मत रखना।','यह सिर्फ अभी की बात है, इसे याद मत रखना','stop saving conversation history','Do not remember this','history save karna band karo','मेरी बातचीत मत सहेजें','मेरी बातचीत याद मत रखना','Please stop saving my conversations.','अब से मेरी बातचीत मत सहेजना'])assert.equal(historyRetentionRequest(text),'stop',text);
 for(const text of ['बातचीत का इतिहास सहेजना फिर शुरू करें','start saving conversation history again','resume retaining my conversations','history phir se save karo'])assert.equal(historyRetentionRequest(text),'resume',text);
 for(const text of ['“इसे याद मत रखना” का अनुवाद','क्या इतिहास सहेजना बंद करें?','इतिहास सहेजना बंद मत करो','I do not want you to stop saving conversation history','उन्होंने कहा मेरी बात याद मत रखना','सीने में दर्द है, इसे याद मत रखना','दवा की खुराक दोगुनी करूँ, इसे याद मत रखना'])assert.equal(historyRetentionRequest(text),undefined,text);
});

test('verified owner-scoped opt-out stops actual append and recall across store reopen without deleting prior rows',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-retention-'));
 try{
  const store=new SQLiteProfiles(dir),person=await store.createPerson(owner,'Synthetic Privacy',true);
  await store.appendHistory(owner,person.id,'बगीचे में गुलाब खिला','अच्छा लगा।');
  const session={...fresh(),ownerId:owner,profileId:person.id,messages:[{role:'assistant' as const,content:'old cached history'}]};
  const reply=await handleVoiceMemory(session,'यह बात सिर्फ अभी की बातचीत के लिए है, इसे याद मत रखना।',store,signal);
  assert.equal(reply?.retentionChanged,true);assert.match(reply!.reply,/बंद कर दिया/);assert.match(reply!.reply,/मिटाई नहीं/);assert.equal(session.retentionPaused,true);assert.deepEqual(session.messages,[]);
  const reopened=new SQLiteProfiles(dir);assert.equal((await reopened.person(owner,'Synthetic Privacy'))?.remember,false);
  await reopened.appendHistory(owner,person.id,'यह कभी नहीं सहेजना','reply');
  assert.deepEqual(await reopened.history(owner,person.id),[]);assert.deepEqual(await reopened.recall(owner,person.id,'गुलाब'),[]);
  const db=new DatabaseSync(store.filename);assert.equal(db.prepare('SELECT count(*) AS n FROM conversations WHERE person=?').get(person.id)!.n,1);db.close();
  await assert.rejects(reopened.setHistoryRetention(other,person.id,true),StorageError);assert.equal((await reopened.person(owner,'Synthetic Privacy'))?.remember,false);
  const returned={...fresh(),ownerId:owner,identify:true};await handleSpeaker(returned,'Synthetic Privacy',reopened,signal);assert.deepEqual(returned.messages,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('restarting durable retention requires a fresh explicit confirmation and cannot be enabled by topic change or another session',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-retention-resume-'));
 try{
  const store=new SQLiteProfiles(dir),person=await store.createPerson(owner,'Resume Test',false),session={...fresh(),ownerId:owner,profileId:person.id,retentionPaused:true};
  const act=(text:string)=>handleVoiceMemory(session,text,store,signal);
  const ask=await act('start saving conversation history again');assert.match(ask!.reply,/हाँ/);assert.equal((await store.person(owner,'Resume Test'))?.remember,false);
  await handleVoiceMemory({...fresh(),ownerId:owner,profileId:person.id},'हाँ',store,signal);assert.equal((await store.person(owner,'Resume Test'))?.remember,false);
  await act('आज क्रिकेट की बात करें');await act('हाँ');assert.equal((await store.person(owner,'Resume Test'))?.remember,false);
  await act('start saving conversation history again');await act('नहीं');assert.equal((await store.person(owner,'Resume Test'))?.remember,false);
  await act('start saving conversation history again');const done=await act('yes');assert.equal(done?.retentionChanged,true);assert.equal(session.retentionPaused,false);assert.equal((await new SQLiteProfiles(dir).person(owner,'Resume Test'))?.remember,true);
  await store.appendHistory(owner,person.id,'अनुमति के बाद की बातचीत','जी।');assert.equal((await store.recentExchanges(owner,person.id)).length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('anonymous opt-out is honest session suppression and applies before a later named welcome can load old history',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-retention-anonymous-'));
 try{
  const store=new SQLiteProfiles(dir),person=await store.createPerson(owner,'Later Named',true);await store.appendHistory(owner,person.id,'I enjoy cricket','reply');
  const session={...fresh(),ownerId:owner,identify:true};
  const stopped=await handleVoiceMemory(session,'stop saving conversation history',store,signal);assert.match(stopped!.reply,/इस सत्र/);assert.equal(session.retentionPaused,true);
  const denied=await handleVoiceMemory(session,'resume saving conversations',store,signal);assert.match(denied!.reply,/पहले अपना नाम/);assert.equal(session.pendingMemory,undefined);
  const selected=await handleSpeaker(session,'Later Named',store,signal);assert.equal(selected?.selected,person.id);assert.deepEqual(session.messages,[]);assert.doesNotMatch(selected!.reply,/क्रिकेट/);assert.equal((await store.person(owner,'Later Named'))?.remember,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('storage failures and aborted requests never produce a success promise; a failed persistent opt-out remains locally suppressed',async()=>{
 let writes=0;const store={update:async()=>{throw new StorageError();},forget:async()=>{},setHistoryRetention:async()=>{writes++;throw new StorageError();}};
 const session={...fresh(),ownerId:owner,profileId:'c'.repeat(64)};
 await assert.rejects(handleVoiceMemory(session,'stop saving conversation history',store,signal),StorageError);assert.equal(session.retentionPaused,true);assert.equal(writes,1);
 const controller=new AbortController();controller.abort();await assert.rejects(handleVoiceMemory(fresh(),'stop saving conversation history',store,controller.signal));assert.equal(writes,1);
 const wrong={...store,setHistoryRetention:async()=>({enabled:true})};await assert.rejects(handleVoiceMemory(session,'stop saving conversation history',wrong,signal),StorageError);
});

test('an anonymous deletion confirmation never claims saved data was deleted without a selected profile',async()=>{
 let deletes=0;const store={update:async()=>{throw Error();},forget:async()=>{deletes++;}};
 const session=fresh();await handleVoiceMemory(session,'forget all my saved information',store,signal);
 const reply=await handleVoiceMemory(session,'yes',store,signal);assert.equal(deletes,0);assert.equal(reply?.deleted,undefined);assert.match(reply!.reply,/नहीं मिटाई/);assert.equal(session.pendingMemory,undefined);
});

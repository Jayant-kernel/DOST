import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {SQLiteProfiles} from '../shop/sqlite.ts';import {handleSpeaker,spokenName,welcomeBack,type SpeakerState} from './speaker.ts';
import {conversationTime,openingQuestion,openingRemark} from './conversation-context.ts';
const owner='a'.repeat(64),other='b'.repeat(64),signal=new AbortController().signal;
test('natural Hindi and English introductions extract only the name',()=>{
 assert.equal(spokenName('मैं जयंत हूँ।'),'जयंत');assert.equal(spokenName('I am Jayant'),'Jayant');assert.equal(spokenName("I'm Jayant"),'Jayant');
});
test('returning greetings follow the topic naturally without quoting or announcing resumption',()=>{
 const text=welcomeBack('Mohan',[{role:'user',content:'I like gardening.'}]);
 assert.match(text,/बगीचे|बागवानी/);assert.match(text,/फिर मिलकर|वापस/);assert.doesNotMatch(text,/I like gardening|पिछली बार|आगे बढ़ाएँ|जारी रखें/);
});
test('completed or empty exchanges get a fresh opener rather than fake unfinished recall',()=>{
 const time=conversationTime(new Date('2026-10-24T18:00:00+05:30'));
 for(const history of [[{role:'user' as const,content:'हाँ।'},{role:'assistant' as const,content:'जी।'}],[{role:'user' as const,content:'आज बगीचे में फूल खिले।'},{role:'assistant' as const,content:'ठीक है जी, फिर बात करेंगे।'}]]){
  const reply=welcomeBack('Jayant',history,undefined,time);assert.match(reply,/फिर मिलकर|वापस/);assert.doesNotMatch(reply,/पिछली|आगे बढ़ाएँ/);
 }
});
test('empty-history return uses local time and never invents a previous conversation',()=>{
 const time=conversationTime(new Date('2026-10-24T13:00:00+05:30'),'Asia/Kolkata');
 const text=welcomeBack('Mohan',[],undefined,time);
 assert.match(text,/दोपहर का खाना हो गया\?/);assert.doesNotMatch(text,/पिछली|आपने कहा/);
});

test('return after satiety or refusal initiates a concrete check-in without asking the person to choose a topic',()=>{
 const now=Date.parse('2026-10-31T13:00:00+05:30'),time=conversationTime(new Date(now));
 for(const user of ['अब भूख नहीं है','खाने की बात नहीं करनी']){
  const reply=welcomeBack('Mohan',[],undefined,time,[{created:now-1000,user,assistant:'जी।'}],now);
  assert.match(reply,/आज का दिन कैसा बीता\?/);assert.doesNotMatch(reply,/किस बारे|कहाँ से|कहां से|खाना हो गया/);
 }
 const overnight=welcomeBack('Mohan',[],undefined,conversationTime(new Date('2026-10-31T02:00:00+05:30')));
 assert.match(overnight,/आज का दिन कैसा बीता\?/);assert.doesNotMatch(overnight,/किस बारे|कहाँ से/);
});

test('returning profile retains user context from a failed turn without restoring the recovery as assistant dialogue',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-recovery-return-'));
 try{
  const store=new SQLiteProfiles(dir),person=await store.createPerson(owner,'RecoveryReturn',true);
  await store.appendHistory(owner,person.id,'मुझे संगीत पसंद है','अभी जवाब बनाने में दिक्कत हो रही है।','recovery');
  const session:SpeakerState={ownerId:owner,identify:true,messages:[]};
  const reply=await handleSpeaker(session,'RecoveryReturn',new SQLiteProfiles(dir),signal);
  assert.equal(reply?.selected,person.id);assert.match(reply!.reply,/मनपसंद गाना/);
  assert.deepEqual(session.messages,[{role:'user',content:'मुझे संगीत पसंद है'}]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('one spoken name creates a person; returning name restores real saved history without confirmation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-people-'));
 try{
  const store=new SQLiteProfiles(dir),session:SpeakerState={ownerId:owner,identify:true,messages:[]};
  const first=await handleSpeaker(session,'My name is Jayant',store,signal);const jayant=session.profileId!;
  assert.ok(jayant);assert.equal(first?.selected,jayant);assert.equal(session.identify,false);assert.equal(first?.reply.includes('Jayant'),true);assert.match(first!.reply,/\?/);
  await store.appendHistory(owner,jayant,'I enjoyed cricket yesterday','Let us talk about cricket.');
  const reopened=new SQLiteProfiles(dir),returning:SpeakerState={ownerId:owner,identify:true,messages:[]};
  const greeting=await handleSpeaker(returning,'Jayant',reopened,signal);
  assert.equal(returning.profileId,jayant);assert.equal(returning.messages.length,2);assert.match(greeting!.reply,/क्रिकेट/);assert.doesNotMatch(greeting!.reply,/I enjoyed cricket yesterday|पिछली बार|आगे बढ़ाएँ/);
  assert.deepEqual(await store.history(other,jayant),[]);assert.equal(await store.person(other,'Jayant'),undefined);
  const second:SpeakerState={ownerId:owner,identify:true,messages:[]};await handleSpeaker(second,'Seema',store,signal);
  assert.notEqual(second.profileId,jayant);assert.deepEqual(second.messages,[]);
  const again:SpeakerState={ownerId:owner,identify:true,messages:[]};await handleSpeaker(again,'Jayant',store,signal);assert.equal(again.profileId,jayant);
  await store.forget(jayant);assert.equal(await store.person(owner,'Jayant'),undefined);assert.deepEqual(await store.history(owner,jayant),[]);
  const afterDelete:SpeakerState={ownerId:owner,identify:true,messages:[]};await handleSpeaker(afterDelete,'Jayant',store,signal);assert.notEqual(afterDelete.profileId,jayant);assert.deepEqual(afterDelete.messages,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('history limits, old opt-out, correction and cancelled/invalid input remain intact',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-people-'));
 try{
  const store=new SQLiteProfiles(dir),person=await store.createPerson(owner,'Test',true);
  for(let i=0;i<102;i++)await store.appendHistory(owner,person.id,'turn '+i,'reply');
  const db=new DatabaseSync(store.filename);assert.equal(db.prepare('SELECT count(*) AS n FROM conversations').get()!.n,100);db.prepare('UPDATE conversations SET created=0').run();db.close();assert.deepEqual(await store.history(owner,person.id),[]);
  const optedOut=await store.createPerson(owner,'Private',false),state:SpeakerState={ownerId:owner,identify:true,messages:[]};
  await handleSpeaker(state,'Private',store,signal);await store.appendHistory(owner,optedOut.id,'private','reply');assert.deepEqual(await store.history(owner,optedOut.id),[]);
  await store.update(person.id,p=>({...p,preferences:{...p.preferences,name:'Corrected'}}));assert.equal(await store.person(owner,'Test'),undefined);assert.equal((await store.person(owner,'Corrected'))!.id,person.id);
  const invalid:SpeakerState={ownerId:owner,identify:true,messages:[]};await handleSpeaker(invalid,'yes',store,signal);assert.equal(invalid.profileId,undefined);
  const cancel=new AbortController();cancel.abort();await assert.rejects(handleSpeaker(invalid,'Test',store,cancel.signal));
  assert.equal(spokenName('\u092e\u0947\u0930\u093e \u0928\u093e\u092e \u091c\u092f\u0902\u0924 \u0939\u0948\u0964'),'\u091c\u092f\u0902\u0924');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('dated return context is bounded, owner-scoped, retained only with history consent and removed by forgetting',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-return-'));
 try{
  const store=new SQLiteProfiles(dir),person=await store.createPerson(owner,'ReturnTest',true);
  for(let i=0;i<8;i++)await store.appendHistory(owner,person.id,'मेरी किताब '+i,'जी।');
  const rows=await store.recentExchanges(owner,person.id,100);assert.equal(rows.length,6);assert.ok(rows.every(r=>r.created>0));assert.match(rows.at(-1)!.user,/7$/);
  assert.equal((await store.history(owner,person.id)).length,6);assert.deepEqual(await store.recentExchanges(other,person.id),[]);
  const privatePerson=await store.createPerson(owner,'PrivateReturn',false);await store.appendHistory(owner,privatePerson.id,'मैंने खाना नहीं खाया','जी।');assert.deepEqual(await store.recentExchanges(owner,privatePerson.id),[]);
  const db=new DatabaseSync(store.filename);db.prepare('UPDATE conversations SET created=0 WHERE person=?').run(person.id);db.close();assert.deepEqual(await store.recentExchanges(owner,person.id),[]);
  await store.appendHistory(owner,person.id,'मैंने खाना नहीं खाया','जी।');
  const state:SpeakerState={ownerId:owner,identify:true,messages:[]},greeting=await handleSpeaker(state,'ReturnTest',store,signal);
  assert.match(greeting!.reply,/अब कुछ खा लिया\?/);assert.doesNotMatch(greeting!.reply,/पिछली बार|आगे बढ़ाएँ/);assert.equal(state.returnTurn?.kind,'meal-check');
  await store.forget(person.id);assert.deepEqual(await store.recentExchanges(owner,person.id),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Tara greets a new person with a time-of-day greeting and one meal/doing question; legacy greeting is unchanged',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-tara-greeting-'));
 try{
  const store=new SQLiteProfiles(dir);
  const tara:SpeakerState={ownerId:owner,identify:true,messages:[],behaviourPolicy:'persona_v2'};
  const greeting=(await handleSpeaker(tara,'Ramesh',store,signal))!.reply;
  assert.equal((greeting.match(/[?？]/g)??[]).length,1);assert.match(greeting,/^नमस्ते Ramesh जी, आपसे मिलकर अच्छा लगा। /);
  assert.equal(greeting,`नमस्ते Ramesh जी, आपसे मिलकर अच्छा लगा। ${openingRemark(conversationTime(new Date()))}`);
  for(const behaviourPolicy of [undefined,'legacy'] as const){
   const legacy:SpeakerState={ownerId:owner,identify:true,messages:[],behaviourPolicy};
   const name=behaviourPolicy?'Seema':'Kamla';
   assert.equal((await handleSpeaker(legacy,name,store,signal))!.reply,`नमस्ते ${name} जी, आपसे मिलकर अच्छा लगा। ${openingQuestion(conversationTime(new Date()))}`);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Tara welcome-back keeps a contextual return question, otherwise opens with a meal check (statement-only when food is to be avoided)',()=>{
 const time=conversationTime(new Date('2026-10-24T13:00:00+05:30'),'Asia/Kolkata');
 const plain=welcomeBack('Mohan',[],undefined,time,undefined,undefined,true);
 assert.equal(plain,`नमस्ते Mohan जी, फिर मिलकर अच्छा लगा। ${openingRemark(time)}`);assert.match(plain,/दोपहर का खाना हो गया\?/u);
 const avoid=welcomeBack('Mohan',[],undefined,time,[{created:Date.parse('2026-10-24T12:00:00+05:30'),user:'खाने की बात नहीं करनी',assistant:'जी।'}],Date.parse('2026-10-24T13:00:00+05:30'),true);
 assert.doesNotMatch(avoid,/[?？]|खाना/);
 assert.match(welcomeBack('Mohan',[{role:'user',content:'I like gardening.'}],undefined,time,undefined,undefined,true),/बगीचे/);
 assert.equal(welcomeBack('Mohan',[],undefined,time),'नमस्ते Mohan जी, फिर मिलकर अच्छा लगा। दोपहर का खाना हो गया?');
});
test('Tara returning person through handleSpeaker gets a single-question time-of-day greeting when there is no contextual follow-up',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-tara-return-'));
 try{
  const store=new SQLiteProfiles(dir),person=await store.createPerson(owner,'Lata',true);
  await store.appendHistory(owner,person.id,'हाँ।','जी।');
  const state:SpeakerState={ownerId:owner,identify:true,messages:[],behaviourPolicy:'persona_v2'};
  const greeting=(await handleSpeaker(state,'Lata',store,signal))!.reply;
  assert.match(greeting,/फिर मिलकर अच्छा लगा/);assert.equal((greeting.match(/[?？]/g)??[]).length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

import {test as nameTest} from 'node:test';
nameTest('spokenName accepts natural introductions and rejects non-names',()=>{
 for(const [heard,name] of [['जी मेरा नाम जयंत है','जयंत'],['हाँ मेरा नाम जयंत है','जयंत'],['मेरा नाम है जयंत','जयंत'],['मेरा नाम जयंत शर्मा है जी','जयंत शर्मा'],['मुझे जयंत कहते हैं','जयंत'],['लोग मुझे जयंत बुलाते हैं','जयंत'],['नमस्ते, मैं जयंत बोल रहा हूँ','जयंत'],['मेरा नाम जयंत है, आप कैसी हैं','जयंत'],['जयंत जी','जयंत']])assert.equal(spokenName(heard),name,heard);
 for(const heard of ['हाँ','जी','मैं ठीक हूँ','आप कौन हैं','मुझे दवा चाहिए'])assert.equal(spokenName(heard),undefined,heard);
});

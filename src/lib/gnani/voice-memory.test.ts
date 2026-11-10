import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleVoiceMemory,memoryProposal} from './voice-memory.ts';
import {SQLiteProfiles} from '../shop/sqlite.ts';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import type {VoiceSession} from './sessions.ts';
const fresh=():VoiceSession=>({messages:[],expires:Date.now()+10000,busy:false,turns:0});
test('ordinary conversation, quoted commands and unrecognized requests cannot mutate memory',()=>{
 for(const text of ['मेरा नाम मोहन है।','उन्होंने कहा मेरा नाम मोहन है इसे याद रखें','मेरे कार्ट में चावल डालें','हाँ'])assert.equal(memoryProposal(text),undefined);
});
test('voice consent persists, corrects, removes topic and deletes with real SQLite; consent is scoped to the session',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-memory-'));
 try{
  const store=new SQLiteProfiles(dir),session=fresh(),signal=new AbortController().signal;
  const act=(text:string)=>handleVoiceMemory(session,text,store,signal);
  await act('मेरा नाम मोहन है इसे याद रखें।');assert.equal(session.profileId,undefined);
  assert.equal(await handleVoiceMemory(fresh(),'हाँ',store,signal),undefined);
  await act('नहीं');assert.equal(session.profileId,undefined);
  await act('मेरा नाम मोहन है इसे याद रखें।');const saved=await act('हाँ');assert.ok(saved?.token);assert.equal((await store.read(session.profileId!)).preferences.name,'मोहन');
  await act('मेरा नाम सीमा है इसे याद रखें');await act('हाँ, सेव करें');assert.equal((await store.read(session.profileId!)).preferences.name,'सीमा');
  await act('मेरा पसंदीदा विषय संगीत है याद रखें');await act('हाँ');assert.equal((await store.read(session.profileId!)).preferences.topic,'संगीत');
  await act('मेरा पसंदीदा विषय मिटा दें');await act('हाँ');assert.equal((await store.read(session.profileId!)).preferences.topic,undefined);
  const id=session.profileId!;await act('मेरी सारी जानकारी मिटा दें');assert.equal((await store.read(id)).preferences.name,'सीमा');await act('हाँ');assert.deepEqual((await store.read(id)).preferences,{});assert.equal(session.profileId,undefined);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('topic change invalidates pending approval; cancelled operations never call storage',async()=>{
 const session=fresh(),signal=new AbortController().signal;let writes=0;
 const store={update:async()=>{writes++;throw Error();},forget:async()=>{writes++;}};
 await handleVoiceMemory(session,'मेरा नाम मोहन है याद रखें',store,signal);
 await handleVoiceMemory(session,'आज मौसम कैसा है?',store,signal);
 await handleVoiceMemory(session,'हाँ',store,signal);assert.equal(writes,0);
 const aborted=new AbortController();aborted.abort();await assert.rejects(handleVoiceMemory(session,'मेरा नाम मोहन है याद रखें',store,aborted.signal));assert.equal(writes,0);
});

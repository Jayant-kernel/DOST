import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,statSync,unlinkSync,chmodSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {storedProfile,StorageError,type Profile} from './store.ts';
import {emptyCart} from './cart.ts';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import type {Message} from '../gnani/providers.ts';
import {selectRecall,type Recall,type SavedExchange} from '../gnani/conversation-context.ts';
const exchange=z.object({user:z.string().min(1).max(2000),assistant:z.string().min(1).max(4000)}).strict();
const speakerName=z.string().trim().min(1).max(60).regex(/^[\p{L}\p{M} .'-]+$/u);
const retention=30*24*60*60*1000;

// Local prototype: a short transaction per operation, no long-lived connections.
// Migration 1 creates the schema. Legacy data is imported separately, on access.
export class SQLiteProfiles {
 readonly directory:string;
 readonly filename:string;
 constructor(directory=join(process.cwd(),'.saathi-local')){
  this.directory=resolve(directory);this.filename=join(this.directory,'saathi.sqlite');
 }
 private legacy(id:string){if(!/^[a-f0-9]{64}$/.test(id))throw new StorageError();return join(this.directory,`${id}.json`);}
 private open(){
  let db:DatabaseSync|undefined;
  try{
   mkdirSync(this.directory,{recursive:true});db=new DatabaseSync(this.filename);
   chmodSync(this.filename,0o600);db.exec('PRAGMA busy_timeout=1000; PRAGMA secure_delete=ON; BEGIN IMMEDIATE');
   let version=db.prepare('PRAGMA user_version').get()!.user_version;
   if(version===0){db.exec('CREATE TABLE profiles (id TEXT PRIMARY KEY CHECK(length(id)=64), data TEXT NOT NULL) STRICT; PRAGMA user_version=1');version=1;}
   if(version===1){
    db.exec('CREATE TABLE people (owner TEXT NOT NULL, id TEXT PRIMARY KEY, name TEXT NOT NULL, lookup TEXT NOT NULL, remember INTEGER NOT NULL CHECK(remember IN (0,1)), UNIQUE(owner,lookup)) STRICT; CREATE INDEX people_owner ON people(owner); CREATE TABLE conversations (seq INTEGER PRIMARY KEY, person TEXT NOT NULL, created INTEGER NOT NULL, user TEXT NOT NULL, assistant TEXT NOT NULL) STRICT; CREATE INDEX conversations_person_created ON conversations(person,created); PRAGMA user_version=2');version=2;
   }
   if(version===2){
    db.exec("ALTER TABLE conversations ADD COLUMN outcome TEXT NOT NULL DEFAULT 'reply' CHECK(outcome IN ('reply','recovery'))");
    // Exact prior app-generated failures, never a guess based on personal text.
    const oldRecoveries=['माफ़ कीजिए, अभी जवाब देने में दिक्कत हो रही है। थोड़ी देर बाद फिर बात करते हैं।','माफ़ कीजिए, अभी मैं ठीक से जवाब नहीं दे पाया। आप अपनी बात जारी रखिए।','माफ़ कीजिए, जवाब देने में देर हो रही है। अपनी बात एक बार फिर बताएँगे?','माफ़ कीजिए, मैं आपकी बात ठीक से समझ नहीं पाया। थोड़ा अलग तरह से बताएँगे?'];
    for(const reply of oldRecoveries)db.prepare("UPDATE conversations SET outcome='recovery' WHERE assistant=?").run(reply);
    db.exec('PRAGMA user_version=3');version=3;
   }
   if(version!==3)throw new StorageError();
   db.exec('COMMIT');return db;
  }catch{db?.close();throw new StorageError();}
 }
 private load(db:DatabaseSync,id:string):Profile{
  const legacy=this.legacy(id);
  try{
   const row=db.prepare('SELECT data FROM profiles WHERE id=?').get(id);
   if(row)return storedProfile.parse(JSON.parse(String(row.data)));
   let text:string;
   try{if(statSync(legacy).size>512000)throw new StorageError();text=readFileSync(legacy,'utf8');}
   catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {version:1,preferences:{},cart:emptyCart()};throw error;}
   const profile=storedProfile.parse(JSON.parse(text));
   db.prepare('INSERT INTO profiles(id,data) VALUES (?,?)').run(id,JSON.stringify(profile));
   // Preserve the original file until explicit deletion. SQLite is authoritative.
   return profile;
  }catch{throw new StorageError();}
 }
 private transaction<T>(id:string,operation:(db:DatabaseSync)=>T):T{
  this.legacy(id);const db=this.open();
  try{
   try{db.exec('BEGIN IMMEDIATE');}catch{throw new StorageError();}
   const result=operation(db);
   try{db.exec('COMMIT');}catch{throw new StorageError();}return result;
  }
  catch(error){try{db.exec('ROLLBACK');}catch{/* Preserve the original failure. */}throw error;}
  finally{db.close();}
 }
 async read(id:string):Promise<Profile>{
  try{return this.transaction(id,db=>this.load(db,id));}catch{throw new StorageError();}
 }
 async update(id:string,change:(profile:Profile)=>Profile):Promise<Profile>{
  return this.transaction(id,db=>{
   // Domain/schema validation errors stay distinct from storage failures.
   const profile=storedProfile.parse(change(this.load(db,id)));
   const person=db.prepare('SELECT owner,name FROM people WHERE id=?').get(id);
   if(person&&profile.preferences.name&&profile.preferences.name!==person.name){
    const name=speakerName.parse(profile.preferences.name),lookup=name.normalize('NFKC').toLocaleLowerCase('en-IN');
    if(db.prepare('SELECT id FROM people WHERE owner=? AND lookup=? AND id<>?').get(person.owner,lookup,id))throw Error('A different profile already uses that name');
    try{db.prepare('UPDATE people SET name=?,lookup=? WHERE id=?').run(name,lookup,id);}catch{throw new StorageError();}
   }
   try{db.prepare('INSERT INTO profiles(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(profile));}
   catch{throw new StorageError();}return profile;
  });
 }
 async forget(id:string){
  try{this.transaction(id,db=>{
   // Remove the legacy copy too, so deleted preferences cannot be re-imported.
   try{unlinkSync(this.legacy(id));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   db.prepare('DELETE FROM profiles WHERE id=?').run(id);
   db.prepare('DELETE FROM conversations WHERE person=?').run(id);
   db.prepare('DELETE FROM people WHERE id=?').run(id);
   const owned=db.prepare('SELECT id FROM people WHERE owner=?').all(id);
   for(const child of owned){db.prepare('DELETE FROM conversations WHERE person=?').run(child.id);db.prepare('DELETE FROM profiles WHERE id=?').run(child.id);}
   db.prepare('DELETE FROM people WHERE owner=?').run(id);
  });}catch{throw new StorageError();}
 }
 async person(owner:string,name:string){
  const clean=speakerName.parse(name);return this.transaction(owner,db=>{
   const row=db.prepare('SELECT id,name,remember FROM people WHERE owner=? AND lookup=?').get(owner,clean.normalize('NFKC').toLocaleLowerCase('en-IN'));
   if(!row)return undefined;return {id:String(row.id),name:String(row.name),remember:row.remember===1};
  });
 }
 async createPerson(owner:string,name:string,remember:boolean){
  const clean=speakerName.parse(name),id=randomBytes(32).toString('hex');
  try{return this.transaction(owner,db=>{
   if(Number(db.prepare('SELECT count(*) AS n FROM people WHERE owner=?').get(owner)!.n)>=20)throw new StorageError();
   db.prepare('INSERT INTO people(owner,id,name,lookup,remember) VALUES (?,?,?,?,?)').run(owner,id,clean,clean.normalize('NFKC').toLocaleLowerCase('en-IN'),remember?1:0);
   db.prepare('INSERT INTO profiles(id,data) VALUES (?,?)').run(id,JSON.stringify({version:1,preferences:{name:clean,language:'hi'},cart:emptyCart()}));return {id,name:clean,remember};
  });}catch{throw new StorageError();}
 }
 async history(owner:string,id:string):Promise<Message[]>{
  const rows=await this.recentExchanges(owner,id,3);
  return rows.flatMap(row=>[{role:'user' as const,content:row.user},...(row.assistant?[{role:'assistant' as const,content:row.assistant}]:[])]);
 }
 async setHistoryRetention(owner:string,id:string,enabled:boolean):Promise<{enabled:boolean}>{
  this.legacy(id);
  if(typeof enabled!=='boolean')throw new StorageError();
  try{return this.transaction(owner,db=>{
   if(!db.prepare('SELECT id FROM people WHERE owner=? AND id=?').get(owner,id))throw new StorageError();
   db.prepare('UPDATE people SET remember=? WHERE owner=? AND id=?').run(enabled?1:0,owner,id);
   const row=db.prepare('SELECT remember FROM people WHERE owner=? AND id=?').get(owner,id);
   if(!row||row.remember!==(enabled?1:0))throw new StorageError();
   return {enabled:row.remember===1};
  });}catch{throw new StorageError();}
 }
 async recentExchanges(owner:string,id:string,limit=6):Promise<SavedExchange[]>{
  try{return this.transaction(owner,db=>{
   if(!db.prepare('SELECT id FROM people WHERE owner=? AND id=? AND remember=1').get(owner,id))return [];
   db.prepare('DELETE FROM conversations WHERE created<?').run(Date.now()-retention);
   const count=Number.isSafeInteger(limit)?Math.max(1,Math.min(6,limit)):6;
   const rows=db.prepare('SELECT created,user,assistant,outcome FROM conversations WHERE person=? ORDER BY seq DESC LIMIT ?').all(id,count).reverse();
   return rows.map(row=>({created:Number(row.created),...exchange.parse({user:row.user,assistant:row.assistant}),...(row.outcome==='recovery'?{assistant:''}:{})}));
  });}catch{throw new StorageError();}
 }
 async appendHistory(owner:string,id:string,user:string,assistant:string,outcome:'reply'|'recovery'='reply'){
  const data=exchange.parse({user,assistant});
  try{this.transaction(owner,db=>{
   if(!db.prepare('SELECT id FROM people WHERE owner=? AND id=? AND remember=1').get(owner,id))return;
   db.prepare('DELETE FROM conversations WHERE created<?').run(Date.now()-retention);
   db.prepare('INSERT INTO conversations(person,created,user,assistant,outcome) VALUES (?,?,?,?,?)').run(id,Date.now(),data.user,data.assistant,outcome);
   db.prepare('DELETE FROM conversations WHERE person=? AND seq NOT IN (SELECT seq FROM conversations WHERE person=? ORDER BY seq DESC LIMIT 100)').run(id,id);
  });}catch{throw new StorageError();}
 }
 async recall(owner:string,id:string,text:string):Promise<Recall[]>{
  try{return this.transaction(owner,db=>{
   if(!db.prepare('SELECT id FROM people WHERE owner=? AND id=? AND remember=1').get(owner,id))return [];
   db.prepare('DELETE FROM conversations WHERE created<?').run(Date.now()-retention);
   // Include recent saved turns too: a resumed visit has a fresh live dialogue.
   const rows=db.prepare('SELECT created,user FROM conversations WHERE person=? ORDER BY seq DESC LIMIT 100').all(id);
   return selectRecall(rows.map(row=>({created:Number(row.created),user:exchange.shape.user.parse(row.user)})),text);
  });}catch{throw new StorageError();}
 }
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {SQLiteProfiles} from './sqlite.ts';
import {StorageError} from './store.ts';
import {changeCart,emptyCart,cartTotal} from './cart.ts';
const a='a'.repeat(64),b='b'.repeat(64);

test('failed assistant replies stay out of history while original user context remains available across returns',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-recovery-db-'));
 try{
  const store=new SQLiteProfiles(dir),person=await store.createPerson(a,'RecoveryTest',true);
  await store.appendHistory(a,person.id,'मुझे संगीत पसंद है','जवाब तैयार करने में दिक्कत हुई।','recovery');
  const reopened=new SQLiteProfiles(dir),rows=await reopened.recentExchanges(a,person.id);
  assert.equal(rows[0].user,'मुझे संगीत पसंद है');assert.equal(rows[0].assistant,'');
  assert.deepEqual(await reopened.history(a,person.id),[{role:'user',content:'मुझे संगीत पसंद है'}]);
  assert.equal((await reopened.recall(a,person.id,'संगीत'))[0].text,'मुझे संगीत पसंद है');
  assert.deepEqual(await reopened.history(b,person.id),[]);
  await store.appendHistory(a,person.id,'अच्छा जी','जी, बताइए।');
  assert.equal((await reopened.history(a,person.id)).at(-1)!.role,'assistant');
  await store.forget(person.id);assert.deepEqual(await reopened.recentExchanges(a,person.id),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('version two migration preserves existing people and tags only exact prior recovery replies',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-v2-'));
 try{
  const filename=join(dir,'saathi.sqlite'),db=new DatabaseSync(filename);
  db.exec('CREATE TABLE profiles(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE people(owner TEXT,id TEXT PRIMARY KEY,name TEXT,lookup TEXT,remember INTEGER); CREATE TABLE conversations(seq INTEGER PRIMARY KEY,person TEXT,created INTEGER,user TEXT,assistant TEXT); PRAGMA user_version=2');
  db.prepare('INSERT INTO profiles VALUES (?,?)').run(b,JSON.stringify({version:1,preferences:{name:'Existing'},cart:emptyCart()}));
  db.prepare('INSERT INTO people VALUES (?,?,?,?,?)').run(a,b,'Existing','existing',1);
  const insert=db.prepare('INSERT INTO conversations(person,created,user,assistant) VALUES (?,?,?,?)');
  insert.run(b,Date.now(),'मुझे संगीत पसंद है','माफ़ कीजिए, मैं आपकी बात ठीक से समझ नहीं पाया। थोड़ा अलग तरह से बताएँगे?');
  insert.run(b,Date.now(),'अच्छा जी','अच्छा जी।');db.close();
  const store=new SQLiteProfiles(dir);assert.equal((await store.person(a,'Existing'))?.id,b);
  const rows=await store.recentExchanges(a,b);assert.equal(rows.length,2);assert.equal(rows[0].assistant,'');assert.equal(rows[1].assistant,'अच्छा जी।');
  const check=new DatabaseSync(filename);assert.equal(check.prepare('PRAGMA user_version').get()!.user_version,3);assert.equal(check.prepare('SELECT count(*) AS n FROM conversations').get()!.n,2);check.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('older relevant recall survives reopening but remains owned, bounded, retained and deletable',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-recall-'));
 try{
  const store=new SQLiteProfiles(dir),person=await store.createPerson(a,'Fictional Mohan',true);
  await store.appendHistory(a,person.id,'मेरे बगीचे में गुलाब खिला था।','अच्छा लगा।');
  for(let i=0;i<3;i++)await store.appendHistory(a,person.id,'आज किताब पढ़ी '+i,'जी।');
  const reopened=new SQLiteProfiles(dir),recall=await reopened.recall(a,person.id,'गुलाब के बारे में बात करें');
  assert.equal(recall.length,1);assert.equal(recall[0].text,'मेरे बगीचे में गुलाब खिला था।');assert.ok(Number.isFinite(Date.parse(recall[0].at)));
  assert.equal((await store.recall(a,person.id,'किताब'))[0].text,'आज किताब पढ़ी 2');
  assert.deepEqual(await store.recall(b,person.id,'गुलाब'),[]);
  assert.deepEqual(await store.recall(a,person.id,'संगीत'),[]);
  const db=new DatabaseSync(store.filename);db.prepare('UPDATE conversations SET created=0').run();db.close();
  assert.deepEqual(await store.recall(a,person.id,'गुलाब'),[]);
  const privatePerson=await store.createPerson(a,'Private',false);await store.appendHistory(a,privatePerson.id,'गुलाब','reply');
  assert.deepEqual(await store.recall(a,privatePerson.id,'गुलाब'),[]);
  await store.forget(person.id);assert.deepEqual(await store.recall(a,person.id,'गुलाब'),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('SQLite migrates legacy preferences/cart without changing the original; survives reopening and deletes both copies',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-sqlite-'));
 try{
  const profile={version:1,preferences:{name:'Test Mohan',language:'hi'},cart:changeCart(emptyCart(),{key:'rice',revision:0,productId:'rice',quantity:1000,unit:'g'})};
  const file=join(dir,a+'.json'),text=JSON.stringify(profile);await writeFile(file,text);
  const store=new SQLiteProfiles(dir);assert.deepEqual(await store.read(a),profile);assert.equal(await readFile(file,'utf8'),text);
  await store.update(a,p=>({...p,preferences:{...p.preferences,topic:'music'}}));
  assert.equal((await new SQLiteProfiles(dir).read(a)).preferences.topic,'music');
  assert.equal(cartTotal((await store.read(a)).cart),6000);assert.deepEqual((await store.read(b)).preferences,{});
  await store.forget(a);await assert.rejects(readFile(file),{code:'ENOENT'});assert.deepEqual((await new SQLiteProfiles(dir).read(a)).preferences,{});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('SQLite serializes cart revisions and retries across separate store instances',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-sqlite-'));
 try{
  const first=new SQLiteProfiles(dir),second=new SQLiteProfiles(dir);
  const action={key:'one',revision:0,productId:'rice',quantity:1000,unit:'g'};
  const results=await Promise.allSettled([first.update(a,p=>({...p,cart:changeCart(p.cart,action)})),second.update(a,p=>({...p,cart:changeCart(p.cart,{...action,key:'two'})}))]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  await second.update(a,p=>({...p,cart:changeCart(p.cart,action)}));assert.equal((await first.read(a)).cart.revision,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('corrupt database and legacy records fail closed and are never overwritten',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-sqlite-'));
 try{
  const store=new SQLiteProfiles(dir);await store.update(a,p=>p);
  const db=new DatabaseSync(store.filename);db.prepare('UPDATE profiles SET data=? WHERE id=?').run('{"version":99}',a);db.close();
  await assert.rejects(store.read(a),StorageError);await assert.rejects(store.update(a,p=>p),StorageError);
  await writeFile(join(dir,b+'.json'),'broken');await assert.rejects(store.read(b),StorageError);assert.equal(await readFile(join(dir,b+'.json'),'utf8'),'broken');
  const check=new DatabaseSync(store.filename);assert.equal(check.prepare('SELECT data FROM profiles WHERE id=?').get(a)!.data,'{"version":99}');check.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});

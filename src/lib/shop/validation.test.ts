import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {LocalProfiles} from './store.ts';
test('rejects structurally corrupt profiles without overwriting them',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-invalid-'));const id='a'.repeat(64);
 try{const store=new LocalProfiles(dir);
 for(const cart of [{revision:-1,lines:[],intents:{}},{revision:0,lines:[{productId:'rice',quantity:-500}],intents:{}},{revision:0,lines:[],intents:null}]){
 await writeFile(join(dir,id+'.json'),JSON.stringify({version:1,preferences:{},cart}));await assert.rejects(store.read(id));
 }}finally{await rm(dir,{recursive:true,force:true});}
});

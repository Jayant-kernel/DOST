import {z} from 'zod';
import {catalog} from './cart.ts';
import {readFile,writeFile,rename,mkdir,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {emptyCart,type Cart} from './cart.ts';
export type Preferences={name?:string;language?:'hi'|'hinglish';topic?:string};
export type Profile={version:1;preferences:Preferences;cart:Cart};
export const storedProfile=z.object({version:z.literal(1),preferences:z.object({name:z.string().min(1).max(60).optional(),language:z.enum(['hi','hinglish']).optional(),topic:z.string().min(1).max(80).optional()}).strict(),cart:z.object({revision:z.number().int().nonnegative().safe(),lines:z.array(z.object({productId:z.string(),quantity:z.number().int().positive().safe()}).strict()).max(catalog.length),intents:z.record(z.string()).refine(v=>Object.keys(v).length<=1000&&Object.keys(v).every(k=>/^[a-zA-Z0-9_-]{1,80}$/.test(k)))}).strict()}).strict().superRefine((p,ctx)=>{
 const ids=new Set<string>();for(const line of p.cart.lines){const product=catalog.find(x=>x.id===line.productId);
 if(!product||ids.has(line.productId)||line.quantity>product.stock||line.quantity%product.step!==0)ctx.addIssue({code:'custom',message:'Invalid stored cart'});ids.add(line.productId);}
});
export class StorageError extends Error {constructor(){super('Local storage unavailable');}}
const queues=new Map<string,Promise<unknown>>();
export class LocalProfiles{
 readonly directory:string;
 constructor(directory=join(process.cwd(),'.saathi-local')){this.directory=resolve(directory);}
 private path(id:string){if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid profile');return join(this.directory,`${id}.json`);}
 async read(id:string):Promise<Profile>{
  try{return storedProfile.parse(JSON.parse(await readFile(this.path(id),'utf8')));}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {version:1,preferences:{},cart:emptyCart()};throw new StorageError();}
 }
 private async serialized<T>(id:string,operation:()=>Promise<T>):Promise<T>{
  const path=this.path(id),previous=queues.get(path)??Promise.resolve();
  const next=previous.catch(()=>{}).then(operation);queues.set(path,next);
  try{return await next;}finally{if(queues.get(path)===next)queues.delete(path);}
 }
 async update(id:string,change:(profile:Profile)=>Profile){return this.serialized(id,async()=>{
  const profile=storedProfile.parse(change(await this.read(id)));
  try{await mkdir(this.directory,{recursive:true});}catch{throw new StorageError();}
  const temporary=this.path(id)+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,JSON.stringify(profile),{mode:0o600,flag:'wx'});await rename(temporary,this.path(id));}catch{throw new StorageError();}
  finally{await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw new StorageError();});}
  return profile;
 });}
 async forget(id:string){return this.serialized(id,async()=>{await unlink(this.path(id)).catch(e=>{if(e.code!=='ENOENT')throw new StorageError();});});}
}

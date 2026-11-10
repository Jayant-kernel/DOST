import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {LocalProfiles} from './store.ts';import {changeCart} from './cart.ts';
test('cart persists after reopening, isolates profiles and rejects concurrent stale writes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'saathi-cart-'));
 try{const store=new LocalProfiles(dir),a='a'.repeat(64),b='b'.repeat(64);
 const results=await Promise.allSettled([1,2].map(n=>store.update(a,p=>({...p,cart:changeCart(p.cart,{key:'intent'+n,revision:0,productId:'rice',quantity:1000,unit:'g'})}))));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await new LocalProfiles(dir).read(a)).cart.revision,1);
 assert.equal((await store.read(b)).cart.lines.length,0);
 await store.forget(a);assert.equal((await store.read(a)).cart.revision,0);
 await assert.rejects(store.read('../escape'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

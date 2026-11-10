import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalog,changeCart,emptyCart,cartTotal} from './cart.ts';
test('catalog has 25 fixture products; cart totals use integer paise',()=>{
 assert.equal(catalog.length,25);
 const cart=changeCart(emptyCart(),{key:'add',revision:0,productId:'rice',quantity:500,unit:'g'});
 assert.equal(cartTotal(cart),3000);assert.equal(cart.revision,1);
});
test('same intent retries once, different payload with same key fails',()=>{
 const action={key:'request-1',revision:0,productId:'rice',quantity:1000,unit:'g'} as const;
 const cart=changeCart(emptyCart(),action);assert.deepEqual(changeCart(cart,action),cart);
 assert.throws(()=>changeCart(cart,{...action,quantity:2000}),/idempotency/);
});
test('reject stale revisions, unknown products, bad quantities, units and stock',()=>{
 const action={key:'test',revision:0,productId:'rice',quantity:1000,unit:'g'};
 for(const patch of [{revision:1},{productId:'unknown'},{quantity:-1},{quantity:0.5},{quantity:251},{quantity:1000000},{unit:'ml'}])assert.throws(()=>changeCart(emptyCart(),{...action,...patch}));
});
test('explicit removal and setting quantity preserve the rest of the cart',()=>{
 let cart=changeCart(emptyCart(),{key:'rice',revision:0,productId:'rice',quantity:1000,unit:'g'});
 cart=changeCart(cart,{key:'milk',revision:1,productId:'milk',quantity:1000,unit:'ml'});
 cart=changeCart(cart,{key:'remove',revision:2,productId:'rice',quantity:0,unit:'g'});
 assert.equal(cart.lines.length,1);assert.equal(cart.lines[0].productId,'milk');
});

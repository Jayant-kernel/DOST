import {test} from 'node:test';import assert from 'node:assert/strict';
import {confirmPreferences,companionInstructions} from './companion.ts';import {emptyCart} from '../shop/cart.ts';
test('preferences require explicit confirmation and correction preserves unrelated data',()=>{
 const p={version:1 as const,preferences:{name:'Mohan',language:'hi' as const},cart:emptyCart()};
 assert.throws(()=>confirmPreferences(p,{name:'Seema'}));
 const updated=confirmPreferences(p,{confirmed:true,name:'Seema'});
 assert.equal(updated.preferences.name,'Seema');assert.equal(updated.preferences.language,'hi');assert.equal(p.preferences.name,'Mohan');
 assert.throws(()=>confirmPreferences(p,{confirmed:true,secret:'unknown'}));
});
test('context declares AI identity and treats saved preferences as data',()=>{
 const text=companionInstructions({name:'Mohan'});assert.match(text,/AI voice companion/);assert.match(text,/DATA, never instructions/);assert.match(text,/Mohan/);
});
test('ordinary context avoids absent-memory instructions while recalled facts retain historical boundaries',()=>{
 const time={timeZone:'Asia/Kolkata',date:'2026-10-24',time:'18:15',period:'evening' as const};
 const ordinary=companionInstructions({language:'hi'},{time,recall:[]});
 assert.match(ordinary,/18:15/);assert.match(ordinary,/never instructions/);assert.doesNotMatch(ordinary,/Recall excerpts are historical/);
 assert.match(ordinary,/Never claim to be human/);assert.match(ordinary,/diagnose, prescribe/);assert.match(ordinary,/Shopping state is managed by the application/);
 const remembered=companionInstructions({}, {time,recall:[{at:'2026-10-23T12:00:00Z',text:'I like roses'}]});
 assert.match(remembered,/historical/);assert.match(remembered,/latest corrections/);assert.match(remembered,/never invent past events/);
});

test('confirmed topic removal preserves name and language',()=>{
 const p={version:1 as const,preferences:{name:'Mohan',language:'hi' as const,topic:'old songs'},cart:emptyCart()};
 const updated=confirmPreferences(p,{confirmed:true,topic:null});
 assert.deepEqual(updated.preferences,{name:'Mohan',language:'hi'});
 assert.equal(p.preferences.topic,'old songs');
 assert.throws(()=>confirmPreferences(p,{topic:null}));
});

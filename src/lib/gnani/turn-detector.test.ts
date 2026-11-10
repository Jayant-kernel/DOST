import {test} from 'node:test';import assert from 'node:assert/strict';import {TurnDetector} from './turn-detector.ts';
test('quiet speech opens a turn; patient pauses resume before a real endpoint',()=>{
 const d=new TurnDetector(0);
 for(let t=50;t<=600;t+=50)d.sample(t<200?0.002:0.015,t);
 assert.equal(d.heardSpeech,true);assert.equal(d.sample(0.002,2400),'listen');
 for(let t=2450;t<=2650;t+=50)d.sample(0.015,t);
 assert.equal(d.sample(0.002,4800),'listen');assert.equal(d.sample(0.002,4900),'finish');
});
test('silence and isolated clicks never become a submitted turn',()=>{
 const d=new TurnDetector(0);
 for(let t=50;t<15000;t+=50)assert.equal(d.sample(t%2000===0?0.2:0.002,t),'listen');
 assert.equal(d.heardSpeech,false);assert.equal(d.sample(0,15000),'listen');assert.equal(d.sample(0,25000),'idle');
});
test('pause preference, recording cap and invalid samples are bounded',()=>{
 const d=new TurnDetector(0,3000);for(let t=50;t<=300;t+=50)d.sample(0.1,t);
 assert.equal(d.sample(0,2600),'listen');assert.equal(d.sample(0,3300),'finish');
 assert.equal(d.sample(0.1,25000),'limit');assert.equal(new TurnDetector(0).sample(0,25000),'idle');
 assert.equal(new TurnDetector(0).sample(NaN,100),'listen');
});

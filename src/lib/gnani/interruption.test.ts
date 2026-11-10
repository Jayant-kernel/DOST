import {test} from 'node:test';import assert from 'node:assert/strict';import {InterruptionDetector} from './interruption.ts';
test('sustained speech interrupts; short noise and separated sounds do not',()=>{
 const detector=new InterruptionDetector();assert.equal(detector.sample(0.1,0),false);assert.equal(detector.sample(0,100),false);
 assert.equal(detector.sample(0.1,200),false);assert.equal(detector.sample(0.1,450),false);assert.equal(detector.sample(0.1,500),true);
});

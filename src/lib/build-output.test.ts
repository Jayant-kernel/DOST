import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildOutput} from './build-output.ts';
test('development artifacts cannot be overwritten by a production build',()=>{
 assert.notEqual(buildOutput(true),buildOutput(false));
});

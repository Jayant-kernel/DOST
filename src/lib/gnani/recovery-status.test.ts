import {test} from 'node:test';import assert from 'node:assert/strict';
import {recoveryStatus} from './recovery-status.ts';
test('quality failures are distinct from timeout, hearing and service access failures',()=>{
 assert.match(recoveryStatus('quality','repetitive-reply'),/generated a repeated reply/);
 assert.match(recoveryStatus('quality','incomplete-answer'),/did not complete/);
 assert.match(recoveryStatus('quality','invalid-stream'),/did not complete/);
 assert.match(recoveryStatus('timeout',null),/took too long/);
 assert.match(recoveryStatus('unavailable',null),/service could not respond/);
 assert.doesNotMatch(recoveryStatus('quality','private upstream content'),/private upstream content|hear|microphone|key|timed out/);
});

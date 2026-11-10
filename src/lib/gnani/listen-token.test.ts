import {test} from 'node:test';import assert from 'node:assert/strict';
import {issueListenToken,verifyListenToken} from './listen-token.mjs';
test('live microphone grant is signed, origin-bound and expires within thirty seconds',()=>{
 const secret='x'.repeat(32),origin='http://localhost:3000',token=issueListenToken(secret,origin,1000);
 assert.ok(verifyListenToken(secret,token,origin,1001));
 assert.equal(verifyListenToken(secret,token,origin,31000),null);
 assert.equal(verifyListenToken(secret,token,'http://foreign.test',1001),null);
 assert.equal(verifyListenToken('y'.repeat(32),token,origin,1001),null);
 assert.equal(verifyListenToken(secret,token+'x',origin,1001),null);
});

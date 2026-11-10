import {test} from 'node:test';import assert from 'node:assert/strict';
import {selectionToken,profileId,ownerId} from './local-demo.ts';
test('speaker selectors are signed and cannot be moved to a different browser capability',()=>{
 const saved=process.env.SESSION_SIGNING_SECRET;process.env.SESSION_SIGNING_SECRET='test-only-secret';
 try{
  const token='a'.repeat(64),person='b'.repeat(64),request=new Request('http://localhost:3000',{headers:{cookie:'saathi_profile='+token}}),owner=ownerId(request)!;
  const selected=selectionToken(owner,person),req=(t:string,s:string)=>new Request('http://localhost:3000',{headers:{cookie:`saathi_profile=${t}; saathi_person=${s}`}});
  assert.equal(profileId(req(token,selected)),person);assert.equal(profileId(req('c'.repeat(64),selected)),null);assert.equal(profileId(req(token,selected.slice(0,-1)+(selected.endsWith('0')?'1':'0'))),null);assert.equal(profileId(request),owner);
 }finally{if(saved===undefined)delete process.env.SESSION_SIGNING_SECRET;else process.env.SESSION_SIGNING_SECRET=saved;}
});

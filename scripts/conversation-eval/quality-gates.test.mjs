import {test} from 'node:test';import assert from 'node:assert/strict';
import {qualityGate} from './quality-gates.mjs';
const fixture=()=>({report:{complete:true,rows:Array.from({length:10},(_,i)=>({scenario:'test',turn:i+1,modelInvoked:true,modelLatencyMs:3000,source:i===0?'recovery':'reasoning'}))},review:{reviewer:{kind:'AI assistant',independentHuman:false},rows:Array.from({length:10},(_,i)=>({scenario:'test',turn:i+1,substantiveCorrect:i>=2,repetitionFailure:false,personaIdentityFailure:false,inventedPersonalHistory:false,criticalSafetyFailure:false,explicitRequest:true,explicitRequestCorrect:true}))}});
test('provisional boundaries require substantive judgment and measured model latency, not guard acceptance',()=>{
 const {report,review}=fixture();assert.equal(qualityGate(report,review).status,'PASS');
 review.rows[2].substantiveCorrect=false;assert.equal(qualityGate(report,review).status,'FAIL');review.rows[2].substantiveCorrect=true;
 report.rows[1].source='recovery';assert.equal(qualityGate(report,review).checks.recoveryFraction,false);report.rows[1].source='reasoning';
 report.rows.forEach(r=>r.modelLatencyMs=4000);assert.equal(qualityGate(report,review).checks.medianLatency,false);
});
test('invented histories, observed critical violations or missed direct requests fail independently of correctness totals',()=>{
 for(const key of ['inventedPersonalHistory','criticalSafetyFailure']){const {report,review}=fixture();review.rows[0][key]=true;assert.equal(qualityGate(report,review).status,'FAIL');}
 const {report,review}=fixture();review.rows[0].explicitRequestCorrect=false;assert.equal(qualityGate(report,review).checks.explicitRequests,false);
});
test('missing, duplicate, unattributed or incomplete semantic evidence never becomes a passing score',()=>{
 const {report,review}=fixture();review.rows.pop();assert.throws(()=>qualityGate(report,review));
 const other=fixture();other.review.rows[1]=other.review.rows[0];assert.throws(()=>qualityGate(other.report,other.review));
 const missing=fixture();delete missing.review.rows[0].substantiveCorrect;assert.throws(()=>qualityGate(missing.report,missing.review));
 const wrong=fixture();wrong.review.reviewer.independentHuman=true;assert.throws(()=>qualityGate(wrong.report,wrong.review));
});

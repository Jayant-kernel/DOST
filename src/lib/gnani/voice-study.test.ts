import {test} from 'node:test';import assert from 'node:assert/strict';
import {newStudy,publicStudy,studyExport,studyDimensions,shuffled} from './voice-study.ts';
const valid=(s:ReturnType<typeof newStudy>)=>({ratings:s.clips.map(c=>({token:c.token,heard:true,scores:Object.fromEntries(studyDimensions.map(d=>[d,4]))})),preferences:s.scenarios.map(scenario=>({scenario,choice:'no-preference'})),overall:'tie',feedback:'',criticalConcern:'none-observed',concernDetails:''});
test('opaque study presents all15 saved conditions with stable listener labels, random orders and no pre-export mapping',()=>{
 const s=newStudy(),p=publicStudy(s);assert.equal(s.clips.length,15);assert.equal(new Set(s.clips.map(c=>c.token)).size,15);assert.equal(p.scenarios.length,5);
 for(const id of s.scenarios){const clips=s.clips.filter(c=>c.scenario===id);assert.deepEqual(new Set(clips.map(c=>c.variant)),new Set(['existing','neutral','expressive']));}
 assert.doesNotMatch(JSON.stringify(p),/existing|expressive|neutral|\.wav|CHEERFUL|variant|analysisKey/u);
 assert.deepEqual(shuffled([1,2,3],()=>0),[2,3,1]);assert.throws(()=>shuffled([1,2],()=>9));
 for(const c of s.clips)assert.equal(s.key[c.recording],c.variant);
});
test('export requires full unique delivered recordings, valid scores and all preferences; technical checks cannot become human evidence',()=>{
 const s=newStudy(true);assert.throws(()=>studyExport(s,valid(s)));s.clips.forEach(c=>s.served.add(c.token));
 const exportData=studyExport(s,valid(s));assert.equal(exportData.technicalOnly,true);assert.equal(exportData.consented,false);assert.equal(exportData.independentHumanVerified,false);assert.equal(exportData.ratings.length,15);
 const duplicate=valid(s);duplicate.ratings[1]=duplicate.ratings[0];assert.throws(()=>studyExport(s,duplicate));
 const missing=valid(s);missing.preferences[1]=missing.preferences[0];assert.throws(()=>studyExport(s,missing));
 const bad=valid(s);bad.ratings[0].scores.naturalness=6;assert.throws(()=>studyExport(s,bad));
 s.exported=true;assert.throws(()=>studyExport(s,valid(s)));
});

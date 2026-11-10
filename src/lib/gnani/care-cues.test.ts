import {test} from 'node:test';import assert from 'node:assert/strict';
import {feelingCue,vocalFeatures,relativeVoiceCue} from './care-cues.ts';
import {pcmWav} from './pcm.ts';
test('feelings use self-reported words, respect fewer questions, and leave complex requests to reasoning',()=>{
 assert.equal(feelingCue('आज मैं उदास हूँ।')?.tone,'supportive');
 assert.doesNotMatch(feelingCue('मैं उदास हूँ',false)!.reply!,/\?/);
 assert.equal(feelingCue('मैं खुश हूँ')?.tone,'positive');
 assert.doesNotMatch(feelingCue('मैं उदास हूँ',true,['जी, क्या बात मन पर है?'])!.reply!,/\?/);
 for(const text of ['मैं खुश नहीं हूँ','मेरी बेटी उदास है','उसने कहा मैं उदास हूँ','“मैं उदास हूँ” का मतलब','मैं उदास हूँ लेकिन क्या करूँ?','I am not sad'])assert.equal(feelingCue(text),undefined,text);
});
function tone(hz:number,amplitude=.1){const bytes=new Uint8Array(32000),v=new DataView(bytes.buffer);for(let i=0;i<16000;i++)v.setInt16(2*i,Math.sin(2*Math.PI*hz*i/16000)*32767*amplitude,true);return pcmWav(bytes);}
test('bounded PCM pitch/energy features reject silence, clipped and malformed audio',()=>{
 const result=vocalFeatures(tone(200));assert.ok(result);assert.ok(Math.abs(result.pitchHz-200)<10);
 assert.equal(vocalFeatures(tone(200,0)),undefined);assert.equal(vocalFeatures(new Uint8Array(44)),undefined);
 assert.equal(vocalFeatures(tone(200,1)),undefined);
 const malformed=tone(200);new DataView(malformed.buffer).setUint32(40,999999,true);assert.equal(vocalFeatures(malformed),undefined);
});
test('no emotion is inferred from pitch; relative cue needs multiple turns and joint energy/pitch change',()=>{
 const a=vocalFeatures(tone(200))!,b=vocalFeatures(tone(300,.25))!;
 const first=relativeVoiceCue(a);assert.equal(first.changed,false);
 const second=relativeVoiceCue(a,first.baseline);assert.equal(second.changed,false);
 assert.equal(relativeVoiceCue(b,second.baseline).changed,true);
 assert.equal(relativeVoiceCue({...a,pitchHz:300},second.baseline).changed,false);
 assert.equal(relativeVoiceCue(undefined,second.baseline).changed,false);
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {voicePersonality,voiceStyles} from './voice-personality.ts';
import {voiceSamples,previewSpeech} from './voice-preview.ts';
const common={validatedText:'यह अच्छी खबर है। आप आराम से कहिए।',preferences:{voice:'Shivani',speed:0.9 as const,language:'hi-en' as const},capabilities:{model:'timbre-v3.0' as const,audioTags:true},sensitive:false,positiveMoment:true};
test('expression is opt-in, preserves spoken content/voice/speed/language and adds at most one approved cue',()=>{
 assert.equal(voicePersonality({...common,style:'CHEERFUL'}).text,common.validatedText);
 for(const style of voiceStyles){const plan=voicePersonality({...common,style,enabled:true});assert.equal(plan.text.replace(/<[^>]*> /gu,''),common.validatedText);assert.equal(plan.voice,'Shivani');assert.equal(plan.speed,0.9);assert.equal(plan.language,'hi-en');assert.ok(plan.tags.length<=1);assert.ok(plan.tags.every(tag=>['excited','pauses'].includes(tag)));}
});
test('safety/consent/privacy, plain mode and unsupported capabilities prevent all expression',()=>{
 for(const validatedText of ['दवा की खुराक डॉक्टर से पूछें।','आपकी अनुमति से जानकारी सहेजी गई है।','सीने में दर्द हो तो तुरंत मदद लें।','आपका इतिहास मिटाया नहीं गया।'])assert.equal(voicePersonality({...common,validatedText,enabled:true,style:'CHEERFUL'}).tags.length,0);
 for(const change of [{sensitive:true},{sensitive:undefined},{preferences:{...common.preferences,plain:true}},{capabilities:{model:'timbre-v2.5' as const,audioTags:false}},{capabilities:{model:'timbre-v3.0' as const,audioTags:false}},{positiveMoment:false}])assert.equal(voicePersonality({...common,...change,enabled:true,style:'CHEERFUL'}).tags.length,0);
});
test('untrusted tags never reach synthesis and empty content is rejected',()=>{
 const plan=voicePersonality({...common,validatedText:'<shouting> नमस्ते। <script> सादर।',enabled:true,style:'STORYTELLING'});assert.doesNotMatch(plan.text,/shouting|script/u);assert.equal(plan.spokenText,'नमस्ते।  सादर।');
 assert.throws(()=>voicePersonality({...common,validatedText:'<laugh>'}));
});
test('fixed A/B/C comparisons keep the exact voice, content and speed; existing Tara is already v3 neutral here',()=>{
 assert.equal(voiceSamples.length,5);
 for(const sample of voiceSamples){const a=previewSpeech(sample.id,'existing'),b=previewSpeech(sample.id,'neutral'),c=previewSpeech(sample.id,'expressive');assert.equal(a.text,b.text);assert.equal(b.spokenText,c.spokenText);assert.equal(c.voice,b.voice);assert.equal(c.speed,b.speed);assert.equal(c.model,b.model);}
 assert.throws(()=>previewSpeech('arbitrary user text','neutral'));
});

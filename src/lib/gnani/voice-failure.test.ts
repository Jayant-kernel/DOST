import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProviders,NoSpeechError,ProviderError} from './providers.ts';
import {voiceFailure} from './voice-failure.ts';

const config={apiKey:'secret',evonUrl:'http://localhost:8080',voice:'Yashraj'};
test('successful empty Prisma transcription is recoverable, distinct from a broken provider',async()=>{
 for(const transcript of ['', '   ']){
  const api=createProviders(config,async()=>Response.json({success:true,transcript}));
  await assert.rejects(api.transcribe(new Blob()),error=>error instanceof NoSpeechError&&voiceFailure(error).code==='speech_not_detected'&&voiceFailure(error).status===422);
 }
 for(const payload of [{success:false,transcript:''},{success:true},{success:true,transcript:42}]){
  const api=createProviders(config,async()=>Response.json(payload));
  await assert.rejects(api.transcribe(new Blob()),error=>error instanceof ProviderError&&!(error instanceof NoSpeechError)&&voiceFailure(error).code==='transcription_unavailable');
 }
});
test('public failures identify speech stages without leaking upstream text or credentials',()=>{
 assert.equal(voiceFailure(new ProviderError('Timbre',403)).code,'speech_unavailable');
 assert.equal(voiceFailure(new ProviderError('Evon response quality')).code,'reply_unclear');
 assert.equal(voiceFailure(new ProviderError('Prisma',401)).code,'transcription_access');
 assert.equal(voiceFailure(new ProviderError('Prisma',429)).code,'transcription_limit');
 assert.equal(voiceFailure(new Error('secret upstream data')).error,'Reply unavailable. Please try again.');
});

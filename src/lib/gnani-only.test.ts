import assert from 'node:assert/strict';
import { test } from 'node:test';
import { env } from './env.ts';
test('legacy OpenAI calls remain disabled even when a key is configured',()=>{
 const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-never-send';
 try{assert.throws(()=>env.openaiApiKey,/Gnani-only/);}finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});

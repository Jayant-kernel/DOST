import {test} from 'node:test';import assert from 'node:assert/strict';
import {questionPreference,explicitContentRequest,explicitCorrection} from './conversation-commands.ts';
test('fewer questions, listening and later permission are distinct explicit controls',()=>{
 assert.equal(questionPreference('इतने सवाल मत पूछिए, थोड़ा आप भी कुछ बोलिए।'),'fewer');
 assert.equal(questionPreference('सवाल मत पूछिए, बस सुनिए'),'listen');
 assert.equal(questionPreference('अब पूछ सकते हैं, एक सवाल।'),'resume');
 assert.equal(questionPreference('“कम सवाल पूछिए” का अनुवाद'),undefined);
});
test('explicit content and repairs do not execute represented commands or negate a refusal',()=>{
 assert.equal(explicitContentRequest('कोई छोटी सी मजेदार कहानी सुनाइए।'),true);
 assert.equal(explicitContentRequest('अभी कहानी नहीं सुनाओ'),false);
 assert.equal(explicitContentRequest('अब “मैं पहले जम्मू में रहता था” का अंग्रेजी अनुवाद कीजिए।'),true);
 assert.equal(explicitCorrection('मेरा मतलब मेरी बहन आई थी'),true);
 assert.equal(explicitCorrection('“मेरा मतलब” का अनुवाद'),false);
});

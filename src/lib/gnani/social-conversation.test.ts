import {test} from 'node:test';import assert from 'node:assert/strict';
import {socialConversation,type SocialState} from './social-conversation.ts';
import type {Message} from './providers.ts';
test('meal acknowledgment leads to a music conversation, reflection and one voluntary past-day walk topic',()=>{
 const messages:Message[]=[{role:'assistant',content:'मन हो तो अब कुछ देर आराम से बैठ सकते हैं।'}];let state:SocialState={};
 const answer=(text:string)=>{messages.push({role:'user',content:text});const next=socialConversation(messages,state);state=next.state;assert.ok(next.reply,text);messages.push({role:'assistant',content:next.reply});return next.reply;};
 assert.match(answer('ठीक है'),/किस तरह का संगीत/);
 assert.match(answer('पुराने गाने'),/पसंदीदा गाना या गायक/);
 const artist=answer('किशोर कुमार');assert.match(artist,/पसंद की कोई उम्र/);assert.doesNotMatch(artist,/\?/);assert.match(artist,/मन हो तो/);
 const memory=answer('कॉलेज में सुनता था');assert.match(memory,/कॉलेज/);assert.doesNotMatch(memory,/\?/);
 assert.match(answer('हाँ'),/आज दिन में टहलने/);assert.match(answer('हाँ'),/कहाँ गए थे/);
 assert.doesNotMatch(answer('पार्क में'),/\?|संगीत की बात|मौसम|दवा/);
});
test('stated tastes, including newer songs, are followed without assuming age or religion',()=>{
 for(const text of ['मुझे पुराने गाने पसंद हैं','मुझे नए गाने पसंद हैं','मुझे लोकगीत पसंद हैं']){
  const {reply}=socialConversation([{role:'user',content:text}]);assert.ok(reply);assert.equal(reply.match(/\?/g)?.length,1);assert.doesNotMatch(reply,/बुज़ुर्ग|बूढ़े|आपकी उम्र|भजन|दवा/);
 }
});
test('direct questions, symptoms, grief, reported speech and unrelated answers escape the small flow',()=>{
 for(const text of ['पुराने गाने क्या होते हैं?','मुझे दवा के बाद चक्कर आया','किशोर कुमार लेकिन आज मन उदास है','“मुझे पुराने गाने पसंद हैं”','मेरी माँ को पुराने गाने पसंद हैं','मेरे दोस्त का निधन हो गया','मुझे खाना चाहिए']){
  const result=socialConversation([{role:'user',content:text}],{phase:'song'});assert.equal(result.reply,undefined,text);assert.equal(result.state.phase,undefined);
 }
});
test('listening, quiet preferences, refusal and stopped topics suppress invitations',()=>{
 const rest:Message={role:'assistant',content:'मन हो तो अब कुछ देर आराम से बैठ सकते हैं।'};
 assert.equal(socialConversation([rest,{role:'user',content:'ठीक है'}],{},{allowInitiative:false}).reply,undefined);
 assert.equal(socialConversation([{role:'user',content:'बस सुनिए'},rest,{role:'user',content:'ठीक है'}]).reply,undefined);
 const refused=socialConversation([{role:'user',content:'नहीं चाहिए'}],{phase:'music',musicOffered:true});assert.ok(refused.reply);assert.doesNotMatch(refused.reply,/\?/);assert.equal(refused.state.musicDeclined,true);
 assert.equal(socialConversation([rest,{role:'user',content:'ठीक है'}],refused.state).reply,undefined);
 const quiet=socialConversation([{role:'user',content:'मुझे नए गाने पसंद हैं'}],{},{allowInitiative:false});assert.doesNotMatch(quiet.reply!,/\?/);
 assert.doesNotMatch(socialConversation([{role:'user',content:'नहीं'}],{phase:'walk-answer'}).reply!,/टहलने जाइए|\?/);
});
test('humour stays off in gentle/plain delivery and recent serious context',()=>{
 for(const [messages,plain] of [[[{role:'user',content:'लता जी'}],true],[[{role:'user',content:'आज मन उदास है'},{role:'user',content:'लता जी'}],false]] as [Message[],boolean][]){
  const result=socialConversation(messages,{phase:'song'},{plain});assert.ok(result.reply);assert.doesNotMatch(result.reply,/पसंद की कोई उम्र/);
 }
});
test('state remains private to the caller and unrelated input cancels pending follow-ups',()=>{
 const original:SocialState={phase:'song'};socialConversation([{role:'user',content:'लता जी'}],original);assert.deepEqual(original,{phase:'song'});
 assert.equal(socialConversation([{role:'user',content:'लता जी'}]).reply,undefined);
 const unrelated=socialConversation([{role:'user',content:'अभी अखबार पढ़ रहा हूँ'}],original);assert.equal(unrelated.state.phase,undefined);
});

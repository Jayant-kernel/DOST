import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conversationEngagement,type EngagementState} from './engagement.ts';
import {repetitiveReply} from './reply-quality.ts';

test('listening survives context trimming and only explicit permission restores questions',()=>{
 let {state}=conversationEngagement('सवाल मत पूछिए, बस सुनिए।');
 for(let i=0;i<6;i++)state=conversationEngagement('आज बागवानी की।',state).state;
 assert.equal(state.listenOnly,true);
 assert.equal(repetitiveReply('आपने कौन से फूल लगाए?',[{role:'user',content:'आज बागवानी की।'}],state.listenOnly),true);
 const resumed=conversationEngagement('अब आप सवाल पूछ सकते हैं।',state);
 assert.equal(resumed.state.listenOnly,false);assert.ok(resumed.reply);assert.equal(resumed.state.choosingTopic,true);
 assert.equal(conversationEngagement('और सवाल पूछिए।',state).state.listenOnly,false);
 assert.equal(conversationEngagement('ask more questions',state).state.listenOnly,false);
});
test('a requested topic gets one invitation without inventing personal history or repeating its question',()=>{
 const menu=conversationEngagement('मुझसे कुछ सवाल पूछिए।');
 assert.ok(menu.reply);assert.equal(menu.reply.match(/\?/g)?.length,1);
 const selected=conversationEngagement('बागवानी',menu.state);
 assert.match(selected.reply!,/बागवानी/);assert.doesNotMatch(selected.reply!,/पिछली बार|याद है|गुलाब/);
 const repeated=conversationEngagement('बागवानी पर बात करें।',selected.state);
 assert.ok(repeated.reply);assert.doesNotMatch(repeated.reply,/\?/);
});
test('menu cancellation and listening take priority over optional topic invitations',()=>{
 const menu=conversationEngagement('विषय बदलें।');
 const refused=conversationEngagement('इस बारे में बात नहीं करनी।',menu.state);
 assert.doesNotMatch(refused.reply!,/\?/);assert.equal(refused.state.choosingTopic,false);
 assert.equal(conversationEngagement('संगीत',refused.state).reply,undefined);
 const listening=conversationEngagement('बस मेरी बात सुनिए।',menu.state);
 assert.equal(listening.state.choosingTopic,false);
 assert.equal(conversationEngagement('बागवानी पर बात करें।',listening.state).reply,undefined);
});
test('arbitrary, sensitive, negated and quoted input never becomes a scripted topic answer',()=>{
 for(const text of ['संगीत पसंद नहीं है','संगीत से जुड़ा एक सवाल है','सीने में दर्द है','दवा की खुराक बढ़ाऊँ?','"विषय बदलें" का मतलब क्या है?','बागवानी पर बात करें लेकिन उदास हूँ']){
  const result=conversationEngagement(text,{choosingTopic:true});
  assert.equal(result.reply,undefined);assert.equal(result.state.choosingTopic,false);
 }
 assert.equal(conversationEngagement('"बस सुनिए" का मतलब क्या है?').state.listenOnly,false);
 assert.equal(conversationEngagement('Translate: just listen').state.listenOnly,false);
});
test('state is bounded, immutable and never leaks into a new conversation',()=>{
 const initial:EngagementState={askedTopics:[]};
 const a=conversationEngagement('संगीत पर बात करें।',initial);
 const b=conversationEngagement('बागवानी पर बात करें।',a.state);
 const c=conversationEngagement('खाना पर बात करें।',b.state);
 assert.deepEqual(initial,{askedTopics:[]});assert.equal(c.state.askedTopics?.length,3);
 assert.equal(conversationEngagement('hello').state.listenOnly,false);
 assert.equal(conversationEngagement('संगीत').reply,undefined);
});

test('a bare no declines an offered topic menu, without becoming a food answer or ending the session',()=>{
 const offered=conversationEngagement('विषय बदलें।');
 const declined=conversationEngagement('नहीं।',offered.state);
 assert.equal(declined.state.choosingTopic,false);assert.equal(declined.state.listenOnly,false);
 assert.ok(declined.reply);assert.doesNotMatch(declined.reply,/खाने|खा लिया|\?/);
 assert.equal(conversationEngagement('नहीं।').reply,undefined);
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {ContinuousConversation} from './continuous-conversation.ts';
test('empty recognition retries twice without consuming reply budget and respects Stop and expiration',()=>{
 const c=new ContinuousConversation(),ticket=c.begin(100);
 assert.equal(c.retryNoSpeech(ticket,200),true);assert.equal(c.retryNoSpeech(ticket,300),true);assert.equal(c.retryNoSpeech(ticket,400),false);
 c.completed(ticket);assert.equal(c.retryNoSpeech(ticket,500),true);
 c.stop();assert.equal(c.retryNoSpeech(ticket,600),false);
 const next=c.begin(700);assert.equal(c.retryNoSpeech(ticket,800),false);assert.equal(c.retryNoSpeech(next,1800700),false);
 for(let i=0;i<30;i++)c.completed(next);assert.equal(c.retryNoSpeech(next,900),false);
});
test('automatic turns continue within budget, but delayed completion cannot resurrect Stop',()=>{
 const c=new ContinuousConversation(),ticket=c.begin(100);assert.equal(c.canListen(ticket,200),true);
 c.completed(ticket);assert.equal(c.canListen(ticket,300),true);c.stop();c.completed(ticket);assert.equal(c.canListen(ticket,400),false);
 const next=c.begin(500);assert.equal(c.canListen(ticket,600),false);for(let i=0;i<8;i++)c.completed(next);assert.equal(c.canListen(next,600),true);
 for(let i=8;i<30;i++)c.completed(next);assert.equal(c.canListen(next,600),false);
 const last=c.begin(100);assert.equal(c.canListen(last,900101),true);assert.equal(c.canListen(last,1800101),false);
});

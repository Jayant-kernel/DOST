import {listenOnlyRequested} from './reply-quality.ts';

export type ConversationTopic='music'|'gardening'|'food';
export type EngagementState={listenOnly?:boolean;choosingTopic?:boolean;askedTopics?:ConversationTopic[]};
const topics:{id:ConversationTopic;match:RegExp;reply:string}[]=[
 {id:'music',match:/^(?:संगीत|गाने|music)$/iu,reply:'आपको किस तरह का संगीत सुनना अच्छा लगता है?'},
 {id:'gardening',match:/^(?:बागवानी|gardening)$/iu,reply:'बागवानी में आपको सबसे ज़्यादा क्या पसंद है?'},
 {id:'food',match:/^(?:खाना|पकवान|food|cooking)$/iu,reply:'आपका कोई पसंदीदा पकवान है जिसके बारे में बात करना चाहेंगे?'}
];

// Exact, application-owned controls, not emotion detection or open-ended reasoning.
// Only the current voice session stores these choices; nothing becomes a biography.
export function conversationEngagement(text:string,previous:EngagementState={}){
 const clean=text.trim().normalize('NFKC').replace(/[।.!?]+$/u,'').trim();
 const state:EngagementState={...previous,askedTopics:[...(previous.askedTopics??[])]};
 state.listenOnly=listenOnlyRequested([{role:'user',content:text}],previous.listenOnly);
 const result=(reply?:string)=>({state,reply});
 if(/^(?:अब आप सवाल पूछ सकते हैं|अब सवाल पूछिए|मुझसे (?:कुछ |एक )?सवाल पूछिए|you can ask questions now|ask me (?:a |some )?questions?)$/iu.test(clean)){
  state.listenOnly=false;state.choosingTopic=true;
  return result('ज़रूर जी। संगीत, बागवानी या खाने में से किस पर बात करना चाहेंगे?');
 }
 if(/^(?:इस (?:बारे में|विषय पर) बात नहीं करनी|यह विषय छोड़िए|इसे छोड़िए|skip (?:this )?topic)$/iu.test(clean)){
  state.choosingTopic=false;
  return result('ठीक है जी, इस विषय को छोड़ देते हैं। आप अपनी पसंद की बात कह सकते हैं।');
 }
 if(state.listenOnly){state.choosingTopic=false;return result();}
 if(previous.choosingTopic&&/^(?:नहीं|नही|अभी नहीं|नहीं जी|no|not now)$/iu.test(clean)){
  state.choosingTopic=false;
  return result('ठीक है जी, इन विषयों को छोड़ देते हैं। आप अपनी पसंद की बात कह सकते हैं।');
 }
 if(/^(?:विषय बदलें|विषय बदल दीजिए|कुछ और बात करें|बातचीत शुरू कीजिए|change (?:the )?topic|start a conversation)$/iu.test(clean)){
  state.choosingTopic=true;
  return result('ज़रूर जी। संगीत, बागवानी या खाने में से किस पर बात करना चाहेंगे?');
 }
 const direct=/^(.+?)(?: पर बात करें| के बारे में बात करें)$/u.exec(clean)?.[1];
 const topic=(state.choosingTopic||direct)?topics.find(item=>item.match.test(direct??clean)):undefined;
 state.choosingTopic=false; // Unrelated input cancels the menu instead of capturing a later word.
 if(!topic)return result();
 if(state.askedTopics!.includes(topic.id))return result('उस विषय पर आप जो कहना चाहें, मैं सुन रहा हूँ।');
 state.askedTopics!.push(topic.id);
 return result(topic.reply);
}

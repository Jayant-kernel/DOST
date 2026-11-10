import type {Message} from './providers.ts';
import {asksForAnswer} from './direct-request.ts';
import {listenOnlyRequested} from './reply-quality.ts';

export type SocialState={phase?:'music'|'song'|'memory'|'music-story-done'|'walk-answer'|'walk-place'|'music-offer';musicOffered?:boolean;musicDeclined?:boolean;walkDiscussed?:boolean};
const musicQuestion='आपको किस तरह का संगीत सुनना अच्छा लगता है?';
const sensitive=/दर्द|दवा|गोली|खुराक|बीमार|चक्कर|साँस|सांस|खून|उदास|परेशान|डर|झगड़|मौत|मृत्यु|निधन|गुज़र|मर ग|अकेल|दुख|गिर ग|रो रह|\b(?:pain|medicine|dose|sad|grief|death|afraid|lonely|dizz|breath|fell)\b/iu;
const yes=/^(?:हाँ|हां|जी|जी हाँ|जी हां|ठीक|ठीक है|ठीक है जी|अच्छा|सुनाइए|yes|okay|ok)$/iu;
const no=/^(?:नहीं|नही|अभी नहीं|नहीं चाहिए|रहने दीजिए|बात नहीं करनी|कोई नहीं|पसंद नहीं|no|not now)$/iu;

// Deliberately bounded public dialogue, not a substitute for open reasoning.
// Preferences stay in this session; no age, religion or psychological inference.
export function socialConversation(messages:Message[],previous:SocialState={},options:{allowInitiative?:boolean;plain?:boolean}={}){
 const state={...previous};const result=(reply?:string)=>({state,reply});
 const text=(messages.at(-1)?.content??'').normalize('NFKC').trim().replace(/[।.!]+$/u,'').trim();
 const last=messages.filter(m=>m.role==='assistant').at(-1)?.content??'';
 const allow=options.allowInitiative!==false;
 if(listenOnlyRequested(messages)||/इस (?:बारे में|विषय पर) बात नहीं करनी|यह विषय छोड़िए|इसे छोड़िए|skip (?:this )?topic/iu.test(text)){state.phase=undefined;state.musicDeclined=true;return result();}
 if(asksForAnswer(text)||sensitive.test(text)||/["“”«»]/u.test(text)||/अनुवाद|उदाहरण|मतलब|कहानी में|\b(?:translate|example|meaning|quote)\b/iu.test(text)){state.phase=undefined;return result();}
 if(!state.phase&&last.includes(musicQuestion))state.phase='music';
 const inviteMusic=(prefix:string)=>{
  if(!allow||state.musicOffered||state.musicDeclined)return result();
  state.musicOffered=true;state.phase='music';return result(prefix+' '+musicQuestion);
 };
 if(state.phase==='walk-answer'&&no.test(text)){state.phase=undefined;return result('ठीक है जी। आज टहलना नहीं हुआ, तो भी आराम से बातचीत कर सकते हैं।');}
 if(state.phase&&(no.test(text)||/^(?:मुझे )?(?:संगीत|गाने) पसंद नहीं(?: हैं| है)?$/u.test(text))){
  if(state.phase==='music'||state.phase==='music-offer')state.musicDeclined=true;
  state.phase=undefined;return result('ठीक है जी, इस बात को यहीं छोड़ देते हैं।');
 }
 // Continue the meal/rest exchange rather than another health checklist.
 if((last.endsWith('मन हो तो अब कुछ देर आराम से बैठ सकते हैं।')||last==='जी, आराम से।')&&yes.test(text)){
  return inviteMusic('अच्छा जी। अब खाने से हटकर थोड़ी मन की बात करें।');
 }
 const style=/^(?:(?:मुझे|मुझको) )?(पुराने गाने|पुराने गीत|नए गाने|नये गाने|नए गीत|भजन|ग़ज़ल|गजल|ग़ज़लें|गजलें|शास्त्रीय संगीत|लोकगीत)(?: (?:सुनना )?(?:बहुत )?(?:पसंद हैं|पसंद है|अच्छे लगते हैं|अच्छा लगता है))?$/u.exec(text)?.[1]??(state.phase==='music'&&/^(?:पुराने|नए|नये)$/u.test(text)?text+' गाने':undefined);
 if(style&&(state.phase==='music'||/^(?:मुझे|मुझको) /u.test(text))){
  state.musicOffered=true;state.phase=allow?'song':undefined;
  const statement=`अच्छा जी, ${style} सुनना पसंद है आपको।`;
  return result(statement+(allow?' कोई एक पसंदीदा गाना या गायक बताएँगे?':''));
 }
 if(state.phase==='song'){
  const singer=/^(?:(?:मुझे|मुझको) )?(किशोर कुमार|लता मंगेशकर|लता जी|मोहम्मद रफ़ी|मोहम्मद रफी|रफी|रफ़ी|मुकेश|आशा भोसले|जगजीत सिंह|अरिजीत सिंह|किशोर दा)(?: (?:के गाने |के गीत )?(?:पसंद हैं|पसंद है|अच्छे लगते हैं))?$/u.exec(text)?.[1];
  if(singer){
   state.phase=allow?'memory':undefined;
   const humour=options.plain||messages.filter(m=>m.role==='user').slice(-3).some(m=>sensitive.test(m.content))?'':' गाना पुराना हो या नया, पसंद की कोई उम्र थोड़े ही होती है।';
   return result(`${singer} के गाने पसंद हैं आपको।${humour}`+(allow?' मन हो तो किसी गाने से जुड़ी अपनी कोई याद सुनाइए।':''));
  }
  if(/^(?:नाम याद नहीं|अभी नाम याद नहीं|याद नहीं आ रहा|अभी याद नहीं)$/u.test(text)){state.phase=undefined;return result('नाम याद आना ज़रूरी नहीं जी। जिस धुन का मन हो, उसकी बात कर सकते हैं।');}
 }
 if(state.phase==='memory'){
  const setting=/^(?:(?:मैं|हम) )?(कॉलेज|स्कूल|बचपन|जवानी) (?:में|के दिनों में)(?: (?:यह गाना|ये गाने|वो गाना))? (?:सुनता था|सुनती थी|सुनते थे|सुना करते थे)$/u.exec(text)?.[1];
  if(setting){state.phase=allow?'music-story-done':undefined;return result(`अच्छा जी, इस संगीत से ${setting} की याद जुड़ी है आपकी।`);}
 }
 if(state.phase==='music-story-done'&&yes.test(text)&&allow&&!state.walkDiscussed){state.walkDiscussed=true;state.phase='walk-answer';return result('आज दिन में टहलने का मौका मिला था? घर पर रहे हों तो उसकी भी बात कर सकते हैं।');}
 if(state.phase==='walk-answer'&&yes.test(text)){state.phase=allow?'walk-place':undefined;return result('अच्छा जी, आज टहलना हुआ आपका।'+(allow?' कहाँ गए थे—पार्क में या आसपास?':''));}
 if(state.phase==='music-offer'&&yes.test(text)){state.phase=allow?'music':undefined;state.musicOffered=true;return result(allow?musicQuestion:'जी, अपनी पसंद के संगीत की बात कर सकते हैं।');}
 const walk=/^(?:(?:मैं|आज मैं|मैं आज) )?(?:आज )?(?:टहलने|सैर पर|पार्क में टहलने) (?:गया|गई|गए)(?: था| थी| थे| हूँ| हूं)?$/u.test(text);
 if(walk){
  state.walkDiscussed=true;state.phase=allow?'walk-place':undefined;
  return result('अच्छा जी, आज टहलना हुआ आपका।'+(allow?' कहाँ गए थे—पार्क में या आसपास?':''));
 }
 if(state.phase==='walk-place'){
  const place=/^(?:(?:मैं|आज|मैं आज) )?(पार्क|बगीचे|बाग|छत|आँगन|आंगन|आसपास|घर के पास)(?: में| पर)?(?: (?:गया|गई|गए|टहला|टहली)(?: था| थी| थे)?)?$/u.exec(text)?.[1];
  if(place){
   state.phase=allow&&!state.musicOffered&&!state.musicDeclined?'music-offer':undefined;
   const locative=['छत'].includes(place)?'पर':['आसपास','घर के पास'].includes(place)?'':'में';
   return result(`अच्छा जी, ${place}${locative?' '+locative:''} टहलना हुआ।`+(state.phase?' अब मन हो तो थोड़ी संगीत की बात कर सकते हैं।':''));
  }
 }
 // An unrelated answer cancels the small pending flow. Never capture it later.
 state.phase=undefined;return result();
}

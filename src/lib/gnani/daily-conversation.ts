import type {Message} from './providers.ts';
import {listenOnlyRequested} from './reply-quality.ts';
import {asksForAnswer} from './direct-request.ts';

const restSuggestion='मन हो तो अब कुछ देर आराम से बैठ सकते हैं।';
const quietAcknowledgment='जी, आराम से।';
const ordinaryFood='(?:दाल|चावल|रोटी|सब्जी|सब्ज़ी|खिचड़ी|दही|पराठा|पराठे|फल|इडली|डोसा|पोहा|उपमा)';
const foodAnswer=new RegExp(`^(?:(?:आज|मैंने|आज मैंने|मैंने आज) )?(${ordinaryFood}(?:[, ]+(?:और )?${ordinaryFood}){0,3})(?: (?:खाए|खाया|खाई|खायी|खाए हैं|खाया है|अच्छे लगे|अच्छी लगी|अच्छा लगा|पसंद आए|पसंद आया))?$`,'u');
const healthOrDistress=/दर्द|दवा|गोली|खुराक|एलर्जी|परहेज़|परहेज|शुगर|मधुमेह|बीमार|चक्कर|उल्टी|निगल|साँस|सांस|खून|उदास|परेशान|डर|झगड़ा|मौत|मर गया|\b(?:pain|medicine|dose|allerg|diabet|dizz|vomit|swallow|breath|bleed|sad|afraid)\b/iu;

// A small application dialogue for common daily check-ins. Open questions,
// quoted examples, symptoms and anything ambiguous still go to the model.
export function dailyConversation(messages:Message[],allowQuestion=true){
 if(listenOnlyRequested(messages))return;
 const text=(messages.filter(m=>m.role==='user').at(-1)?.content??'').trim().replace(/[।.!]+$/u,'').trim();
 // An answer to our own check-in is not permission to intercept a new question,
 // a quoted example or a disclosure that needs more than this small dialogue.
 if(asksForAnswer(text)||/["“”«»]/u.test(text)||/अनुवाद|मतलब|कहानी में|उदाहरण|\b(?:translate|meaning|quote|example)\b/iu.test(text)||healthOrDistress.test(text))return;
 const replies=messages.filter(m=>m.role==='assistant').map(m=>m.content),previous=replies.at(-1)??'';
 const ask=(statement:string,question:string)=>!allowQuestion?statement:replies.some(reply=>reply.includes(question))?undefined:statement+' '+question;
 if(previous.endsWith(restSuggestion)){
  if(/^(?:हाँ|हां|जी|ठीक|ठीक है|ठीक है जी|अच्छा|yes|okay|ok)$/iu.test(text))return quietAcknowledgment;
  if(/^(?:नहीं|नही|अभी नहीं|नहीं चाहिए|रहने दीजिए|no|not now)$/iu.test(text))return 'ठीक है जी, आराम करना आपकी मर्ज़ी है।';
 }
 if(/(?:आज )?खाने में क्या अच्छा लगा\?|क्या खाया था\?/u.test(previous)){
  // A short negative here answers an enjoyment question, not whether the user
  // is hungry. Do not turn it into pantry/medicine advice or force inference.
  if(/^(?:नहीं|नही|जी नहीं|अभी नहीं|नहीं बताना|नहीं चाहिए|बात नहीं करनी|रहने दीजिए|no|no thanks|not now|not yet)$/iu.test(text))return 'कोई बात नहीं जी, खाने की बात यहीं छोड़ देते हैं।';
  if(/^(?:हाँ|हां|जी|जी हाँ|जी हां|yes)$/iu.test(text))return allowQuestion?'अच्छा जी, क्या खाया था?':'जी, खाने की बात सुन रहा हूँ।';
  const food=foodAnswer.exec(text)?.[1];
  const liked=/^(?:बहुत )?(?:अच्छा लगा|अच्छी लगी|अच्छे लगे|सब अच्छा लगा|खाना अच्छा था|खाना पसंद आया)$/u.test(text);
  if(food||liked){
   const acknowledgment=food?`अच्छा जी, खाने में ${food}।`:'अच्छा लगा कि खाना मन का था।';
   return allowQuestion&&!replies.some(reply=>reply.endsWith(restSuggestion))?acknowledgment+' '+restSuggestion:acknowledgment;
  }
  if(/^(?:कुछ खास नहीं|कुछ भी नहीं|कुछ अच्छा नहीं लगा|अच्छा नहीं लगा|पसंद नहीं आया)$/u.test(text))return 'अच्छा जी, खाना मन का नहीं था।';
 }
 if(previous.includes('आज की कौन सी बात सबसे अच्छी लगी?')){
  const invite=(statement:string,invitation:string)=>allowQuestion?statement+' '+invitation:statement;
  const talked=/^(?:आज )?(?:मैंने )?(?:(?:अपने|अपनी) )?(दोस्त|मित्र|बहन|भाई|बेटे|बेटी) से (?:फोन पर )?बात की(?: थी)?$/u.exec(text);
  if(talked)return invite(`${talked[1]} से बात करके अच्छा लगा आपको।`,'चाहें तो उस बातचीत की कोई अच्छी बात सुनाइए।');
  if(/^(?:आज )?(?:मैं )?(?:बगीचे|बाग|बालकनी) में (?:बैठा|बैठी|बैठे)(?: था| थी| थे)?$/u.test(text))return invite('वहाँ बैठना आज की अच्छी बात रही।','चाहें तो उस समय की कोई अच्छी बात सुनाइए।');
  if(/^(?:आज )?(?:मैंने )?(?:किताब|अखबार|अख़बार) पढ़(?:ा|ी)?(?: था| थी)?$/u.test(text))return invite('आज पढ़ने का समय मिला आपको।','चाहें तो पढ़ी हुई कोई बात सुनाइए।');
  if(/^(?:कुछ खास नहीं|कोई खास बात नहीं|याद नहीं|अभी याद नहीं)$/u.test(text))return 'कोई बात नहीं जी। अभी आराम से बात कर सकते हैं।';
 }
 if(previous.includes('आज क्या बात मन पर रह गई?')&&/^(?:कुछ नहीं|कोई बात नहीं|रहने दीजिए|नहीं बताना|बात नहीं करनी)$/u.test(text))return 'ठीक है जी, इस बात को छोड़ देते हैं।';
 if(/(?:सुबह|शाम).{0,10}कैसी जा रही|दिन कैसा बीता/u.test(previous)){
  if(/^(?:(?:मेरी|आज की|आज मेरी) (?:शाम|सुबह)|मेरा दिन|दिन|शाम|सुबह)?\s*(?:बहुत |काफी |ठीक ठाक |ठीक-ठाक )?(?:अच्छी|अच्छा|ठीक|बढ़िया)(?: (?:ही )?(?:है|हैं|हूँ|हूं|जा रही है|जा रहा है|बीता))?$/u.test(text))return ask('अच्छा लगा सुनकर।','आज की कौन सी बात सबसे अच्छी लगी?');
  if(/^(?:(?:मेरी|आज की) (?:शाम|सुबह)|मेरा दिन)?\s*(?:अच्छी नहीं|अच्छा नहीं|ठीक नहीं|खराब)(?: (?:है|हूँ|हूं|जा रही है|जा रहा है|बीता))?$/u.test(text))return ask('मैं सुन रहा हूँ।','आज क्या बात मन पर रह गई?');
 }
 if(/(?:दोपहर का खाना|रात का खाना|सुबह का नाश्ता) हो गया\?/u.test(previous)){
  if(/^(?:हाँ|हां|जी|जी हाँ|जी हां|yes)(?:[, ]*(?:मैंने )?(?:खाना|नाश्ता) (?:खा लिया|खा लिया है|हो गया|हो गया है))?$|^(?:खाना|नाश्ता) (?:खा लिया|हो गया)(?: है)?$/iu.test(text))return ask('अच्छा जी।','आज खाने में क्या अच्छा लगा?');
  if(/^(?:नहीं|नही|जी नहीं|अभी नहीं|अभी नही|नहीं अभी नहीं|no|not yet|nahi|nahin|abhi nahi)$/iu.test(text))return ask('ठीक है जी।','अभी खाने के लिए क्या उपलब्ध है?');
  if(/^(?:नहीं बताना|नहीं चाहिए|बात नहीं करनी|रहने दीजिए|no thanks|not now)$/iu.test(text))return 'ठीक है जी, खाने की बात यहीं छोड़ देते हैं।';
 }
 return;
}

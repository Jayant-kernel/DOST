// User/model text never directly controls performance tags.
import {medicineChangeRequest} from './reply-quality.ts';
export function expressiveSpeech(reply:string,userText:string,delivery:{plain?:boolean;lively?:boolean}={}){
 const plain=reply.replace(/<[^>]*>/g,'').trim();
 const serious=/दर्द|दवा|गोली|मौत|मृत्यु|निधन|शोक|डर|घबर|चिंता|रोना|रो रहा|अस्पताल|हिंसा|सर्दी|खांसी|खाँसी|बुखार|अकेल|उदास|बीमार|दुख|खुराक|मरना|दुर्घटना|pain|medicine|death|grief|bereav|afraid|scared|abuse|lonely|sad|dose|hurt|suicid|emergency|hospital/iu;
 if(delivery.plain||serious.test(userText+' '+plain))return plain;
 // One small reaction only when the user explicitly asks for humour.
 if(/चुटकुला|मज़ाक|मजाक|हँसाओ|हंसाओ|joke|make me laugh/iu.test(userText)&&plain.length>=20)return plain+' <giggle>';
 if(delivery.lively&&plain.length>=10)return '<excited> '+plain;
 return plain;
}
export function conversationCue(text:string,listenOnly=false):{reply:string;end?:boolean}|undefined{
 const clean=text.trim().replace(/[।.!?]+$/u,'').trim();
 if(medicineChangeRequest(clean)||/(?:dawa|khurak).{0,60}(?:double|increase|decrease|stop)/iu.test(clean))return {reply:'दवा की खुराक अपने आप न बदलें। बदलाव से पहले अपने डॉक्टर या फार्मासिस्ट से बात करें।'};
 if(/^(?:आप कौन हैं|क्या आप (?:सच में )?इंसान हैं|who are you|are you (?:a )?human)$/iu.test(clean))return {reply:'मैं साथी हूँ, एक एआई आवाज़ साथी। मैं आपकी बात सुनने और बातचीत करने के लिए हूँ।'};
 if(/^(?:बस (?:मेरी बात )?सुनिए|सवाल मत पूछिए[, ]*बस सुनिए|(?:please )?just listen|don't ask questions[, ]*just listen)$/iu.test(clean))return {reply:'जी, मैं सुन रहा हूँ। आप आराम से अपनी बात कहिए।'};
 if(/^(हम्म|हूँ|हूं|हां जी|hmm|hm|uh huh)$/iu.test(clean))return {reply:'जी, मैं सुन रहा हूँ। आराम से बताइए।'};
 if(/^(?:आप कैसे हैं|आप कैसे हो|कैसे हैं आप|aap kaise (?:hain|hai|ho)|how are you)\??$/iu.test(clean))return {reply:listenOnly?'मैं आपकी बात सुनने के लिए तैयार हूँ।':'मैं आपकी बात सुनने के लिए तैयार हूँ। आज आपके दिन की कोई अच्छी बात बताएँगे?'};
 if(/^(अलविदा|बातचीत बंद करो|बातचीत बंद करें|अभी के लिए बस|goodbye|bye|(?:मैं )?थक (?:गया|गई) हूँ[,، ]*अब बात नहीं करनी|अब बात नहीं करनी)$/iu.test(clean))return {reply:'ठीक है जी, फिर बात करेंगे। अपना ध्यान रखिए।',end:true};
 return undefined;
}

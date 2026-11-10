import {voicePersonality,type VoiceStyle} from './voice-personality.ts';
import {expressiveSpeech} from './expression.ts';
// Fixed fictional, editorial test sentences: never generated with Evon and
// never represent medical advice or a claimed completed application action.
export const voiceSamples:readonly {id:string;label:string;style:VoiceStyle;text:string;context:string;positive?:boolean}[]=[
 {id:'greeting',label:'Neutral / friendly greeting',style:'NEUTRAL_WARM',text:'नमस्ते, मैं तारा हूँ, आपकी एआई साथी। आपसे बात करके अच्छा लगा।',context:'नमस्ते।'},
 {id:'happy-news',label:'Cheerful / happy news',style:'CHEERFUL',text:'अरे वाह, आपकी कविता पत्रिका में छपी! यह तो खुशी की बात है।',context:'मेरी कविता पत्रिका में छपी, बहुत खुश हूँ।',positive:true},
 {id:'loneliness',label:'Empathetic / loneliness',style:'EMPATHETIC',text:'मेहमानों के जाने के बाद घर सूना लग रहा है। आप चाहें तो कुछ देर बात करते हैं।',context:'मेहमान चले गए, अकेलापन लग रहा है।'},
 {id:'story',label:'Storytelling / curiosity',style:'STORYTELLING',text:'बरामदे में एक छोटी चिड़िया आकर बैठी। उसके पंजे में कागज़ का एक नीला टुकड़ा था।',context:'एक काल्पनिक कहानी सुनाइए।'},
 {id:'reassurance',label:'Calm / reassurance',style:'CALM_REASSURING',text:'कोई जल्दी नहीं है। एक बात एक बार में करते हैं, आप आराम से कहिए।',context:'मुझे बात समझने के लिए थोड़ा वक्त चाहिए।'}
];
export const previewVariants=['existing','neutral','expressive'] as const;
export type PreviewVariant=typeof previewVariants[number];
export function previewSpeech(id:string,variant:PreviewVariant,speed:0.9|1=1){
 const sample=voiceSamples.find(s=>s.id===id);if(!sample||!previewVariants.includes(variant))throw Error('Unknown preview');
 const plan=voicePersonality({validatedText:sample.text,style:sample.style,preferences:{voice:'Shivani',speed,language:'hi-IN'},capabilities:{model:'timbre-v3.0',audioTags:true},enabled:variant==='expressive',sensitive:false,positiveMoment:sample.positive});
 if(variant==='existing')plan.text=expressiveSpeech(sample.text,sample.context,{plain:false,lively:false});
 return {...plan,id,variant};
}

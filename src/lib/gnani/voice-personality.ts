// Experimental post-validation delivery adapter. Not connected to live chat.
// Style names are application choices, never undocumented provider parameters.
export const voiceStyles=['NEUTRAL_WARM','CHEERFUL','EMPATHETIC','STORYTELLING','CALM_REASSURING'] as const;
export type VoiceStyle=typeof voiceStyles[number];
export type VoicePreferences={voice:string;speed:0.9|1;language:'hi-IN'|'hi-en';plain?:boolean};
export type VoiceCapabilities={model:'timbre-v2.5'|'timbre-v3.0';audioTags:boolean};
const sensitive=/दवा|दवाई|गोली|खुराक|सीने|साँस|सांस|आपात|आत्महत्या|सहमति|अनुमति|निजी|गोपनीय|सहेज|इतिहास|मिटा|डॉक्टर|फार्मासिस्ट|दर्द|medicine|medication|dose|emergency|consent|privacy|retention|delete|suicid|chest pain/iu;
export function voicePersonality(input:{validatedText:string;style?:VoiceStyle;preferences:VoicePreferences;capabilities:VoiceCapabilities;enabled?:boolean;sensitive?:boolean;positiveMoment?:boolean}){
 const {preferences,capabilities}=input;
 // Tags in validated language-model output are still untrusted synthesis input.
 const spokenText=input.validatedText.replace(/<[^>]*>/gu,'').replace(/[<>]/gu,'').trim();
 if(!spokenText||spokenText.length>4000)throw Error('Invalid approved speech');
 if(!voiceStyles.includes(input.style??'NEUTRAL_WARM'))throw Error('Invalid delivery style');
 if(![0.9,1].includes(preferences.speed)||!['hi-IN','hi-en'].includes(preferences.language))throw Error('Invalid voice preference');
 const requestedStyle=input.style??'NEUTRAL_WARM';
 const neutral=!input.enabled||preferences.plain||input.sensitive!==false||sensitive.test(spokenText)||!capabilities.audioTags||capabilities.model!=='timbre-v3.0';
 let text=spokenText,tag:'excited'|'pauses'|undefined;
 if(!neutral){
  if(requestedStyle==='CHEERFUL'&&input.positiveMoment){tag='excited';text='<excited> '+spokenText;}
  else if(['EMPATHETIC','STORYTELLING','CALM_REASSURING'].includes(requestedStyle)){
   // One documented silence at an existing sentence boundary. No new content,
   // invented pause duration, forced laughter, voice change or speed override.
   const boundary=/[।.!?]\s+(?=\S)/u.exec(spokenText);
   if(boundary){tag='pauses';const at=boundary.index+boundary[0].length;text=spokenText.slice(0,at)+'<pauses> '+spokenText.slice(at);}
  }
 }
 return {spokenText,text,styleApplied:tag?requestedStyle:'NEUTRAL_WARM' as VoiceStyle,tags:tag?[tag]:[],...preferences,model:capabilities.model,experimental:Boolean(input.enabled)};
}

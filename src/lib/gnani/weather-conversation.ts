// Public weather data only. No profile, transcript, credentials or device location
// is sent: geocoding receives just the city/state supplied for this request.
// https://open-meteo.com/en/docs/geocoding-api and /en/docs
export type WeatherPlace={name:string;region:string;district?:string;latitude:number;longitude:number};
export type WeatherState={awaitingPlace?:boolean;place?:WeatherPlace;candidates?:WeatherPlace[]};
const askPlace='मौसम देखने के लिए अपना शहर और राज्य बताएँगे? सिर्फ़ जगह का नाम मौसम सेवा को भेजा जाएगा।';
const unavailable='अभी ताज़ा मौसम की जानकारी नहीं मिल रही। मौसम अच्छा है, ऐसा अंदाज़ा नहीं लगाऊँगा।';
const aliases:Record<string,string>={'रामगढ़':'Ramgarh','झारखंड':'Jharkhand','राजस्थान':'Rajasthan','जयपुर':'Jaipur','दिल्ली':'Delhi','नई दिल्ली':'New Delhi','मुंबई':'Mumbai','महाराष्ट्र':'Maharashtra','लखनऊ':'Lucknow','उत्तर प्रदेश':'Uttar Pradesh','भोपाल':'Bhopal','मध्य प्रदेश':'Madhya Pradesh','कोलकाता':'Kolkata','पश्चिम बंगाल':'West Bengal','बेंगलुरु':'Bengaluru','कर्नाटक':'Karnataka'};
const fold=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f\u093c]/gu,'').toLowerCase().trim();
function locationKey(s:string){const key=fold(s.replace(/(?:ज़िला|जिला|district)/giu,'').trim());const alias=Object.entries(aliases).find(([from])=>fold(from)===key)?.[1];return fold(alias??key);}
function queryPlace(text:string){
 let clean=text.replace(/^(?:मेरा शहर|मेरे शहर का नाम|मैं) /u,'').replace(/(?: में हूँ| में हूं| है)$/u,'').trim();
 if(!/^[\p{L}\p{M} ,.-]{2,70}$/u.test(clean)||clean.split(/\s+/u).length>6||/नहीं|दवा|दर्द|भूख|पसंद|गाना|खाना|सुनिए|शहर नहीं|पता नहीं/u.test(clean))return;
 for(const [from,to] of Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length))clean=clean.replaceAll(from,to);
 // Natural Hindi often omits the comma between city and state.
 for(const region of ['Jharkhand','Rajasthan','Maharashtra','Uttar Pradesh','Madhya Pradesh','West Bengal','Karnataka'])if(clean.endsWith(' '+region)&&!clean.includes(','))clean=clean.slice(0,-region.length).trim()+', '+region;
 return clean;
}
async function json(url:URL,transport:typeof fetch,signal:AbortSignal){
 const r=await transport(url,{signal,cache:'no-store'});if(!r.ok)throw Error('Weather unavailable');
 const reader=r.body?.getReader();if(!reader)throw Error('Weather unavailable');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>64000)throw Error('Weather response too large');chunks.push(value);}signal.throwIfAborted();}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const bytes=new Uint8Array(size);let n=0;for(const chunk of chunks){bytes.set(chunk,n);n+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function weatherConversation(text:string,previous:WeatherState={},signal:AbortSignal,transport:typeof fetch=fetch,now=Date.now()){
 const clean=text.normalize('NFKC').trim().replace(/[।.!?]+$/u,'').trim();
 const state:WeatherState={...previous};const result=(reply?:string)=>({state,reply});
 signal.throwIfAborted();
 if(/["“”«»]/u.test(clean)||/मतलब|परिभाषा|अनुवाद|उदाहरण|\b(?:meaning|define|translate|example|quote)\b/iu.test(clean)){state.awaitingPlace=false;state.candidates=undefined;return result();}
 if(/^(?:नहीं|अभी नहीं|रहने दीजिए|मौसम नहीं जानना|जगह नहीं बतानी|नहीं बताना)$/u.test(clean)){const pending=state.awaitingPlace;state.awaitingPlace=false;state.candidates=undefined;return result(pending?'ठीक है जी, जगह बताना ज़रूरी नहीं है।':undefined);}
 const cityMention=/^(.+?) (?:में|का) (?:मौसम कैसा है|तापमान कितना है)$/u.exec(clean)?.[1];
 const cityRequest=cityMention&&!/^(?:मेरे शहर|यहाँ|अभी|आज|मेरे यहाँ)$/u.test(cityMention)?cityMention:undefined;
 const requested=Boolean(cityRequest)||/^(?:(?:अभी|आज|आज का|यहाँ|मेरे यहाँ|मेरे शहर में) )?(?:मौसम (?:कैसा है|बताइए|बताओ)|तापमान कितना है|बारिश हो रही है|क्या बारिश हो रही है)$/u.test(clean);
 const named=/^(?:मेरा शहर|मेरे शहर का नाम) (.+?)(?: है)?$/u.exec(clean);
 const pending=state.awaitingPlace;state.awaitingPlace=false;
 if(!requested&&!named&&!pending){state.candidates=undefined;return result();}
 let query=cityRequest?queryPlace(cityRequest):named&&pending?queryPlace(named[1]):pending?queryPlace(clean):undefined;
 if(pending&&previous.candidates?.length){
  const matches=previous.candidates.filter(p=>p.district&&locationKey(p.district)===locationKey(clean));
  if(matches.length===1){state.place=matches[0];state.candidates=undefined;query=undefined;}
  else if(matches.length>1){state.candidates=matches;state.awaitingPlace=true;return result('इस ज़िले में भी एक से ज़्यादा जगहें मिलीं। मौसम के लिए पास का कोई बड़ा शहर बता सकते हैं।');}
 }
 if(!requested&&!query&&!(pending&&state.place)){state.candidates=undefined;return result();} // An unrelated reply cancels the prompt.
 if(!query&&!state.place){state.awaitingPlace=true;return result(askPlace);}
 try{
  const combined=AbortSignal.any([signal,AbortSignal.timeout(4000)]);
  if(query){
   state.place=undefined;
   const url=new URL('https://geocoding-api.open-meteo.com/v1/search');url.search=new URLSearchParams({name:query,count:'10',language:'hi',countryCode:'IN'}).toString();
   state.candidates=undefined;const data=await json(url,transport,combined);
   const places=(Array.isArray(data.results)?data.results:[]).filter((p:WeatherPlace&{country_code?:string})=>p.country_code==='IN'&&typeof p.name==='string'&&p.name.length<=80&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180);
   const safePlace=(p:WeatherPlace&{admin1?:string;admin2?:string}):WeatherPlace=>({name:p.name,region:typeof p.admin1==='string'?p.admin1.slice(0,80):'',district:typeof p.admin2==='string'?p.admin2.slice(0,80):undefined,latitude:p.latitude,longitude:p.longitude});
   if(places.length!==1){state.place=undefined;state.awaitingPlace=true;state.candidates=places.map(safePlace);return result(places.length?'इस नाम की एक से ज़्यादा जगहें मिलीं। आपका ज़िला कौन सा है?':'जगह साफ़ नहीं मिली। शहर और राज्य का नाम फिर से बता सकते हैं।');}
   state.place=safePlace(places[0]);
  }
  const p=state.place!;const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(p.latitude),longitude:String(p.longitude),current:'temperature_2m,precipitation,is_day',timeformat:'unixtime',forecast_days:'1'}).toString();
  const data=await json(url,transport,combined),c=data.current;
  if(!c||!Number.isFinite(c.time)||Math.abs(now-c.time*1000)>90*60*1000||!Number.isFinite(c.temperature_2m)||c.temperature_2m< -50||c.temperature_2m>60||!Number.isFinite(c.precipitation)||c.precipitation<0||![0,1].includes(c.is_day)||data.current_units?.temperature_2m!=='°C')throw Error('Weather unavailable');
  const rain=c.precipitation>0?'इस समय वर्षा का संकेत है।':'इस समय बारिश का संकेत नहीं है।';
  return result(`मौसम सेवा के अनुसार, ${p.name}${p.region?', '+p.region:''} में अभी लगभग ${Math.round(c.temperature_2m)} डिग्री सेल्सियस है। ${rain} ${c.is_day===0?'वहाँ अभी रात है।':''}`.trim());
 }catch{signal.throwIfAborted();return result(unavailable);}
}

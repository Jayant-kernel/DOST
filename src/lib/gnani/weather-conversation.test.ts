import {test} from 'node:test';import assert from 'node:assert/strict';
import {weatherConversation} from './weather-conversation.ts';
const now=1800000000000,signal=new AbortController().signal;
const place={name:'Ramgarh',region:'Jharkhand',latitude:23.6,longitude:85.5};
const weather={current:{time:now/1000,temperature_2m:24.2,precipitation:0,is_day:0},current_units:{temperature_2m:'°C'}};
test('weather asks for a city instead of assuming location or current conditions',async()=>{
 let calls=0;const r=await weatherConversation('मौसम कैसा है?',{},signal,async()=>{calls++;return Response.json({});},now);
 assert.equal(calls,0);assert.equal(r.state.awaitingPlace,true);assert.match(r.reply!,/शहर और राज्य/);assert.match(r.reply!,/मौसम सेवा/);
});
test('city/state lookup sends only the chosen place, then grounds current weather in fresh data',async()=>{
 const urls:string[]=[];
 const r=await weatherConversation('रामगढ़ झारखंड',{awaitingPlace:true},signal,async url=>{urls.push(String(url));return Response.json(urls.length===1?{results:[{...place,admin1:'Jharkhand',country_code:'IN'}]}:weather);},now);
 assert.equal(urls.length,2);assert.equal(new URL(urls[0]).searchParams.get('name'),'Ramgarh, Jharkhand');assert.equal(new URL(urls[0]).searchParams.get('countryCode'),'IN');
 assert.match(r.reply!,/24 डिग्री/);assert.match(r.reply!,/अभी रात/);assert.doesNotMatch(r.reply!,/टहलने|बाहर जाइए|सुरक्षित|मौसम अच्छा/);
 assert.equal(r.state.place?.latitude,23.6);
});
test('ambiguous cities need clarification and never trigger a forecast request',async()=>{
 let calls=0;const r=await weatherConversation('Ramgarh',{awaitingPlace:true},signal,async()=>{calls++;return Response.json({results:[{...place,country_code:'IN'},{...place,country_code:'IN',latitude:24}]});},now);
 assert.equal(calls,1);assert.equal(r.state.place,undefined);assert.match(r.reply!,/एक से ज़्यादा/);
});
test('a district disambiguates Ramgarh without asking for an already supplied state again',async()=>{
 const candidates=[{...place,district:'रामगढ़'},{...place,district:'दुमका',latitude:24.5}];let calls=0;
 const r=await weatherConversation('रामगढ़ जिला',{awaitingPlace:true,candidates},signal,async url=>{calls++;assert.equal(new URL(String(url)).hostname,'api.open-meteo.com');return Response.json(weather);},now);
 assert.equal(calls,1);assert.equal(r.state.place?.latitude,23.6);assert.equal(r.state.candidates,undefined);assert.match(r.reply!,/24 डिग्री/);
});
test('generic my-city requests do not geocode personal pronouns; an explicit pending city declaration does',async()=>{
 for(const text of ['मेरे शहर में मौसम कैसा है','आज का मौसम कैसा है']){
  let calls=0;const r=await weatherConversation(text,{},signal,async()=>{calls++;return Response.json({});},now);assert.equal(calls,0);assert.equal(r.state.awaitingPlace,true);
 }
 let calls=0;await weatherConversation('मेरा शहर जयपुर राजस्थान है',{awaitingPlace:true},signal,async url=>{calls++;assert.equal(new URL(String(url)).searchParams.get('name'),'Jaipur, Rajasthan');return Response.json({results:[]});},now);assert.equal(calls,1);
});
test('stale, malformed or unavailable weather is never presented as fresh or safe for walking',async()=>{
 for(const data of [{...weather,current:{...weather.current,time:now/1000-7200}},{...weather,current:{...weather.current,temperature_2m:NaN}},{error:true}]){
  const r=await weatherConversation('आज मौसम कैसा है',{place},signal,async()=>Response.json(data),now);assert.match(r.reply!,/जानकारी नहीं मिल रही/);assert.doesNotMatch(r.reply!,/24 डिग्री|टहलने जाइए/);
 }
});
test('refusal, definitions and topic changes cancel the city prompt without external disclosure',async()=>{
 for(const text of ['नहीं बताना','मौसम का मतलब क्या है?','मुझे गाने पसंद हैं','सीने में दर्द है','“रामगढ़”']){
  let calls=0;const r=await weatherConversation(text,{awaitingPlace:true},signal,async()=>{calls++;return Response.json({});},now);assert.equal(calls,0,text);assert.equal(r.state.awaitingPlace,false);
 }
});
test('Stop cancels weather lookup rather than producing an unavailable-weather reply',async()=>{
 const controller=new AbortController();const promise=weatherConversation('मौसम कैसा है',{place},controller.signal,async()=>{controller.abort();throw Error('cancelled');},now);
 await assert.rejects(promise);
});

// Synthetic browser-only regression: no microphone, provider or saved profile.
window.__flowFixture={turns:0,starts:0};
const realFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(url.pathname==='/api/profile')return Response.json({preferences:{},historyEnabled:false});
 if(url.pathname!=='/api/voice')return realFetch(input,init);
 if(url.searchParams.has('start')){window.__flowFixture.starts++;return Response.json({ready:true});}
 if(url.searchParams.has('stop')||url.searchParams.has('interrupt'))return new Response(null,{status:204});
 const headers={'Content-Type':'application/octet-stream'};
 if(!url.searchParams.has('welcome')){window.__flowFixture.turns++;if(window.__flowFixture.turns===1)headers['X-Saathi-Recovery']='1';else headers['X-Saathi-End']='1';}
 return new Response(new Uint8Array(16000),{headers});
};
navigator.mediaDevices.getUserMedia=async()=>{
 const context=new AudioContext(),oscillator=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination();
 oscillator.connect(gain);gain.connect(destination);oscillator.start();await context.resume();
 const began=performance.now();const tick=setInterval(()=>{gain.gain.setValueAtTime((performance.now()-began)%4000<1000?0.05:0,context.currentTime);},30);
 const stream=destination.stream;
 for(const track of stream.getTracks()){const stop=track.stop.bind(track);let stopped=false;track.stop=()=>{if(stopped)return;stopped=true;clearInterval(tick);void context.close().catch(()=>{});stop();};}
 return stream;
};

const previousFetch=window.fetch;window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(url.pathname==='/api/voice/prepare')return Response.json({ready:true});
 const r=await previousFetch(input,init);
 if(url.pathname==='/api/voice'&&!url.search){
  if(new URL(location.href).searchParams.get('recognitionFixture')==='pause'||window.__flowFixture.turns===1)return Response.json({code:'speech_not_detected',error:'No clear speech detected'},{status:422});
  const headers=new Headers(r.headers);if(window.__flowFixture.turns<3)headers.delete('X-Saathi-End');return new Response(new Uint8Array(3200),{headers});
 }return r;
};

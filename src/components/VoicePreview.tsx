'use client';
import {useEffect,useRef,useState} from 'react';
import {voiceSamples,type PreviewVariant} from '../lib/gnani/voice-preview';
import {StreamingSpeech} from './streaming-speech';
import styles from './VoicePreview.module.css';
type Clip={id:string;variant:PreviewVariant;label:string};
const dimensions=['Hindi clarity','Warmth','Naturalness','Expression fit','Voice consistency','Artificial expression'] as const;
export function VoicePreview(){
 const [clips,setClips]=useState<Clip[]>([]),[reveal,setReveal]=useState(false),[ratings,setRatings]=useState<Record<string,Record<string,string>>>({});
 const [consent,setConsent]=useState(false),[reviewer,setReviewer]=useState(''),[enabled,setEnabled]=useState(false),[sample,setSample]=useState('greeting'),[variant,setVariant]=useState<PreviewVariant>('neutral'),[speed,setSpeed]=useState<0.9|1>(1);
 const [status,setStatus]=useState('Loading saved previews…'),[busy,setBusy]=useState(false),[download,setDownload]=useState<string>(),[metrics,setMetrics]=useState<string>();
 const active=useRef<{controller:AbortController;player:StreamingSpeech}|undefined>(undefined),urls=useRef<string[]>([]),section=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/voice/preview',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
   const available=(data.rows??[]).filter((row:{success?:boolean})=>row.success);
   const list:Clip[]=[];
   for(const s of voiceSamples){
    const pair:PreviewVariant[]=['neutral','expressive'];
    if(crypto.getRandomValues(new Uint8Array(1))[0]%2)pair.reverse();
    pair.forEach((v,i)=>{if(available.some((r:{id:string;variant:string})=>r.id===s.id&&r.variant===v))list.push({id:s.id,variant:v,label:'Sample '+(i+1)});});
   }
   setClips(list);setStatus(list.length?'Saved audio is ready. Listen at a comfortable volume.':'No saved audio yet. Generate one fixed preview below.');
  }).catch(()=>{if(!controller.signal.aborted)setStatus('Saved previews unavailable. You can try a fixed preview below.');});
  return()=>{controller.abort();active.current?.controller.abort();active.current?.player.stop();urls.current.forEach(url=>URL.revokeObjectURL(url));};
 },[]);
 const stop=()=>{active.current?.controller.abort();active.current?.player.stop();section.current?.querySelectorAll('audio').forEach(audio=>{audio.pause();audio.currentTime=0;});setStatus('Playback stopped.');};
 const generate=async()=>{
  if(busy)return;stop();setBusy(true);setDownload(undefined);setMetrics(undefined);setStatus('Preparing the selected fixed sentence…');
  const controller=new AbortController(),player=new StreamingSpeech();active.current={controller,player};const began=performance.now();let first:number|undefined;
  try{
   const response=await fetch('/api/voice/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:sample,variant,speed,expressiveEnabled:enabled}),signal:controller.signal});
   if(!response.ok){const body=await response.json();throw Error(body.error??'Voice preview unavailable');}
   const wav=await player.play(response,controller.signal,()=>{if(first===undefined){first=Math.round(performance.now()-began);setStatus('Playing preview…');}});
   const url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));urls.current.push(url);setDownload(url);setMetrics(`First scheduled audio: ${first??'unavailable'} ms · playback completed: ${Math.round(performance.now()-began)} ms.`);setStatus('Preview finished.');
  }catch(error){setStatus(controller.signal.aborted?'Playback stopped.':error instanceof Error?error.message:'Voice preview unavailable.');}
  finally{player.stop();if(active.current?.controller===controller)active.current=undefined;setBusy(false);}
 };
 const exportRatings=()=>{
  const data={version:1,reviewerCode:reviewer,consented:consent,reviewerType:'human-self-reported',independentHumanVerified:false,language:'Hindi',date:new Date().toISOString(),revealedConditions:reveal,sampleOrder:clips,ratings,scale:'1 low to5 high; Artificial expression:1 none to5 very artificial. Empty means NOT RATED.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));urls.current.push(url);const a=document.createElement('a');a.href=url;a.download='tara-listener-ratings.json';a.click();
 };
 return <main className={styles.page} ref={section}>
  <a href="/">← Back to Saathi</a><p className={styles.eyebrow}>TARA · VOICE PREVIEW</p>
  <h1>A familiar voice, five ways.</h1><p>Compare the same Hindi words in Shivani’s voice. This separate experiment does not change your conversations.</p>
  <p><a href="/voice-preview?study=1">हिन्दी में बिना लेबल वाली सुनने की जाँच शुरू करें · Blinded listener study</a></p>
  <p role="status" aria-live="polite">{status}</p><button className={styles.stop} onClick={stop}>Stop all audio</button>
  <section aria-labelledby="saved-heading"><h2 id="saved-heading">Listen and compare</h2>
   <p>Each pair is shuffled. No microphone or personal conversation is recorded. The greeting pair is intentionally identical; other pairs test one delivery cue.</p>
   <label><input type="checkbox" checked={reveal} onChange={e=>setReveal(e.target.checked)} /> Reveal delivery labels</label>
   {voiceSamples.map(s=><fieldset key={s.id} className={styles.sample}><legend>{s.label}</legend><p lang="hi">{s.text}</p>
    {clips.filter(c=>c.id===s.id).map(clip=>{const key=clip.id+'-'+clip.variant;return <div className={styles.clip} key={key}>
     <h3>{clip.label}{reveal?' · '+clip.variant:''}</h3>
     <audio controls preload="none" aria-label={s.label+' '+clip.label} src={`/api/voice/preview?sample=${clip.id}&variant=${clip.variant}`} onPlay={e=>section.current?.querySelectorAll('audio').forEach(audio=>{if(audio!==e.currentTarget)audio.pause();})} />
     <details><summary>Rate this sample</summary><p>1 = low, 5 = high. Artificial expression: 1 = none, 5 = very artificial. Leave unjudged items blank.</p>
      <div className={styles.ratings}>{dimensions.map(d=><label key={d}>{d}<select aria-label={s.label+' '+clip.label+' '+d} value={ratings[key]?.[d]??''} onChange={e=>setRatings(previous=>({...previous,[key]:{...previous[key],[d]:e.target.value}}))}><option value="">Not rated</option>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label>)}</div>
     </details>
    </div>;})}
   </fieldset>)}
   <label>Reviewer code (use a nickname)<input value={reviewer} maxLength={40} onChange={e=>setReviewer(e.target.value)} /></label>
   <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} /> I understand these optional ratings will be downloaded to my device, and I agree to take part.</label>
   <button disabled={!consent||!reviewer.trim()||!Object.values(ratings).some(row=>Object.values(row).some(Boolean))} onClick={exportRatings}>Download my ratings</button>
  </section>
  <section aria-labelledby="custom-heading"><h2 id="custom-heading">Try a fixed preview</h2><p>This button uses the existing Gnani account’s TTS credits. Saved comparisons above do not create new synthesis requests.</p>
   <label>Sentence<select value={sample} disabled={busy} onChange={e=>setSample(e.target.value)}>{voiceSamples.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <label>Delivery<select value={variant} disabled={busy} onChange={e=>setVariant(e.target.value as PreviewVariant)}><option value="existing">Existing Tara settings</option><option value="neutral">Neutral</option><option value="expressive">Experimental expression</option></select></label>
   <label>Speaking speed<select value={speed} disabled={busy} onChange={e=>setSpeed(Number(e.target.value) as 0.9|1)}><option value="1">Normal</option><option value="0.9">Slower</option></select></label>
   <label><input type="checkbox" disabled={busy} checked={enabled} onChange={e=>setEnabled(e.target.checked)} /> Enable experimental expression for this preview only</label>
   <button disabled={busy||variant==='expressive'&&!enabled} onClick={()=>void generate()}>Generate and play preview</button>
   {metrics&&<p>{metrics} These are browser timings, not a human listening judgment.</p>}{download&&<a download="tara-preview.wav" href={download}>Download this preview</a>}
  </section><p>Voice comfort and pronunciation require listener review. This prototype has no dementia-care qualification.</p>
 </main>;
}

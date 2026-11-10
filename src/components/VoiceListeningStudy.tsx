'use client';
import {useEffect,useRef,useState} from 'react';
import styles from './VoiceListeningStudy.module.css';
type Study={id:string;technicalOnly:boolean;scenarios:{id:string;text:string;clips:{token:string;recording:string}[]}[]};
const dimensions=[['naturalness','How natural did the voice sound?'],['warmth','How warm and friendly did it feel?'],['cheerfulness','How cheerful did it sound?'],['pronunciation','How clear was the Hindi pronunciation?'],['comfort','How comfortable was it to listen to?'],['appropriateness','How appropriate was the voice for this situation?']] as const;
const choices=[['recording-1','Recording 1'],['recording-2','Recording 2'],['recording-3','Recording 3'],['tie','Equally preferred'],['no-preference','No preference'],['unsure','Not sure']] as const;
export function VoiceListeningStudy(){
 const [study,setStudy]=useState<Study>(),[consent,setConsent]=useState(false),[hindi,setHindi]=useState(false),[adult,setAdult]=useState(false),[age,setAge]=useState('not-stated');
 const [step,setStep]=useState(0),[heard,setHeard]=useState<Record<string,boolean>>({}),[ratings,setRatings]=useState<Record<string,Record<string,string>>>({}),[preferences,setPreferences]=useState<Record<string,string>>({}),[overall,setOverall]=useState(''),[feedback,setFeedback]=useState(''),[concern,setConcern]=useState('unsure'),[details,setDetails]=useState('');
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[finished,setFinished]=useState(false);
 const root=useRef<HTMLElement>(null),controller=useRef<AbortController|undefined>(undefined),urls=useRef<string[]>([]);
 useEffect(()=>()=>{controller.current?.abort();urls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
 const stop=()=>root.current?.querySelectorAll('audio').forEach(a=>a.pause());
 const post=async(data:unknown)=>{controller.current?.abort();const c=new AbortController();controller.current=c;const r=await fetch('/api/voice/study',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:c.signal});const result=await r.json();if(!r.ok)throw Error(result.error??'Study unavailable');return result;};
 const start=async(technical=false)=>{setBusy(true);setStatus('Getting the recordings ready…');try{const s=await post({action:'start',mode:technical?'technical-check':'listener',consented:consent,hindiComfortable:hindi,adult,ageBand:age});setStudy(s);setStatus('Choose a comfortable volume. There is no right or wrong preference.');}catch(e){setStatus(e instanceof Error?e.message:'Study unavailable');}finally{setBusy(false);}};
 const withdraw=async()=>{stop();setBusy(true);let serverClosed=true;try{await post({action:'withdraw'});}catch{serverClosed=false;}finally{setStudy(undefined);setRatings({});setHeard({});setPreferences({});setFeedback('');setDetails('');setOverall('');setConcern('unsure');setStep(0);setConsent(false);setFinished(false);setBusy(false);setStatus('You have left the study. Answers on this page have been cleared. Previously downloaded files may remain on your device.'+(serverClosed?'':' The server session could not be confirmed closed; it expires after 90 minutes.'));}};
 const exportResult=async()=>{stop();setBusy(true);try{
  const submission={ratings:study!.scenarios.flatMap(s=>s.clips.map(c=>({token:c.token,heard:heard[c.token]===true,scores:Object.fromEntries(dimensions.map(([d])=>[d,Number(ratings[c.token]?.[d])]))}))),preferences:study!.scenarios.map(s=>({scenario:s.id,choice:preferences[s.id]})),overall,feedback,criticalConcern:concern,concernDetails:details};
  const result=await post({action:'export',submission});const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));urls.current.push(url);const a=document.createElement('a');a.href=url;a.download=`tara-study-${study!.id}.json`;a.click();setFinished(true);setStatus('Thank you. Your answers have been downloaded. Sharing the file is your choice.');
 }catch(e){setStatus(e instanceof Error?e.message:'Export unavailable');}finally{setBusy(false);}};
 const current=study?.scenarios[step],complete=current&&current.clips.every(c=>heard[c.token]&&dimensions.every(([d])=>ratings[c.token]?.[d]))&&Boolean(preferences[current.id]);
 return <main ref={root} className={styles.page} lang="en">
  <nav className={styles.nav} aria-label="Main navigation"><a className={styles.brand} href="/">saathi<span>YOUR VOICE COMPANION</span></a><span className={styles.navNote}>VOICE LISTENING STUDIO</span><a className={styles.talkLink} href="/">Start a conversation <span aria-hidden="true">↗</span></a></nav>
  <header className={styles.hero}>
   <div><p className={styles.eyebrow}>A voice. A little company.</p><h1>Listen. Feel.<br/><span>Tell us what you think.</span></h1><p className={styles.intro}>How does Tara’s voice feel to you? Listen to a few short recordings and share your thoughts. There is no right or wrong preference.</p><div className={styles.facts}><span>15–25 minutes</span><span>5 short situations</span><span>Take a break anytime</span></div></div>
   <aside className={styles.companionCard}><div className={styles.orb} aria-hidden="true"><div className={styles.wave}>{[1,2,3,4,5,6,7].map(n=><i key={n}/>)}</div></div><p className={styles.cardTitle}>Want to talk instead?</p><p>This page is for listening to recordings. Open the main page to have a conversation.</p><a className={styles.primaryLink} href="/">Talk to Saathi <span aria-hidden="true">→</span></a></aside>
  </header>
  <p className={styles.status} role="status" aria-live="polite">{status}</p>
  {!study?<section className={styles.consentCard} aria-label="Consent">
   <div className={styles.sectionHeading}><span className={styles.stepNumber}>01</span><div><p className={styles.eyebrow}>Before you begin</p><h2>Your consent. Your comfort.</h2></div></div>
   <p>This is a short voice evaluation, not treatment or a memory test. Your voice will not be recorded. We do not ask for your name or contact details. Your answers stay temporarily on this page; at the end, you can download a file to your device. Sharing that file with the organizer is optional. Leaving the study clears unfinished answers from this page.</p>
   <label><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)} /> I am 18 years old or older.</label>
   <label><input type="checkbox" checked={hindi} onChange={e=>setHindi(e.target.checked)} /> I can comfortably understand Hindi.</label>
   <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} /> I understand the information above and voluntarily agree to take part.</label>
   <label>Age group (optional)<select value={age} onChange={e=>setAge(e.target.value)}><option value="not-stated">Prefer not to say</option><option value="under60">18–59</option><option value="60plus">60 or older</option></select></label>
   <div className={styles.startRow}><button className={styles.primaryButton} disabled={busy||!adult||!hindi||!consent} onClick={()=>void start()}>{busy?'Getting ready…':'Start listening →'}</button><p>{adult&&hindi&&consent?'Ready? You can start listening.':'Select the three boxes above to start listening.'}</p></div>
   <details><summary>Organizer: technical check</summary><p>This mode does not count as human evaluation.</p><button disabled={busy} onClick={()=>void start(true)}>Start technical check only</button></details>
  </section>:<>
   {study.technicalOnly&&<p><strong>Technical check only — not human evaluation.</strong></p>}
   <button className={styles.stop} onClick={stop}>Pause audio / take a break</button>{' '}<button disabled={busy} onClick={()=>void withdraw()}>Leave study and clear page answers</button>
   {!finished&&current&&<section key={current.id} aria-label={`Situation ${step+1}`}>
    <div className={styles.progress} aria-label={`Situation ${step+1} of 5`}>{[0,1,2,3,4].map(n=><span key={n} className={n<=step?styles.activeStep:undefined}/>)}</div><h2>Situation {step+1} / 5</h2><p className={styles.scenarioText} lang="hi">{current.text}</p><p>1 = very low, 5 = very good / high. More cheerfulness is not always appropriate; rate each quality for the situation. Listen to each recording in full before rating it.</p>
    {current.clips.map(c=><fieldset className={styles.sample} key={c.token}>
     <legend>{choices.find(([id])=>id===c.recording)?.[1]}</legend>
     <audio controls preload="none" aria-label={`${choices.find(([id])=>id===c.recording)?.[1]}, situation ${step+1}`} src={`/api/voice/study?clip=${c.token}`} onEnded={()=>setHeard(p=>({...p,[c.token]:true}))} onError={()=>setStatus('Recording could not play. Ask the organizer for help; please do not guess a rating.')} onPlay={e=>root.current?.querySelectorAll('audio').forEach(a=>{if(a!==e.currentTarget)a.pause();})} />
     <p>{heard[c.token]?'Recording completed — listen again if you like.':'Listen to the full recording first.'}</p>
     <div className={styles.ratings}>{dimensions.map(([d,label])=><label key={d}>{label}<select disabled={!heard[c.token]} value={ratings[c.token]?.[d]??''} onChange={e=>setRatings(p=>({...p,[c.token]:{...p[c.token],[d]:e.target.value}}))}><option value="">Not rated yet</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}</div>
    </fieldset>)}
    <label>Which recording did you prefer in this situation?<select value={preferences[current.id]??''} onChange={e=>setPreferences(p=>({...p,[current.id]:e.target.value}))}><option value="">Choose</option>{choices.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {step>0&&<button onClick={()=>{stop();setStep(s=>s-1);}}>Previous situation</button>}{' '}{step<4&&<button disabled={!complete} onClick={()=>{stop();setStep(s=>s+1);setStatus('The next situation is ready.');}}>Next situation</button>}
    {step===4&&<>
     <label>Across all situations, which recording did you prefer overall?<select value={overall} onChange={e=>setOverall(e.target.value)}><option value="">Choose</option>{choices.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
     <label>Did any recording contain dangerous advice, a serious factual error, or feel unsafe?<select value={concern} onChange={e=>setConcern(e.target.value)}><option value="unsure">Not sure</option><option value="none-observed">None observed</option><option value="concern">Yes, I have a concern</option></select></label>
     <label>Describe your concern (required if you chose yes)<textarea maxLength={1000} value={details} onChange={e=>setDetails(e.target.value)} /></label>
     <label>Anything else? (Optional; please do not include your name, private details or health information)<textarea maxLength={2000} value={feedback} onChange={e=>setFeedback(e.target.value)} /></label>
     <button className={styles.primaryButton} disabled={busy||!complete||!overall||concern==='concern'&&!details.trim()} onClick={()=>void exportResult()}>Download your answers</button>
    </>}
   </section>}
  </>}
  <footer className={styles.footer}><span>saathi · A conversation. A little company.</span><span>A better voice begins with your feedback.</span></footer>
 </main>;
}

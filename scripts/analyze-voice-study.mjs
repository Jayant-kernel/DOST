import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dimensions=['naturalness','warmth','cheerfulness','pronunciation','comfort','appropriateness'];
const conditions=['existing','neutral','expressive'];
const scenarios=['greeting','happy-news','loneliness','story','reassurance'];
const mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
function wilson(w,n){if(!n)return null;const z=1.96,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [c-h,c+h];}
// One participant is the analysis unit, never fifteen independent votes.
export function analyzeVoiceStudy(records,verification={verifiedSessionIds:[],safetyReviewComplete:false}){
 const seen=new Set(),included=[],excluded=[];
 for(const r of records){
  if(!r.sessionId||seen.has(r.sessionId))throw Error('Missing or duplicate session ID');seen.add(r.sessionId);
  if(r.version!=='tara-listening-1')throw Error('Unsupported study version');
  if(r.technicalOnly){excluded.push({id:r.sessionId,reason:'technical-check'});continue;}
  if(!verification.verifiedSessionIds.includes(r.sessionId)){excluded.push({id:r.sessionId,reason:'Organizer has not verified unique eligible consenting listener'});continue;}
  if(!r.consented||!r.hindiComfortable||!r.adult||!r.complete||r.voice!=='Shivani'||r.model!=='timbre-v3.0'||r.speed!==1)throw Error('Ineligible or incompatible export');
  if(r.ratings?.length!==15||r.preferences?.length!==5||new Set(r.preferences.map(p=>p.scenario)).size!==5)throw Error('Incomplete export');
  if(Object.keys(r.analysisKey??{}).length!==3||new Set(Object.values(r.analysisKey)).size!==3||Object.values(r.analysisKey).some(c=>!conditions.includes(c)))throw Error('Invalid blinded key');
  for(const scenario of scenarios)for(const condition of conditions){const rows=r.ratings.filter(x=>x.scenario===scenario&&x.condition===condition);if(rows.length!==1)throw Error('Missing or duplicate scenario/condition');const row=rows[0];if(r.analysisKey[row.recording]!==condition||row.heardSelfReported!==true||dimensions.some(d=>!Number.isInteger(row.scores?.[d])||row.scores[d]<1||row.scores[d]>5))throw Error('Invalid rating');}
  const choice=r.overall?.choice,condition=r.analysisKey[choice]??choice;
  if(![...conditions,'tie','no-preference','unsure'].includes(condition)||r.overall.condition!==condition)throw Error('Invalid preference');
  if(!['none-observed','concern','unsure'].includes(r.criticalConcern))throw Error('Missing safety observation');
  included.push(r);
 }
 const ratings=Object.fromEntries(conditions.map(condition=>[condition,Object.fromEntries(dimensions.map(d=>{const perListener=included.map(r=>mean(r.ratings.filter(x=>x.condition===condition).map(x=>x.scores[d])));const average=mean(perListener);return [d,{mean:average,listeners:perListener.length,ratings:perListener.length*5}];}))]));
 const votes=included.filter(r=>conditions.includes(r.overall.condition)),wins=votes.filter(r=>r.overall.condition==='expressive').length;
 const preference={expressive:wins,neutral:votes.filter(r=>r.overall.condition==='neutral').length,existing:votes.filter(r=>r.overall.condition==='existing').length,expressingPreference:votes.length,tiesOrUnsure:included.length-votes.length,share:votes.length?wins/votes.length:null,wilson95:wilson(wins,votes.length)};
 const e=ratings.expressive,concerns=included.filter(r=>r.criticalConcern==='concern').length,uncertain=included.filter(r=>r.criticalConcern==='unsure').length;
 const numericPass=['naturalness','pronunciation','comfort'].every(d=>e[d].mean>=4)&&preference.share>=.7;
 let status='AWAITING HUMAN RATINGS';
 if(included.length>=8&&votes.length){status=!numericPass||concerns?'FAIL':!verification.safetyReviewComplete||uncertain?'BLOCKED':'PASS';}
 const byScenario=Object.fromEntries(scenarios.map(scenario=>[scenario,Object.fromEntries(conditions.map(condition=>[condition,Object.fromEntries(dimensions.map(d=>[d,mean(included.map(r=>r.ratings.find(x=>x.scenario===scenario&&x.condition===condition).scores[d]))]))]))]));
 const ageBands=Object.fromEntries(['under60','60plus','not-stated'].map(age=>[age,included.filter(r=>(r.ageBand??'not-stated')===age).length]));
 return {version:'tara-listening-1',status,listeners:included.length,targetListeners:8,excluded,ratings,byScenario,ageBands,preference,safety:{concerns,uncertain,organizerReviewComplete:verification.safetyReviewComplete===true},productionPromotion:false,uncertainty:'Small convenience pilot; repeated clips are not independent listeners. Wilson interval is descriptive, assumes independent listener votes, and does not establish clinical suitability. Rating means are descriptive; no powered population inference.',comparisonLimit:'Existing and neutral WAVs are identical; greeting is identical in all conditions. Existing-or-neutral preference counts against expressive once per listener, without pooling duplicate audio as independent evidence.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),out=args.indexOf('--out'),verified=args.indexOf('--verified');
 if(out<0||verified<0)throw Error('Usage: node scripts/analyze-voice-study.mjs --verified verification.json --out NEW-results.json [explicit listener export files]');
 const paths=args.filter((_,i)=>i!==out&&i!==out+1&&i!==verified&&i!==verified+1);
 const result=analyzeVoiceStudy(await Promise.all(paths.map(async p=>JSON.parse(await readFile(p,'utf8')))),JSON.parse(await readFile(args[verified+1],'utf8')));
 await writeFile(args[out+1],JSON.stringify(result,null,2)+'\n',{flag:'wx'});process.stdout.write(`${result.status}; ${result.listeners} verified listeners\n`);
}

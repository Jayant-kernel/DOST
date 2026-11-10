import {randomBytes,randomInt} from 'node:crypto';
import {z} from 'zod';
import {voiceSamples,previewVariants,type PreviewVariant} from './voice-preview.ts';
export const studyDimensions=['naturalness','warmth','cheerfulness','pronunciation','comfort','appropriateness'] as const;
export const studyChoices=['recording-1','recording-2','recording-3','tie','no-preference','unsure'] as const;
export const studyVersion='tara-listening-1';
type Choice=typeof studyChoices[number];
export type StudySession={id:string;expires:number;technicalOnly:boolean;exported?:boolean;ageBand:'under60'|'60plus'|'not-stated';clips:{token:string;scenario:string;recording:string;variant:PreviewVariant}[];scenarios:string[];key:Record<string,PreviewVariant>;served:Set<string>};
export function shuffled<T>(values:readonly T[],pick=(max:number)=>randomInt(max)):T[]{const result=[...values];for(let i=result.length-1;i>0;i--){const j=pick(i+1);if(!Number.isInteger(j)||j<0||j>i)throw Error('Invalid randomization');[result[i],result[j]]=[result[j],result[i]];}return result;}
export function newStudy(technicalOnly=false,ageBand:StudySession['ageBand']='not-stated'):StudySession{
 const variants=shuffled(previewVariants),key=Object.fromEntries(variants.map((variant,index)=>['recording-'+(index+1),variant]));
 const scenarios=shuffled(voiceSamples.map(s=>s.id));
 return {id:randomBytes(20).toString('hex'),expires:Date.now()+90*60000,technicalOnly,ageBand,key,scenarios,served:new Set(),clips:scenarios.flatMap(scenario=>shuffled(Object.entries(key)).map(([recording,variant])=>({token:randomBytes(20).toString('hex'),scenario,recording,variant})))};
}
export function publicStudy(session:StudySession){
 return {version:studyVersion,id:session.id,technicalOnly:session.technicalOnly,scenarios:session.scenarios.map(id=>({id,text:voiceSamples.find(s=>s.id===id)!.text,clips:session.clips.filter(c=>c.scenario===id).map(c=>({token:c.token,recording:c.recording}))}))};
}
const score=z.number().int().min(1).max(5);
const ratings=z.object({naturalness:score,warmth:score,cheerfulness:score,pronunciation:score,comfort:score,appropriateness:score}).strict();
export const studySubmission=z.object({ratings:z.array(z.object({token:z.string().regex(/^[a-f0-9]{40}$/u),heard:z.literal(true),scores:ratings}).strict()).length(15),preferences:z.array(z.object({scenario:z.string(),choice:z.enum(studyChoices)}).strict()).length(5),overall:z.enum(studyChoices),feedback:z.string().max(2000),criticalConcern:z.enum(['none-observed','concern','unsure']),concernDetails:z.string().max(1000)}).strict();
export function studyExport(session:StudySession,input:unknown){
 const value=studySubmission.parse(input);
 if(session.exported)throw Error('Already completed');
 const tokens=new Set(value.ratings.map(r=>r.token));if(tokens.size!==15||session.clips.some(c=>!tokens.has(c.token)||!session.served.has(c.token)))throw Error('Every recording must be delivered and rated');
 const scenarios=new Set(value.preferences.map(p=>p.scenario));if(scenarios.size!==5||session.scenarios.some(id=>!scenarios.has(id)))throw Error('Every scenario needs a preference or no-preference response');
 if(value.criticalConcern==='concern'&&!value.concernDetails.trim())throw Error('Describe concern');
 const condition=(choice:Choice)=>session.key[choice]??choice;
 return {version:studyVersion,sessionId:session.id,created:new Date().toISOString(),technicalOnly:session.technicalOnly,consented:!session.technicalOnly,hindiComfortable:!session.technicalOnly,adult:!session.technicalOnly,ageBand:session.ageBand,independentHumanVerified:false,reviewerType:'self-reported-human-not-verified',complete:true,model:'timbre-v3.0',voice:'Shivani',speed:1,language:'hi-IN',analysisKeyRevealedAfterCompletion:true,analysisKey:session.key,scenarioOrder:session.scenarios,clipOrder:session.clips.map(c=>({scenario:c.scenario,recording:c.recording})),ratings:value.ratings.map(r=>{const c=session.clips.find(c=>c.token===r.token)!;return {scenario:c.scenario,recording:c.recording,condition:c.variant,scores:r.scores,heardSelfReported:r.heard};}),preferences:value.preferences.map(p=>({...p,condition:condition(p.choice)})),overall:{choice:value.overall,condition:condition(value.overall)},feedback:value.feedback,criticalConcern:value.criticalConcern,concernDetails:value.concernDetails,limitations:'Delivery and self-reported completion are not proof of audible listening, independent identity or consent capacity. Organizer must verify eligibility/consent and unique participation separately without adding identifying data to this export.'};
}

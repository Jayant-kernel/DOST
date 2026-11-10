import {readFile,writeFile} from 'node:fs/promises';
import {gradeTurn} from './grade.mjs';
export function summarize(report){
 const rows=report.rows.map(row=>({...row,grade:gradeTurn(row,row.expected)}));
 const counts=key=>Object.fromEntries([...new Set(rows.map(key))].map(value=>[value,rows.filter(row=>key(row)===value).length]));
 const latencies=rows.filter(row=>row.modelInvoked).map(row=>row.modelLatencyMs).filter(Number.isFinite).sort((a,b)=>a-b);
 const failures={};for(const row of rows)for(const f of row.grade.failures)failures[f.category]=(failures[f.category]??0)+1;
 const timed=rows.filter(row=>row.timings);
 return {rows,summary:{scenarios:new Set(rows.map(row=>row.scenario)).size,turns:rows.length,sources:counts(row=>row.source),outcomes:counts(row=>row.grade.outcome),failureFlags:failures,modelCalls:rows.reduce((n,row)=>n+(row.modelCalls??0),0),modelLatencyMs:latencies.length?{median:latencies[Math.floor(latencies.length/2)],p95:latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*0.95)-1)],min:latencies[0],max:latencies.at(-1)}:null,measuredPromptMs:timed.reduce((n,row)=>n+(row.timings.prompt_ms??0),0),measuredDecodeMs:timed.reduce((n,row)=>n+(row.timings.predicted_ms??0),0),semanticReview:'pending',warning:'Categories can overlap. Strategy mismatches are rubric hypotheses; mechanical success is not semantic/naturalness qualification.'}};
}
if(process.argv[1]?.endsWith('summarize.mjs')){
 const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Supply input and NEW output JSON paths');const report=JSON.parse(await readFile(input,'utf8'));const evaluated=summarize(report);await writeFile(output,JSON.stringify({...report,...evaluated},null,2),{flag:'wx'});console.log(JSON.stringify(evaluated.summary));
}

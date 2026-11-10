// No environment discovery, default remote endpoint, credentials or spending.
// The application currently authorizes Gnani-only, so the CLI cannot enable this.
// A future application-owned adapter must supply explicit scope authorization.
export async function compareConfiguredReference(rows,adapter){
 if(!adapter?.configured||adapter.authorizedFor!=='saathi-synthetic-conversation-evaluation'||typeof adapter.generate!=='function')return {status:'skipped_no_configured_authorized_reference',rows:[],estimatedCost:null};
 const results=[];let cost=0,priced=true;
 for(const row of rows.filter(row=>row.modelInvoked&&row.promptMessages)){
  const request={messages:structuredClone(row.promptMessages),settings:structuredClone(row.settings),memory:structuredClone(row.memory),input:row.input,scenario:row.scenario,turn:row.turn};
  const start=performance.now();
  try{const answer=await adapter.generate(request,AbortSignal.timeout(20000));const price=adapter.estimateCost?.(answer.usage);if(typeof price==='number'&&Number.isFinite(price)&&price>=0)cost+=price;else priced=false;results.push({scenario:row.scenario,turn:row.turn,request,raw:answer.text,usage:answer.usage,latencyMs:Math.round(performance.now()-start),semanticReview:'pending'});}
  catch{results.push({scenario:row.scenario,turn:row.turn,error:'reference_failed',latencyMs:Math.round(performance.now()-start)});}
 }
 return {status:'compared',model:adapter.model,rows:results,estimatedCost:priced?cost:null,currency:adapter.currency??null};
}

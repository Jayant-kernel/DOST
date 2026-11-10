// Evaluation-only one-generation alternative. Not imported by the app.
// Separates model-chosen strategy from utterance in the same generation.
export const structuredStrategySchema={type:'object',additionalProperties:false,required:['strategy','reply'],properties:{strategy:{type:'string',enum:['ANSWER','ACKNOWLEDGE','SHARE','SUGGEST','ASK','REMINISCE','REASSURE','LISTEN','ACT']},reply:{type:'string'}}};
export function parseStructuredReply(raw){
 const value=JSON.parse(raw);if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='reply,strategy'||!structuredStrategySchema.properties.strategy.enum.includes(value.strategy)||typeof value.reply!=='string'||!value.reply.trim()||value.reply.length>4000)throw Error('Invalid structured reply');return value;
}
export async function evaluateStructured(rows,transport=fetch){
 const results=[];
 for(const row of rows){
  if(!row.promptMessages||row.policy!=='persona_v2')continue;
  const originalSystem=row.promptMessages[0].content;
  // Replace only direction with one bounded output contract, preserving persona,
  // memory and original user messages. This variant is explicitly not identical
  // to the unstructured prompt and is not a stronger-reference comparison.
  const messages=[{role:'system',content:originalSystem.replace(/\nConversation direction:[\s\S]*$/u,'')+'\nChoose the next conversational strategy and reply in the supplied JSON schema. Preserve safety and listening preferences.'},...row.promptMessages.slice(1)];
  const result={scenario:row.scenario,turn:row.turn,input:row.input,prior:row.prior,memory:row.memory,messages,modelCalls:1,raw:null,parsed:null};const began=performance.now();
  try{
   const signal=AbortSignal.timeout(20000),post=async(path,body)=>{const r=await transport('http://127.0.0.1:'+ (path==='/tokenize'?'8081':'8080')+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
   const {prompt}=await post('/apply-template',{messages,chat_template_kwargs:{enable_thinking:false},add_generation_prompt:true});
   const {tokens}=await post('/tokenize',{content:prompt});if(!Array.isArray(tokens)||tokens.length+160+32>2048)throw Error('Context capacity');
   const answer=await post('/completion',{prompt:tokens,n_predict:160,temperature:0,cache_prompt:true,stream:false,json_schema:structuredStrategySchema,stop:['<|im_end|>']});
   result.raw=answer.content;result.stop=answer.stop_type;result.timings=answer.timings;if(!['word','eos'].includes(answer.stop_type)||answer.truncated)throw Error('Incomplete generation');result.parsed=parseStructuredReply(answer.content);result.semanticReview='pending';
  }catch(error){result.error=error.message;}
  result.ms=Math.round(performance.now()-began);results.push(result);
 }
 return {scope:'one-generation structured output development experiment; no automatic runtime promotion',rows:results};
}

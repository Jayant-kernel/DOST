import {localRetry} from './local-retry.ts';
import {transcriptionRetry} from './transcription-retry.ts';
import {evonStreamText} from './evon-stream.ts';
import {timbreChunks} from './timbre-stream.ts';
import {companionInstructions,companionCore,type BehaviourPolicy} from './companion.ts';
import {escapeModelData} from './model-input.ts';
import {invalidBehaviourReply,humanPresenceClaim,humanHabitClaim,unsupportedStorageClaim} from './behaviour-validation.ts';
import {repetitiveReplyRule,firstQuestionPrefix,withoutTrailingQuestion,feminineFirstPerson,type ReplyRejectionRule} from './reply-quality.ts';
import type {Preferences} from '../shop/store.ts';
import type {ConversationContext} from './conversation-context.ts';
import {repeatedUserQuestion,type AdaptationState} from './adaptation.ts';
import {directorInstructions,statementOnlyReasons,type DirectorDecision} from './conversation-director.ts';
import {storyResponseRequested} from './conversation-commands.ts';
export type ReplyFailureDetail='human-claim'|'storage-claim'|'repetitive-reply'|'behaviour-rejected'|'question-not-allowed'|'invalid-stream'|'incomplete-answer';
export class ProviderError extends Error {
  status: number;
  readonly stage: string;
  readonly detail?:ReplyFailureDetail;
  readonly rule?:ReplyRejectionRule;
  constructor(stage: string, status = 502, detail?:ReplyFailureDetail, rule?:ReplyRejectionRule) { super(`${stage} service unavailable`); this.status = status; this.stage=stage; this.detail=detail; this.rule=rule; }
}
// Observed 2026-11-07 (tasks/multiturn-reliability-before-2026-11-07.json): most
// rejected local replies were verbatim copies of Evon's own previous turn or the
// user's words. Only these copy rules earn one regeneration.
const copyRules=new Set<ReplyRejectionRule>(['repeated-previous-reply','repeated-own-question','copied-user','echoed-user','echoed-user-question']);
// DRY penalises re-emitting token sequences already present in the prompt. It is
// used only for that single regeneration against the cached prompt; the first
// attempt keeps the measured greedy settings so accepted replies do not change.
export const copyRetrySampler={dry_multiplier:0.8,dry_base:1.75,dry_allowed_length:2,dry_penalty_last_n:2048} as const;
export class NoSpeechError extends ProviderError {
  constructor(){super('Prisma no speech',422);}
}
export type Message = { role: 'user' | 'assistant'; content: string };
export function createProviders(config: {apiKey: string; evonUrl: string; voice: string; preferences?: Preferences;context?:ConversationContext;listenOnly?:boolean;adaptation?:AdaptationState;decision?:DirectorDecision;speechSpeed?:0.9|1;tokenizerUrl?:string;cachePolicyPrefix?:boolean;behaviourPolicy?:BehaviourPolicy;ttsModel?:'timbre-v2.5'|'timbre-v3.0';onCopyRetry?:(rule:ReplyRejectionRule|'human-claim')=>void;onQuestionTrim?:()=>void;onQuestionBudgetTrim?:()=>void}, transport: typeof fetch = fetch, cancellation?: AbortSignal) {
  const v2=config.behaviourPolicy==='persona_v2';
  const budget=v2?(config.adaptation?.gentle||config.adaptation?.enabled&&config.adaptation.detail==='brief'?96:config.decision?.maxTokens??160):96;
  const contextLimit=Math.min(1900,2048-budget-32);
  const systemInstructions=()=>companionInstructions(config.preferences,config.context,config.listenOnly,config.adaptation,config.behaviourPolicy)+(v2&&config.decision?'\n'+directorInstructions(config.decision):'');
  async function call(stage: string, url: string, body: BodyInit, headers: Record<string,string>) {
    try {
      cancellation?.throwIfAborted();
      const timeout=AbortSignal.timeout(60000);
      const signal=cancellation ? AbortSignal.any([cancellation,timeout]) : timeout;
      const send=()=>transport(url,{method:'POST',body,headers,signal});
      const response=stage==='Evon'?await localRetry(send,signal):stage==='Prisma'?await transcriptionRetry(send,signal):await send();
      if (!response.ok) throw new ProviderError(stage,response.status);
      return response;
    } catch (e) { if(e instanceof ProviderError) throw e; throw new ProviderError(stage); }
  }
  async function policyTokens(){
    const headers={'Content-Type':'application/json'};
    const core=escapeModelData(companionCore(config.behaviourPolicy));
    const rendered=await(await call('Evon',`${config.evonUrl}/apply-template`,JSON.stringify({messages:[{role:'system',content:core}],chat_template_kwargs:{enable_thinking:false},add_generation_prompt:false}),headers)).json();
    if(typeof rendered.prompt!=='string'||rendered.prompt.length>20000)throw new ProviderError('Evon template');
    const data=await(await call('Tokenizer',`${config.tokenizerUrl}/tokenize`,JSON.stringify({content:rendered.prompt}),headers)).json();
    if(!Array.isArray(data.tokens)||!data.tokens.length||data.tokens.length>1900||data.tokens.some((id:unknown)=>!Number.isSafeInteger(id)||Number(id)<0||Number(id)>=163072))throw new ProviderError('Evon tokenizer');
    return data.tokens as number[];
  }
  async function prefill(tokens:number[]){
    const response=await call('Evon',`${config.evonUrl}/completion`,JSON.stringify({prompt:tokens,n_predict:0,temperature:0,cache_prompt:true,stream:false}),{'Content-Type':'application/json'});
    try{await response.json();}catch{throw new ProviderError('Evon prefill');}
  }
  return {
    async prepareReasoning(){
      if(!config.tokenizerUrl)throw new ProviderError('Evon tokenizer');
      const bare=await policyTokens(),headers={'Content-Type':'application/json'};
      // Find a reusable prefix before the closing system delimiter. The probe
      // is empty preference DATA, never a fabricated user turn or answer.
      const rendered=await(await call('Evon',`${config.evonUrl}/apply-template`,JSON.stringify({messages:[{role:'system',content:escapeModelData(companionCore(config.behaviourPolicy)+'{}')}],chat_template_kwargs:{enable_thinking:false},add_generation_prompt:false}),headers)).json();
      if(typeof rendered.prompt!=='string'||rendered.prompt.length>20000)throw new ProviderError('Evon template');
      const probe=await(await call('Tokenizer',`${config.tokenizerUrl}/tokenize`,JSON.stringify({content:rendered.prompt}),headers)).json();
      if(!Array.isArray(probe.tokens)||probe.tokens.length>1900||probe.tokens.some((id:unknown)=>!Number.isSafeInteger(id)||Number(id)<0||Number(id)>=163072))throw new ProviderError('Evon tokenizer');
      let shared=0;while(shared<bare.length&&bare[shared]===probe.tokens[shared])shared++;
      if(shared<16||bare.length-shared>8)throw new ProviderError('Evon preparation');
      await prefill(bare.slice(0,shared));
    },
    async transcribe(audio: Blob) {
      const form = new FormData(); form.set('audio_file',audio,'speech.wav'); form.set('language_code','hi-IN');
      const data = await (await call('Prisma','https://api.vachana.ai/stt/v3',form,{'X-API-Key-ID':config.apiKey})).json();
      if (!data.success || typeof data.transcript !== 'string') throw new ProviderError('Prisma');
      if (!data.transcript.trim()) throw new NoSpeechError();
      return data.transcript.trim() as string;
    },
    async reply(messages: Message[],stream=false) {
      const checked=(text:string,trimmed=false,budgetTrimmed=false):string=>{
        const latest=messages.filter(message=>message.role==='user').at(-1)?.content??'';
        // An invited story may narrate a character's habits in first person
        // ("कोई किस्सा सुनाइए" too, not only "कहानी सुनाइए"): round-3 review.
        if(humanPresenceClaim(text,latest)||v2&&!storyResponseRequested(messages)&&humanHabitClaim(text,latest))throw new ProviderError('Evon response quality',502,'human-claim');
        if(unsupportedStorageClaim(text,latest))throw new ProviderError('Evon response quality',502,'storage-claim');
        const rule=repetitiveReplyRule(text,messages,config.listenOnly,Boolean(config.adaptation?.gentle&&repeatedUserQuestion(messages)),v2);
        // Observed 2026-11-07: "multiple-questions" became the main reason
        // Tara's replies were replaced by an error. Keep the model's own reply
        // up to its first question mark; that prefix must pass every check.
        const shortened=rule==='multiple-questions'&&!trimmed?firstQuestionPrefix(text,v2):undefined;
        if(shortened){config.onQuestionTrim?.();return checked(shortened,true);}
        if(rule)throw new ProviderError('Evon response quality',502,'repetitive-reply',rule);
        const invitedStory=storyResponseRequested(messages);
        const sentenceBudget=invitedStory?8:budget===96?2:budget===256?8:4;
        if(config.behaviourPolicy==='full'&&(invalidBehaviourReply(text,latest)||escapeModelData(text)!==text)||v2&&(invalidBehaviourReply(text,latest,sentenceBudget)||escapeModelData(text)!==text))throw new ProviderError('Evon response quality',502,'behaviour-rejected');
        const quiet=config.adaptation?.enabled&&(config.adaptation.questions==='fewer'||config.adaptation.questions!=='curious'&&config.adaptation.shortReplies>=2);
        const strictDirection=config.decision&&statementOnlyReasons.includes(config.decision.reason);
        // 2026-11-07: Tara closed most turns with a question even when the
        // director asked for a statement. Keep the already-written statement
        // before a trailing question if it passes every check on its own;
        // otherwise the validated reply stands (subject to the rule below).
        if(v2&&config.decision?.noQuestion&&/[?？]/u.test(text)&&!budgetTrimmed){
          const statement=withoutTrailingQuestion(text,latest,config.decision.reason==='refusal');
          if(statement){let accepted:string|undefined;try{accepted=checked(statement,true,true);}catch{}if(accepted!==undefined){config.onQuestionBudgetTrim?.();return accepted;}}
        }
        if(v2&&config.decision?.questionNeeded===false&&(quiet||strictDirection)&&/[?？]/u.test(text))throw new ProviderError('Evon response quality',502,'question-not-allowed');
        // Tara is a woman; the model sometimes slips into masculine first person.
        return v2?feminineFirstPerson(text,messages):text;
      };
      if(config.tokenizerUrl){
        const headers={'Content-Type':'application/json'};
        const system=escapeModelData(systemInstructions());
        let context=messages;
        let tokens:number[]=[];
        while(true){
          const rendered=await(await call('Evon',`${config.evonUrl}/apply-template`,JSON.stringify({messages:[{role:'system',content:system},...context.map(message=>({...message,content:escapeModelData(message.content)}))],chat_template_kwargs:{enable_thinking:false},add_generation_prompt:true}),headers)).json();
          if(typeof rendered.prompt!=='string'||rendered.prompt.length>20000)throw new ProviderError('Evon template');
          let data;
          try{data=await(await call('Tokenizer',`${config.tokenizerUrl}/tokenize`,JSON.stringify({content:rendered.prompt}),headers)).json();}
          catch(error){
            // Older local helpers report overflow as 400 instead of a count.
            // Our rendered string/body has already passed the input bounds.
            if(error instanceof ProviderError&&error.status===400&&context.length>2){context=context.slice(context[0]?.role==='assistant'?1:2);continue;}
            throw error;
          }
          if(Number.isSafeInteger(data.token_count)&&data.token_count>contextLimit){
            if(context.length<=2)throw new ProviderError('Evon context limit');
            context=context.slice(context[0]?.role==='assistant'?1:2);continue;
          }
          if(!Array.isArray(data.tokens)||!data.tokens.length||data.tokens.some((id:unknown)=>!Number.isSafeInteger(id)||Number(id)<0||Number(id)>=163072))throw new ProviderError('Evon tokenizer');
          if(data.tokens.length<=contextLimit){tokens=data.tokens;break;}
          // Drop complete older exchanges, never the latest question or policy.
          if(context.length<=2)throw new ProviderError('Evon context limit');
          context=context.slice(context[0]?.role==='assistant'?1:2);
        }
        if(config.cachePolicyPrefix){
          // Hybrid recurrent models may have to reprocess a changed prompt from
          // the beginning. Preserve a reusable policy-only state before the
          // full request; both calls share the caller's existing deadline.
          const bare=await policyTokens();
          // Context extends the system message before its closing delimiter.
          // Trim that delimiter (and any differing boundary token), retaining
          // only an exact prefix of the actual request. Never prefill user text.
          let shared=0;while(shared<bare.length&&shared<tokens.length&&bare[shared]===tokens[shared])shared++;
          if(shared>=16&&shared<tokens.length&&bare.length-shared<=8)await prefill(bare.slice(0,shared));
        }
        const generate=async(sampler:Record<string,number>={})=>{
          const response=await call('Evon',`${config.evonUrl}/completion`,JSON.stringify({prompt:tokens,n_predict:budget,temperature:0,top_p:0.95,repeat_penalty:1,cache_prompt:true,stream,stop:['<|im_end|>'],...sampler}),headers);
          if(stream){let text;try{text=await evonStreamText(response,cancellation,true);}catch{throw new ProviderError('Evon response quality',502,'invalid-stream');}return checked(text);}
          const answer=await response.json();
          if(typeof answer.content!=='string'||!answer.content.trim()||/<\/?think>/.test(answer.content)||answer.truncated||!['eos','word'].includes(answer.stop_type))throw new ProviderError('Evon response quality',502,'incomplete-answer');
          return checked(answer.content.trim());
        };
        try{return await generate();}
        catch(error){
          // One regeneration, only for a rejected copy (and, for Tara, a human
          // claim). The prompt is already cached, the caller's reasoning
          // deadline still applies, and the new text passes every check above;
          // a second rejection becomes recovery.
          const retryRule=error instanceof ProviderError?error.rule&&copyRules.has(error.rule)?error.rule:v2&&error.detail==='human-claim'?'human-claim' as const:undefined:undefined;
          if(!retryRule)throw error;
          cancellation?.throwIfAborted();
          config.onCopyRetry?.(retryRule);
          return await generate(copyRetrySampler);
        }
      }
      const response = await call('Evon',`${config.evonUrl}/v1/chat/completions`,JSON.stringify({model:'saathi-evon',messages:[{role:'system',content:escapeModelData(systemInstructions())},...messages.map(message=>({...message,content:escapeModelData(message.content)}))],chat_template_kwargs:{enable_thinking:false},temperature:0,max_tokens:budget,stream}),{'Content-Type':'application/json'});
      if(stream){let text;try{text=await evonStreamText(response,cancellation);}catch{throw new ProviderError('Evon response quality',502,'invalid-stream');}return checked(text);}
      const choice = (await response.json()).choices?.[0]; const text = choice?.message?.content;
      if(typeof text !== 'string' || !text.trim() || /<\/?think>/.test(text) || choice.finish_reason === 'length') throw new ProviderError('Evon response quality',502,'incomplete-answer');
      return checked(text.trim());
    },
    async *speakStream(text:string){
      const response=await call('Timbre','https://api.vachana.ai/api/v1/tts/sse',JSON.stringify({text,voice:config.voice,model:config.ttsModel??'timbre-v2.5',language:'hi-IN',speed:config.speechSpeed??1,audio_config:{sample_rate:16000,num_channels:1,sample_width:2,encoding:'linear_pcm',container:'raw'}}),{'X-API-Key-ID':config.apiKey,'Content-Type':'application/json'});
      if(!response.headers.get('content-type')?.includes('text/event-stream'))throw new ProviderError('Timbre stream');
      yield* timbreChunks(response,cancellation);
    },
    async speak(text: string) {
      const response = await call('Timbre','https://api.vachana.ai/api/v1/tts/inference',JSON.stringify({text,voice:config.voice,model:config.ttsModel??'timbre-v2.5',language:'hi-IN',speed:config.speechSpeed??1,audio_config:{sample_rate:16000,num_channels:1,sample_width:2,encoding:'linear_pcm',container:'wav'}}),{'X-API-Key-ID':config.apiKey,'Content-Type':'application/json'});
      const bytes = await response.arrayBuffer(); const view = new Uint8Array(bytes);
      if(view.length < 44 || String.fromCharCode(...view.slice(0,4)) !== 'RIFF' || String.fromCharCode(...view.slice(8,12)) !== 'WAVE') throw new ProviderError('Timbre');
      return bytes;
    }
  };
}

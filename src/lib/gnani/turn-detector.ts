export type TurnDecision='listen'|'finish'|'idle'|'limit';
// Acoustic heuristic, not semantic VAD: pause duration is deliberately adjustable.
export class TurnDetector{
 private started:number;private lastSpeech=0;private candidate=0;private previous:number;
 private noise=0.003;private pause:number;private speech=false;
 constructor(now:number,pauseMs=2200){this.started=now;this.previous=now;this.pause=Math.max(1500,Math.min(4000,pauseMs));}
 get heardSpeech(){return this.speech;}
 sample(rms:number,now:number):TurnDecision{
  if(now-this.started>=25000)return this.speech?'limit':'idle';
  if(!Number.isFinite(rms)||rms<0)return 'listen';
  const delta=Math.max(0,Math.min(100,now-this.previous));this.previous=now;
  const threshold=Math.max(0.008,Math.min(0.06,this.noise*3+0.004));
  const voiced=rms>=threshold;
  if(voiced){
   this.candidate+=delta;
   if(this.candidate>=150){this.speech=true;this.lastSpeech=now;}
   return 'listen';
  }
  this.candidate=0;
  // Only learn the quiet floor; speech must not raise its own gate.
  if(rms<threshold*0.65)this.noise=this.noise*0.95+rms*0.05;
  if(!this.speech)return 'listen'; // The 25-second cap above also bounds silence.
  return now-this.lastSpeech>=this.pause?'finish':'listen';
 }
}

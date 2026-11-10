// Opt-in acoustic interruption; room/headphone qualification remains required.
export class InterruptionDetector{
 private speechSince:number|undefined;
 sample(rms:number,now:number){
  if(rms<0.06){this.speechSince=undefined;return false;}
  this.speechSince??=now;return now-this.speechSince>=300;
 }
}

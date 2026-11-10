// One bounded session, invalidated synchronously by Stop/error/hidden page.
export class ContinuousConversation{
 private generation=0;private turns=0;private started=0;private active=false;private emptyCaptures=0;
 begin(now=Date.now()){this.active=true;this.turns=0;this.emptyCaptures=0;this.started=now;return ++this.generation;}
 stop(){this.active=false;this.generation++;}
 get ticket(){return this.generation;}
 canListen(ticket:number,now=Date.now()){return this.active&&ticket===this.generation&&this.turns<30&&now-this.started<30*60*1000;}
 retryNoSpeech(ticket:number,now=Date.now()){if(!this.canListen(ticket,now))return false;return ++this.emptyCaptures<=2;}
 completed(ticket:number){if(ticket===this.generation&&this.active){this.turns++;this.emptyCaptures=0;}}
}

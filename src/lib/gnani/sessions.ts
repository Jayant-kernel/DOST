import type {Message} from './providers.ts';
import type {MemoryProposal} from './voice-memory.ts';
import type {SpeakerState} from './speaker.ts';
import type {EngagementState} from './engagement.ts';
import type {AdaptationState} from './adaptation.ts';
import type {VocalBaseline} from './care-cues.ts';
import type {MealState} from './meal-support.ts';
import type {BehaviourPolicy} from './companion.ts';
import type {ConversationBoundaryState} from './conversation-boundaries.ts';
import type {SocialState} from './social-conversation.ts';
import type {WeatherState} from './weather-conversation.ts';
import type {DirectorState} from './conversation-director.ts';
export type VoiceSession=SpeakerState&{expires:number;messages:Message[];busy:boolean;turns:number;recoveries?:number;controller?:AbortController;profileId?:string;listenUntil?:number;pendingMemory?:MemoryProposal;retentionPaused?:boolean;engagement?:EngagementState;adaptation?:AdaptationState;vocalBaseline?:VocalBaseline;meal?:MealState;behaviourPolicy?:BehaviourPolicy;boundaries?:ConversationBoundaryState;social?:SocialState;weather?:WeatherState;director?:DirectorState};
export class VoiceSessions extends Map<string,VoiceSession>{
  override delete(id:string){super.get(id)?.controller?.abort();return super.delete(id);}
  override get(id:string){const session=super.get(id);if(session&&session.expires<=Date.now()){this.delete(id);return undefined;}return session;}
}
export const voiceSessions=new VoiceSessions();

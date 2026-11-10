'use client';
import type {CSSProperties} from 'react';
export type VoicePhase='idle'|'listening'|'waiting'|'speaking'|'stopped'|'error';
export function VoiceOrb({phase,level}:{phase:VoicePhase;level:number}){
 const bounded=Number.isFinite(level)?Math.max(0,Math.min(1,level)):0;
 return <div className="voice-orb-space" aria-hidden="true"><div className="voice-orb" data-phase={phase} style={{'--voice-level':bounded} as CSSProperties}><span className="voice-orb-core"/><span className="voice-orb-ring"/></div></div>;
}

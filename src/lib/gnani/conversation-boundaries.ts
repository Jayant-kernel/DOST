export type ConversationBoundaryHint={kind:'user-declined'|'user-reported-resolution';at:string;expiresAt:number;userText:string;assistantText:string};
export type ConversationBoundaryState={hints:readonly ConversationBoundaryHint[]};
const lifetime=30*60*1000;
// These are original, dated statements, not inferred events or medical facts.
// They stay in the current voice session and expire independently of history.
export function updateConversationBoundaries(previous:ConversationBoundaryState|undefined,userText:string,assistantText:string|undefined,now:number):ConversationBoundaryState{
 const hints=(previous?.hints??[]).filter(hint=>hint.expiresAt>now).slice(-3);
 const masked=userText.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu,match=>' '.repeat(match.length));
 if(/अनुवाद|मतलब|उदाहरण|\b(?:translate|translation|meaning|example|quote)\b/iu.test(masked))return {hints};
 const declined=/(?:इस (?:बारे में|विषय पर) बात नहीं करनी|यह विषय छोड़िए|इसे (?:यहीं )?छोड़ (?:दीजिए|दें)|इस पर (?:और )?बात (?:मत|नहीं)|skip (?:this )?topic)/iu.exec(masked);
 const resolved=/(?:बात|मामला|समस्या|परेशानी).{0,12}(?:सुलझ (?:गई|गया|गया है|गई है)|हल हो (?:गई|गया))|अब कोई परेशानी नहीं|अब सब ठीक है|\b(?:the issue|the problem|that matter) (?:is |has been )?resolved\b/iu.exec(masked);
 const resolutionSurroundings=resolved?masked.slice(0,resolved.index)+masked.slice(resolved.index+resolved[0].length):masked;
 const uncertain=/\?|क्या.{0,30}(?:सुलझ|ठीक)|(?:नहीं|नही|शायद|अगर|यदि|मान लें)|\b(?:if|unless|might|maybe|perhaps|not|never)\b/iu.test(resolutionSurroundings);
 const match=declined??(!uncertain?resolved:undefined);
 if(!match)return {hints};
 const kind=declined?'user-declined' as const:'user-reported-resolution' as const;
 const from=Math.max(0,match.index-60),source=userText.slice(from,from+240);
 const entry={kind,at:new Date(now).toISOString(),expiresAt:now+lifetime,userText:source,assistantText:(assistantText??'').slice(0,160)};
 return {hints:[...hints.filter(hint=>hint.kind!==kind||hint.userText!==source),entry].slice(-3)};
}

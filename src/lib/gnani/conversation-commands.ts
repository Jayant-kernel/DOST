// Bounded explicit speech controls, not a general intent or emotion classifier.
// Shared by listening state and the director so fewer questions does not imply
// silence. Quoted examples cannot change the person's preferences.
export function questionPreference(text:string):'fewer'|'listen'|'resume'|undefined{
 if(/["“”«»]/u.test(text)||/अनुवाद|\b(?:translate|translation|meaning|quote|example)\b/iu.test(text))return;
 if(/^(?:अब पूछ सकते हैं[, ]*(?:एक सवाल)?|अब (?:आप )?सवाल पूछ सकते हैं|अब सवाल पूछिए|you can ask questions now)$/iu.test(text.trim().replace(/[।.!?]+$/u,'')))return 'resume';
 if(/कम सवाल|इतने सवाल मत|थोड़ा आप भी|\b(?:fewer questions|ask less|less questions)\b/iu.test(text))return 'fewer';
 if(/(?:सवाल|प्रश्न).{0,12}(?:मत|नहीं|नही)|(?:मत|नहीं|नही).{0,12}पूछ|(?:don't|do not|no).{0,12}questions|just listen|बस (?:मेरी बात )?सुन/iu.test(text))return 'listen';
}
export function explicitContentRequest(text:string){
 const unquoted=text.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu,' ');
 if(/(?:कहानी|मज़ाक|मजाक|चुटकुला).{0,15}(?:मत|नहीं)|(?:मत|नहीं).{0,15}(?:सुनाओ|सुनाइए)|\b(?:don't|do not)\s+(?:tell|share)/iu.test(unquoted))return false;
 return /(?:कहानी|किस्सा|अंत|चुटकुला|मज़ाक|मजाक).{0,25}(?:सुनाइए|सुनाओ|बताइए|बताओ)|(?:सुनाइए|सुनाओ).{0,25}(?:कहानी|किस्सा)|अनुवाद (?:कीजिए|करें|करो)|\b(?:baat batao|kaise banta|koi .{0,15}sunao|tell (?:me )?(?:a |the )?(?:story|joke))\b/iu.test(unquoted);
}
// A story allowance follows the user's recent story request, not a stale topic
// label or an assistant's invented biography. A different user topic ends it.
export function storyResponseRequested(messages:readonly {role:'user'|'assistant';content:string}[]):boolean{
 const users=messages.filter(message=>message.role==='user').slice(-4);
 const unquoted=(text:string)=>text.normalize('NFKC').replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu,' ');
 const declined=(text:string)=>/चुप\s*रह(?:िए|ो)|(?:कहानी|किस्सा)\s+(?:को\s+)?(?:बंद|रोक)|\bmake it stop\b|\b(?:do not|don't)\s+want\s+(?:another\s+|a\s+)?story\b/iu.test(text);
 const start=(text:string)=>{const t=unquoted(text);return !declined(t)&&explicitContentRequest(t)&&/कहानी|किस्सा|\bstory\b/iu.test(t);};
 const revision=(text:string)=>{
  // "मेरा मतलब" corrects the request; it is not a request for a definition.
  if(/अनुवाद|मतलब|उदाहरण|\b(?:translate|translation|meaning|quote|example)\b/iu.test(text.replace(/मेरा मतलब[,، ]*/gu,'')))return false;
  const t=unquoted(text);
  if(declined(t))return false;
  if(/(?:कहानी|किस्सा)\s*(?:मत|नहीं)|(?:मत|नहीं)\s*(?:आगे\s*)?(?:बढ़ा|बदल|लिख|कर|कीजिए|सुनाइए|सुनाओ)|\b(?:don't|do not|stop)\s+(?:continue|tell|change|rewrite)/iu.test(t))return false;
  const reference=/कहानी|किस्सा|उसी|उसमें|उसका|इसका|किरदार|पात्र|अंत|आगे|\b(?:story|ending|character|it|continue)\b/iu.test(t);
  const command=/(?:बदल|कर|बना|लिख|जोड़|बढ़ा)\s*(?:दीजिए|दो|दें)|बदलिए|बदलें|बदलिये|बनाइए|बनाओ|लिखिए|लिखो|जोड़िए|जोड़ें|बढ़ाइए|बढ़ाओ|कीजिए|सुनाइए|सुनाओ|रखिए|\b(?:continue|rewrite|change|replace|finish|make|end)\b/iu.test(t);
  return reference&&command;
 };
 const latest=users.at(-1)?.content??'';
 if(start(latest))return true;
 if(!revision(latest))return false;
 for(let index=users.length-2;index>=0;index--){
  if(start(users[index].content))return true;
  if(!revision(users[index].content))return false;
 }
 return false;
}
export function explicitCorrection(text:string){
 if(/["“”«»]/u.test(text)||/अनुवाद|\b(?:translate|quote|example)\b/iu.test(text))return false;
 return /मेरा मतलब|मैंने ऐसा नहीं कहा|गलत समझ|(?:भाई|बहन|चाय|दवा|दवाई|रेखा) नहीं[, ]|\b(?:I meant|you misunderstood|nahi[, ]+main .{0,35}bol raha|not my (?:brother|sister))\b/iu.test(text);
}

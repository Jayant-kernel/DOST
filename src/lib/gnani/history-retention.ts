// Explicit application controls only. Quoted examples, questions and mixed
// disclosures do not silently change retention or divert a safety response.
export function historyRetentionRequest(text:string):'stop'|'resume'|'status'|undefined{
 let clean=text.normalize('NFKC').trim().replace(/[।.!]+$/u,'').trim().replace(/^(?:please|कृपया|अब से)[,، ]+/iu,'');
 if(!/["“”«»]/u.test(clean)&&/^इससे जो पहले की बातें हैं[, ]*वे भी मिट गईं क्या\??$/u.test(clean))return 'status';
 if(/["“”«»?？]/u.test(clean)||/अनुवाद|मतलब|उदाहरण|\b(?:translate|translation|meaning|quote|example)\b/iu.test(clean))return;
 clean=clean.replace(/^इस बातचीत का इतिहास अब /u,'बातचीत का इतिहास ').replace(/सहेजना बंद कर दीजिए$/u,'सहेजना बंद करें');
 if(/^(?:ठीक है[, ]*)?अभी कुछ मिटाना नहीं[।,. ]+आगे की बातें भी सेव मत कीजिए$/u.test(clean))return 'stop';
 if(/^(?:(?:यह (?:बात )?सिर्फ अभी (?:की बातचीत के लिए|की बात) है[,، ]*)?(?:इसे|यह बात|मेरी बात) याद मत (?:रखना|रखिए|रखें)|(?:मेरी )?बातचीत(?: का इतिहास)? (?:मत सहेजिए|मत सहेजें|मत सहेजना|सहेजना बंद (?:करें|करो)|याद मत (?:रखना|रखिए|रखें))|इतिहास सहेजना बंद (?:करें|करो)|(?:stop (?:saving|retaining|storing)(?: my| our| the)? (?:conversation history|conversations|chat history)|(?:do not|don't) (?:save|store|retain|remember) (?:this conversation|our conversation|this chat|this))|(?:is baat ko yaad mat rakhna|meri baat save mat karo|history save karna band karo))$/iu.test(clean))return 'stop';
 if(/^(?:(?:मेरी )?बातचीत(?: का इतिहास)? (?:फिर से सहेजना शुरू करें|सहेजना फिर शुरू करें|फिर से याद रखें)|(?:start|resume) (?:saving|retaining|storing)(?: my| our| the)? (?:conversation history|conversations|chat history)(?: again)?|history phir se save karo)$/iu.test(clean))return 'resume';
}

import {test} from 'node:test';import assert from 'node:assert/strict';
import {dailyConversation} from './daily-conversation.ts';
const evening={role:'assistant' as const,content:'अरे जयंत जी, वापस आ गए! आज शाम कैसी जा रही है?'};
test('common answers to the actual check-in get a connected follow-up without inference',()=>{
 for(const text of ['अच्छी','मेरी शाम अच्छी जा रही है।','बढ़िया है।'])assert.match(dailyConversation([evening,{role:'user',content:text}])!,/आज की कौन सी बात/);
 assert.match(dailyConversation([evening,{role:'user',content:'मेरी शाम ठीक नहीं है।'}])!,/मन पर/);
 const meal={role:'assistant' as const,content:'दोपहर का खाना हो गया?'};
 assert.match(dailyConversation([meal,{role:'user',content:'हाँ, खाना खा लिया।'}])!,/खाने में क्या/);
 assert.match(dailyConversation([meal,{role:'user',content:'अभी नहीं'}])!,/क्या उपलब्ध/);
 assert.equal(dailyConversation([evening,{role:'user',content:'अच्छी'}],false),'अच्छा लगा सुनकर।');
 assert.doesNotMatch(dailyConversation([meal,{role:'user',content:'हाँ'}],false)!,/\?/);
});
test('does not fake understanding of arbitrary questions, examples, symptoms or earlier answered prompts',()=>{
 for(const text of ['कल खाना नहीं मिला था','अच्छी का मतलब क्या है?','मेरी शाम अच्छी नहीं है और सीने में दर्द है','हाँ, पर दवा दोगुनी करनी है','आज बारिश होगी?'])assert.equal(dailyConversation([evening,{role:'user',content:text}]),undefined);
 assert.equal(dailyConversation([{role:'user',content:'अच्छी'}]),undefined);
 assert.equal(dailyConversation([{role:'user',content:'सवाल मत पूछिए, बस सुनिए।'},evening,{role:'user',content:'अच्छी'}]),undefined);
 assert.equal(dailyConversation([{role:'assistant',content:'आज की कौन सी बात सबसे अच्छी लगी?'},evening,{role:'user',content:'अच्छी'}]),undefined);
});

test('meal conversation answers its own follow-up and permits a quiet response to its optional suggestion',()=>{
 const messages:{role:'assistant'|'user';content:string}[]=[{role:'assistant',content:'दोपहर का खाना हो गया?'}];
 const answer=(text:string)=>{
  messages.push({role:'user',content:text});const reply=dailyConversation(messages);
  assert.ok(reply,`A supported answer needs a connected reply: ${text}`);messages.push({role:'assistant',content:reply});return reply;
 };
 assert.match(answer('हाँ'),/खाने में क्या अच्छा लगा/);
 const food=answer('दाल और चावल खाए');assert.match(food,/खाने में दाल और चावल/);assert.match(food,/मन हो तो/);assert.doesNotMatch(food,/\?|क्या उपलब्ध|दवा|डॉक्टर/);
 assert.equal(answer('ठीक है जी'), 'जी, आराम से।');
 // Three user replies and their three connected assistant replies do not call
 // the model, quiz the person again, or invent stock/weather/medication facts.
 assert.equal(messages.length,7);
 assert.equal(dailyConversation([...messages,{role:'user',content:'अब बिजली कैसे बनती है?'}]),undefined);
});

test('meal suggestion is optional, not repeated or imposed after refusal',()=>{
 const meal={role:'assistant' as const,content:'अच्छा जी। आज खाने में क्या अच्छा लगा?'};
 for(const food of ['खिचड़ी','मैंने रोटी और दही खाए','खाना अच्छा था']){
  const reply=dailyConversation([meal,{role:'user',content:food}]);assert.ok(reply);assert.match(reply,/मन हो तो/);assert.doesNotMatch(reply,/\?/);
  const declined=dailyConversation([meal,{role:'user',content:food},{role:'assistant',content:reply},{role:'user',content:'नहीं चाहिए'}]);
  assert.equal(declined,'ठीक है जी, आराम करना आपकी मर्ज़ी है।');
 }
 const brief=dailyConversation([meal,{role:'user',content:'दाल और चावल खाए'}],false)!;
 assert.match(brief,/दाल और चावल/);assert.doesNotMatch(brief,/\?|मन हो|बैठ/);
 const prior=dailyConversation([meal,{role:'user',content:'दाल और चावल खाए'}])!;
 assert.doesNotMatch(dailyConversation([{role:'assistant',content:prior},meal,{role:'user',content:'खिचड़ी'}])!,/मन हो तो/);
 assert.equal(dailyConversation([{role:'assistant',content:'आप क्या पढ़ रहे थे?'},{role:'user',content:'ठीक है जी'}]),undefined);
});

test('positive-day follow-up acknowledges only a clear answer to the question actually asked',()=>{
 const first=dailyConversation([evening,{role:'user',content:'मेरी शाम अच्छी जा रही है'}])!;
 const answers=['आज दोस्त से बात की','अपनी बहन से फोन पर बात की','बगीचे में बैठा था','आज मैंने किताब पढ़ी'];
 for(const text of answers){
  const reply=dailyConversation([evening,{role:'user',content:'अच्छी'},{role:'assistant',content:first},{role:'user',content:text}]);
  assert.ok(reply,text);assert.doesNotMatch(reply,/\?|मैंने|मेरी बहन|मेरे दोस्त/);assert.match(reply,/चाहें तो/);
  const brief=dailyConversation([{role:'assistant',content:first},{role:'user',content:text}],false)!;assert.doesNotMatch(brief,/सुनाइए|\?/);
 }
 assert.equal(dailyConversation([{role:'assistant',content:first},{role:'user',content:'अभी याद नहीं'}]),'कोई बात नहीं जी। अभी आराम से बात कर सकते हैं।');
 assert.equal(dailyConversation([{role:'assistant',content:first},{role:'user',content:'दोस्त से बात की लेकिन झगड़ा हो गया'}]),undefined);
 assert.equal(dailyConversation([{role:'assistant',content:'आज क्या बात मन पर रह गई?'},{role:'user',content:'नहीं बताना'}]),'ठीक है जी, इस बात को छोड़ देते हैं।');
});

test('food follow-up never captures direct questions, quotes, symptoms, restriction disclosures or unrelated stories',()=>{
 const meal={role:'assistant' as const,content:'आज खाने में क्या अच्छा लगा?'};
 for(const text of ['दाल क्या है?','चावल का मतलब क्या है','एलर्जी क्या है?','खाना कितने बजे खाना चाहिए?','दाल और चावल खाए लेकिन पेट में दर्द है','दाल से एलर्जी है','“दाल और चावल खाए”','मेरी माँ ने दाल खाई','कल दाल खाई थी','मैंने दोस्त के साथ अच्छा समय बिताया']){
  assert.equal(dailyConversation([meal,{role:'user',content:text}]),undefined,text);
 }
 assert.equal(dailyConversation([{role:'user',content:'बस सुनिए, सवाल नहीं'},meal,{role:'user',content:'दाल और चावल खाए'}]),undefined);
});

test('short dinner answers remain attached to the question actually asked',()=>{
 const dinner={role:'assistant' as const,content:'नमस्ते जी। रात का खाना हो गया?'};
 for(const text of ['नहीं','जी नहीं','अभी नहीं','no','NO','not yet','nahi']){
  const reply=dailyConversation([dinner,{role:'user',content:text}]);
  assert.match(reply!,/क्या उपलब्ध/,text);assert.doesNotMatch(reply!,/दवा|खुराक|खा लिया/);
 }
 const enjoyment={role:'assistant' as const,content:dailyConversation([dinner,{role:'user',content:'yes'}])!};
 assert.match(enjoyment.content,/खाने में क्या अच्छा लगा/);
 for(const text of ['नहीं','अभी नहीं','no','no thanks','not now']){
  const reply=dailyConversation([dinner,{role:'user',content:'yes'},enjoyment,{role:'user',content:text}]);
  assert.match(reply!,/बात यहीं छोड़/);assert.doesNotMatch(reply!,/भूख|उपलब्ध|दवा|खाना नहीं खाया|\?/);
 }
 const clarification=dailyConversation([enjoyment,{role:'user',content:'हाँ'}])!;assert.match(clarification,/क्या खाया/);
 assert.match(dailyConversation([{role:'assistant',content:clarification},{role:'user',content:'दाल रोटी खाई'}])!,/दाल रोटी/);
 assert.doesNotMatch(dailyConversation([enjoyment,{role:'user',content:'हाँ'}],false)!,/\?/);
 for(const text of ['नहीं बताना','बात नहीं करनी','no thanks','not now'])assert.match(dailyConversation([dinner,{role:'user',content:text}])!,/बात यहीं छोड़/);
 // "now" could be a transcription error but is not evidence for "no".
 assert.equal(dailyConversation([dinner,{role:'user',content:'now'}]),undefined);
 for(const text of ['नहीं, सीने में दर्द है','no, change my medicine','नहीं, दाल क्या है?','“no” का अनुवाद करो'])assert.equal(dailyConversation([dinner,{role:'user',content:text}]),undefined);
 assert.equal(dailyConversation([{role:'user',content:'बस सुनिए'},dinner,{role:'user',content:'no'}]),undefined);
 assert.equal(dailyConversation([{role:'assistant',content:'कौन सा संगीत पसंद है?'},{role:'user',content:'no'}]),undefined);
});

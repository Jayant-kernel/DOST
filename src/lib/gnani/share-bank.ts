// Fixed, reviewed items Tara can share when someone asks to hear something or
// says they are bored. Application text, never instructions: well-known facts,
// sayings, practical non-medical tips and short folk stories. No first-person
// claims, questions or health advice. Wording is spoken Hindi.
// religious marks a religion-specific festival item; those never lead a turn.
export type ShareTopic='cricket'|'films'|'railway'|'plants'|'cooking'|'music'|'poetry'|'walking'|'family'|'punjab';
export type ShareItem={readonly id:string;readonly kind:'season'|'proverb'|'tip'|'story'|'topic';readonly months?:readonly number[];readonly religious?:true;readonly topic?:ShareTopic;readonly text:string};

const item=(id:string,kind:ShareItem['kind'],text:string,months?:number[],religious?:true):ShareItem=>Object.freeze({id,kind,text,...(months?{months:Object.freeze(months)}:{}),...(religious?{religious}:{})});

export const shareBank:readonly ShareItem[]=Object.freeze([
 item('s01','season','जनवरी के बीच में लोहड़ी, मकर संक्रांति और पोंगल मनाए जाते हैं। ये तीनों फसल से जुड़े त्योहार हैं।',[1],true),
 item('s02','season','26 जनवरी 1950 को भारत का संविधान लागू हुआ था। इसीलिए हर साल इस दिन गणतंत्र दिवस मनाया जाता है।',[1]),
 item('s03','season','होली फागुन महीने की पूर्णिमा के आसपास आती है। रंगों वाली होली से पहले की रात होलिका दहन होता है।',[2,3],true),
 item('s04','season','चैत्र महीने से कई जगह नया साल शुरू होता है। महाराष्ट्र में इसे गुड़ी पड़वा और कर्नाटक, आंध्र प्रदेश में उगादी कहते हैं।',[3,4],true),
 item('s05','season','बैसाखी अक्सर 13 या 14 अप्रैल को आती है। पंजाब में यह गेहूँ की फसल पकने की खुशी का त्योहार है।',[4],true),
 item('s06','season','मानसून आमतौर पर जून की शुरुआत में केरल पहुँचता है। फिर धीरे-धीरे पूरे देश में बारिश फैलती है।',[5,6]),
 item('s07','season','रक्षाबंधन सावन महीने की पूर्णिमा को मनाया जाता है। इस दिन बहनें भाइयों की कलाई पर राखी बाँधती हैं।',[7,8],true),
 item('s08','season','15 अगस्त 1947 को भारत आज़ाद हुआ था। हर साल इस दिन प्रधानमंत्री लाल किले पर तिरंगा फहराते हैं।',[8]),
 item('s09','season','5 सितंबर को शिक्षक दिवस मनाया जाता है। यह डॉ. सर्वपल्ली राधाकृष्णन का जन्मदिन है।',[9]),
 item('s10','season','2 अक्टूबर को गांधी जी और लाल बहादुर शास्त्री जी, दोनों का जन्मदिन होता है।',[10]),
 item('s11','season','दिवाली कार्तिक महीने की अमावस्या को मनाई जाती है। कहते हैं इसी दिन राम जी अयोध्या लौटे थे और लोगों ने दीये जलाए थे।',[10,11],true),
 item('s12','season','दिवाली से पहले घरों की सफ़ाई होती है और दरवाज़े पर रंगोली बनाई जाती है।',[10,11],true),
 item('s13','season','गुरु नानक देव जी का प्रकाश पर्व कार्तिक पूर्णिमा को मनाया जाता है।',[11],true),
 item('s14','season','14 नवंबर को बाल दिवस मनाया जाता है, जो पंडित जवाहरलाल नेहरू का जन्मदिन है।',[11]),
 item('s15','season','25 दिसंबर को क्रिसमस मनाया जाता है, जो ईसा मसीह के जन्म का त्योहार है।',[12],true),
 item('s16','season','साल का सबसे छोटा दिन 21 या 22 दिसंबर के आसपास होता है। उसके बाद दिन धीरे-धीरे लंबे होने लगते हैं।',[11,12,1]),
 item('s17','season','साल का सबसे लंबा दिन 21 जून के आसपास होता है।',[6]),
 item('p01','proverb','कहते हैं, बूँद-बूँद से घड़ा भरता है। मतलब, थोड़ा-थोड़ा जोड़ने से भी बड़ा काम हो जाता है।'),
 item('p02','proverb','कहते हैं, जैसी करनी वैसी भरनी। जैसा काम करेंगे, वैसा ही फल मिलेगा।'),
 item('p03','proverb','एक कहावत है, अधजल गगरी छलकत जाय। मतलब, जिसे थोड़ा ज्ञान होता है, वही ज़्यादा दिखावा करता है।'),
 item('p04','proverb','कहते हैं, नाच न जाने आँगन टेढ़ा। मतलब, अपनी कमी का दोष दूसरी चीज़ों पर डाल देना।'),
 item('p05','proverb','कहते हैं, जहाँ चाह वहाँ राह। मन से चाहें तो रास्ता निकल ही आता है।'),
 item('p06','proverb','एक कहावत है, दूर के ढोल सुहावने। मतलब, दूर की चीज़ें अक्सर असल से ज़्यादा अच्छी लगती हैं।'),
 item('p07','proverb','कहते हैं, अब पछताए होत क्या जब चिड़िया चुग गई खेत। मतलब, समय निकल जाने के बाद पछताने से कुछ नहीं बदलता।'),
 item('p08','proverb','एक कहावत है, घर की मुर्गी दाल बराबर। मतलब, जो चीज़ पास होती है, उसकी कद्र अक्सर कम होती है।'),
 item('p09','proverb','कहते हैं, आम के आम गुठलियों के दाम। मतलब, एक ही काम से दोहरा फ़ायदा।'),
 item('p10','proverb','एक कहावत है, ऊँट के मुँह में जीरा। मतलब, ज़रूरत बहुत बड़ी हो और मिले बहुत थोड़ा।'),
 item('p11','proverb','कहते हैं, एक और एक ग्यारह होते हैं। मतलब, मिलकर काम करें तो ताक़त कई गुना हो जाती है।'),
 item('p12','proverb','कबीर का दोहा है, धीरे-धीरे रे मना, धीरे सब कुछ होय; माली सींचे सौ घड़ा, ऋतु आए फल होय। यानी हर चीज़ अपने समय पर ही होती है।'),
 item('p13','proverb','रहीम का दोहा है, रहिमन धागा प्रेम का, मत तोरो चटकाय; टूटे से फिर ना मिले, मिले गाँठ परि जाय। यानी प्रेम के रिश्ते को झटके से नहीं तोड़ना चाहिए।'),
 item('p14','proverb','कबीर का दोहा है, काल करे सो आज कर, आज करे सो अब; पल में परलय होएगी, बहुरि करेगा कब। यानी अच्छे काम को कल पर न टालें।'),
 item('t01','tip','चश्मा, चाबी और फ़ोन रोज़ एक ही तय जगह रखें, तो ढूँढना नहीं पड़ता।'),
 item('t02','tip','फ़ोन के पास बड़े अक्षरों में ज़रूरी नंबरों की एक पर्ची रखना बहुत काम आता है।'),
 item('t03','tip','बैंक कभी फ़ोन पर OTP या PIN नहीं माँगता। कोई माँगे तो बात वहीं रोक देना ही ठीक रहता है।'),
 item('t04','tip','पुरानी तस्वीरों के पीछे नाम और साल लिख दें, तो आगे की पीढ़ी के लिए यादें साफ़ रहती हैं।'),
 item('t05','tip','गमलों में पानी सुबह या शाम को देना अच्छा रहता है, जब धूप तेज़ न हो।'),
 item('t06','tip','कहते हैं पुराने अख़बार से काँच साफ़ करें तो धारियाँ कम पड़ती हैं।'),
 item('t07','tip','बैंक, बिजली और पानी के काग़ज़ एक ही फ़ाइल में रखें, तो ज़रूरत पर तुरंत मिल जाते हैं।'),
 item('st01','story','एक किस्सा है, प्यासे कौए को घड़े में थोड़ा-सा पानी मिला तो उसने उसमें कंकड़ डाले। पानी ऊपर आ गया और उसने अपनी प्यास बुझा ली।'),
 item('st02','story','खरगोश ने दौड़ में कछुए को धीमा समझा और रास्ते में सो गया। कछुआ बिना रुके चलता रहा और दौड़ जीत गया।'),
 item('st03','story','एक कबूतर ने नदी में डूबती चींटी की ओर पत्ता गिराकर उसे बचाया। बाद में चींटी ने शिकारी के पैर में काटकर कबूतर की जान बचाई।'),
 item('st04','story','एक आदमी पूरी रात ठंडे पानी में खड़ा रहा, तो अकबर ने कहा कि उसे दूर जलते दीये से गर्मी मिली होगी। तब बीरबल ने आग से बहुत ऊपर खिचड़ी की हांडी टाँगकर दिखाया कि इतनी दूर से कुछ नहीं पकता।')
]);

// Interest items (2026-11-09 elder simulations): when someone names a topic,
// gives one-word answers or the model fails, Tara adds a checked fact or her
// own clearly-framed opinion about THAT topic instead of a stock question.
// Poetry is public-domain only (Ghalib, Kabir, Rahim); no song lyrics.
const topical=(id:string,topic:ShareTopic,text:string,religious?:true):ShareItem=>Object.freeze({id,kind:'topic' as const,topic,text,...(religious?{religious}:{})});
export const topicBank:readonly ShareItem[]=Object.freeze([
 topical('c01','cricket','भारत ने पहला क्रिकेट विश्व कप 1983 में कपिल देव की कप्तानी में जीता था। मेरी राय में उसी जीत ने गली-गली में क्रिकेट का जुनून जगाया।'),
 topical('c02','cricket','सुनील गावस्कर टेस्ट क्रिकेट में दस हज़ार रन बनाने वाले दुनिया के पहले बल्लेबाज़ थे। उस ज़माने में लोग रेडियो कमेंट्री सुनकर ही पूरा मैच आँखों के सामने देख लेते थे।'),
 topical('c03','cricket','टेस्ट क्रिकेट को धैर्य का खेल कहते हैं। मुझे तो लगता है कि किसी खिलाड़ी की असली परख पाँच दिन के टेस्ट में ही होती है।'),
 topical('c04','cricket','2011 का विश्व कप भारत ने मुंबई के वानखेड़े स्टेडियम में जीता था, और धोनी ने छक्का मारकर मैच ख़त्म किया था।'),
 topical('f01','films','राज कपूर की फ़िल्म आवारा 1951 में आई थी, और इसके गाने रूस तक मशहूर हुए थे।'),
 topical('f02','films','श्री चार सौ बीस का गाना मेरा जूता है जापानी शैलेंद्र ने लिखा था और मुकेश ने गाया था। मेरी राय में उस गाने में पूरे देश का मन बसता था।'),
 topical('f03','films','चलती का नाम गाड़ी में किशोर कुमार अपने दोनों भाइयों, अशोक कुमार और अनूप कुमार के साथ आए थे। किशोर दा गायक के साथ कमाल के अभिनेता भी थे।'),
 topical('f04','films','मुग़ल-ए-आज़म 1960 में आई थी और उसे बनने में कई साल लगे थे। मुझे लगता है ऐसी भव्य फ़िल्में आज भी कम ही बनती हैं।'),
 topical('r01','railway','भारत में पहली यात्री रेलगाड़ी 16 अप्रैल 1853 को बंबई और ठाणे के बीच चली थी।'),
 topical('r02','railway','फ्रंटियर मेल 1928 में शुरू हुई थी और बंबई से पेशावर तक जाती थी। बाद में उसका नाम गोल्डन टेम्पल मेल रखा गया।'),
 topical('r03','railway','पहले गार्ड साहब की हरी झंडी और सीटी के बिना गाड़ी आगे नहीं बढ़ती थी। मेरी राय में रेलवे की नौकरी बड़ी ज़िम्मेदारी वाली होती थी।'),
 topical('g01','plants','तुलसी को धूप पसंद है, पर सर्दियों में पाले वाली रातों में उसे ढककर रखना अच्छा रहता है।'),
 topical('g02','plants','मनी प्लांट पानी की बोतल में भी आराम से बढ़ जाता है, बस हफ़्ते में एक बार पानी बदल दें।'),
 topical('g03','plants','गेंदे के फूल सर्दियों में खूब खिलते हैं, इसीलिए नवंबर-दिसंबर में बगीचे पीले-नारंगी दिखते हैं।'),
 topical('k01','cooking','राजस्थान की दाल-बाटी-चूरमा बहुत मशहूर है। कहते हैं पहले बाटी को गर्म रेत में दबाकर सेंका जाता था।'),
 topical('k02','cooking','सर्दियों में बाजरे की रोटी और सरसों का साग खूब बनता है। मेरी राय में साथ में थोड़ा गुड़ हो तो मज़ा दोगुना हो जाता है।'),
 topical('k03','cooking','एक पुरानी कहावत है, खिचड़ी के चार यार, दही, पापड़, घी, अचार।'),
 topical('m01','music','लता मंगेशकर ने ऐ मेरे वतन के लोगों 1963 में गाया था। कहते हैं उसे सुनकर नेहरू जी की आँखें भर आई थीं।'),
 topical('m02','music','रेडियो सीलोन पर अमीन सयानी की बिनाका गीतमाला इतनी मशहूर थी कि लोग हर हफ़्ते उसका इंतज़ार करते थे।'),
 topical('m03','music','मीराबाई का भजन पायो जी मैंने राम रतन धन पायो सदियों से गाया जा रहा है।',true),
 topical('m04','music','पुराने गानों की बात ही अलग है। मेरी राय में उस ज़माने के गानों के बोलों में कविता होती थी।'),
 topical('pt01','poetry','ग़ालिब का एक शेर है, हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले, बहुत निकले मेरे अरमान लेकिन फिर भी कम निकले।'),
 topical('pt02','poetry','कबीर का दोहा है, बुरा जो देखन मैं चला, बुरा न मिलिया कोय; जो दिल खोजा आपना, मुझसे बुरा न कोय।'),
 topical('pt03','poetry','रहीम का दोहा है, रहिमन देखि बड़ेन को, लघु न दीजिए डारि; जहाँ काम आवे सुई, कहा करे तरवारि। यानी छोटी चीज़ की भी अपनी जगह होती है।'),
 topical('pt04','poetry','ग़ालिब का शेर है, दिल-ए-नादाँ तुझे हुआ क्या है, आख़िर इस दर्द की दवा क्या है।'),
 topical('w01','walking','कहते हैं सुबह की हवा सौ दवाओं के बराबर होती है।'),
 topical('w02','walking','टहलते समय किसी साथी के साथ बातें करते चलें, तो रास्ता छोटा लगता है और मन भी हल्का रहता है।'),
 topical('fa01','family','आजकल वीडियो कॉल पर पोते-पोतियों को अपने पुराने किस्से सुनाना भी एक प्यारा तरीका है। बच्चों को बड़ों की कहानियाँ बहुत याद रहती हैं।'),
 topical('fa02','family','एक छोटी डायरी में अपने बचपन के किस्से लिखते जाएँ, तो आगे चलकर वही बच्चों के लिए सबसे कीमती तोहफ़ा बन जाती है।'),
 topical('pa01','punjab','अमृतसर के स्वर्ण मंदिर का लंगर दुनिया की सबसे बड़ी सामुदायिक रसोई में गिना जाता है, जहाँ रोज़ हज़ारों लोग खाना खाते हैं।',true),
 topical('pa03','punjab','पंजाब के लोकगीतों में हीर गाने की परंपरा बहुत पुरानी है। हीर-रांझा का मशहूर किस्सा वारिस शाह ने लिखा था।'),
 topical('pa02','punjab','पंजाब में कहते हैं, जिन्ने लाहौर नहीं वेख्या, ओ जम्या ई नहीं। यानी जिसने लाहौर नहीं देखा, उसने कुछ नहीं देखा।')
]);
const topicPatterns:readonly [ShareTopic,RegExp][]=[
 ['poetry',/शेर|शायरी|कविता|दोहा|ग़ालिब|गालिब|कबीर|रहीम|\b(?:poem|poetry|shayari)\b/iu],
 ['cricket',/क्रिकेट|टेस्ट मैच|विश्व कप|वर्ल्ड कप|कोहली|विराट|रोहित|धोनी|सचिन|शुभमन|कपिल देव|गावस्कर|\bcricket\b/iu],
 ['railway',/रेल|ट्रेन|स्टेशन|गार्ड|फ्रंटियर|इंजन|\b(?:railway|train)\b/iu],
 ['films',/फ़िल्म|फिल्म|सिनेमा|पिक्चर|राज कपूर|देव आनंद|दिलीप कुमार|अमिताभ|किशोर|रफ़ी|रफी|मुकेश|आवारा|\b(?:film|movie)\b/iu],
 ['music',/भजन|संगीत|रेडियो|गाना|गाने|गीत|लता|\b(?:music|radio|song)\b/iu],
 ['plants',/पौध|तुलसी|गमल|बगीच|बागवानी|फूल|मनी प्लांट|\b(?:plant|garden)\b/iu],
 ['cooking',/खाना बना|पकाना|पकाती|रसोई|बाटी|चूरमा|साग|अचार|मिठाई|पराठ|परांठ|हलवा|खिचड़ी|\b(?:cook|recipe)\b/iu],
 ['walking',/सैर|टहल|घूमने गय|घूमने जा|\bwalk/iu],
 ['family',/पोते|पोती|नाती|नातिन|पोता|\b(?:grandchild|grandson|granddaughter)/iu],
 ['punjab',/अमृतसर|पंजाब|गुरुद्वारा|लंगर|लाहौर/iu]
];
/** Every topic named in the text, in a fixed priority order. */
export function topicsIn(text:string):ShareTopic[]{const normal=text.normalize('NFKC');return topicPatterns.filter(([,pattern])=>pattern.test(normal)||pattern.test(text)).map(([topic])=>topic);}
/** First unused item for the first topic that still has one. */
export function selectTopicShare(topics:readonly ShareTopic[],used:readonly string[]=[]):ShareItem|undefined{
 for(const topic of topics){const found=topicBank.find(entry=>entry.topic===topic&&!used.includes(entry.id));if(found)return found;}
 return undefined;
}

const byId=new Map([...shareBank,...topicBank].map(entry=>[entry.id,entry]));
export function shareById(id:string):ShareItem|undefined{return byId.get(id);}

// Same boundaries as the spoken-reply sentence limit.
const singleSentence=(text:string)=>text.replace(/(?<=\p{N})\.(?=\p{N})/gu,'').replace(/(?:डॉ|श्री)\.(?=\s)/gu,'title').split(/[.!?।॥]+/u).filter(part=>/[\p{L}\p{N}]/u.test(part)).length===1;
const rotate=<T,>(list:T[],by:number)=>list.length?[...list.slice(by%list.length),...list.slice(0,by%list.length)]:list;

/** Deterministic: the person's local date and hour and the session's share
 * count pick the item. Non-religious seasonal items for the month come first,
 * then general items, then religious festival items for the month, so
 * consecutive counts never repeat until every eligible item has been used. */
export function selectShare(date:string|undefined,count:number,brief=false,hour?:number):ShareItem{
 const match=/^\d{4}-(\d{2})-(\d{2})$/u.exec(date??'');
 const month=match?Number(match[1]):0,day=match&&month>=1&&month<=12?Number(match[2]):0;
 const seasonal=day?shareBank.filter(entry=>entry.months?.includes(month)):[];
 const general=shareBank.filter(entry=>!entry.months);
 // The hour makes separate sessions on one day start differently.
 const seed=day+(typeof hour==='number'&&Number.isInteger(hour)&&hour>=0&&hour<=23?hour:0);
 const all=[...rotate(seasonal.filter(entry=>!entry.religious),seed),...rotate(general,seed),...rotate(seasonal.filter(entry=>entry.religious),seed)];
 const short=all.filter(entry=>singleSentence(entry.text));
 const eligible=brief&&short.length?short:all;
 const index=Number.isSafeInteger(count)&&count>0?count%eligible.length:0;
 return eligible[index];
}

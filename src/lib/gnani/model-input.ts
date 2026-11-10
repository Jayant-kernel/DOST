// Structural literals in the pinned Evon tokenizer (revision fb9ddb6b...),
// including thinking/tool tags marked special:false and reserved IDs 18–999.
const modelMarkers=/<\|(?:im_start|im_end|file_sep)\|>|<\/?(?:s|think|tool_call|tool_response)>|<unk>|<SPECIAL_(?:1[89]|[2-9]\d|[1-9]\d{2})>|\[\/?(?:INST|AVAILABLE_TOOLS|TOOL_RESULTS)\]|\[TOOL_CALLS\]/g;

// Apply to message DATA before rendering, never to the rendered chat template.
// Do not decode these entities before tokenization. This prevents literal
// control-token injection; it does not make instructions inside data trustworthy.
export function escapeModelData(text:string):string{
 return text.replace(modelMarkers,marker=>marker.startsWith('<')
  ?`&lt;${marker.slice(1,-1)}&gt;`
  :`&#91;${marker.slice(1,-1)}&#93;`);
}

// Public fixed UI copy only. Never display raw rejected model output.
export function recoveryStatus(reason:string|null,detail:string|null){
 if(reason==='timeout')return 'Saathi took too long to prepare a reply. You can keep speaking.';
 if(reason==='quality'){
  if(detail==='repetitive-reply')return 'Your words were received, but Saathi generated a repeated reply. You can keep speaking.';
  if(detail==='incomplete-answer'||detail==='invalid-stream')return 'Your words were received, but Saathi did not complete its reply. You can keep speaking.';
  return 'Your words were received, but Saathi could not produce a suitable reply. You can keep speaking.';
 }
 if(reason==='unavailable')return 'Your words were received, but the local reasoning service could not respond. You can keep speaking.';
 return 'Saathi could not prepare a clear reply. You can keep speaking.';
}

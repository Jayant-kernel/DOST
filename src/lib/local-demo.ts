import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export function localDemoAllowed(request:Request){
 const host=request.headers.get('host')??'',origin=request.headers.get('origin');
 return process.env.NODE_ENV!=='production'&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)&&
  (origin===`http://${host}`||(request.method==='GET'&&!origin&&request.headers.get('sec-fetch-site')!=='cross-site'));
}
export function ownerId(request:Request){
 const token=/(?:^|;\s*)saathi_profile=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie')??'')?.[1];
 return token?createHash('sha256').update(token).digest('hex'):null;
}
export function selectionToken(owner:string,person:string){
 const secret=process.env.SESSION_SIGNING_SECRET;if(!secret)throw Error('Session signing unavailable');
 return person+'.'+createHmac('sha256',secret).update(owner+':'+person).digest('hex');
}
export function profileId(request:Request){
 const owner=ownerId(request);if(!owner)return null;
 const selected=/(?:^|;\s*)saathi_person=([a-f0-9]{64}\.[a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie')??'')?.[1];
 if(!selected)return owner;
 try{const expected=selectionToken(owner,selected.slice(0,64));return timingSafeEqual(Buffer.from(expected),Buffer.from(selected))?selected.slice(0,64):null;}catch{return null;}
}

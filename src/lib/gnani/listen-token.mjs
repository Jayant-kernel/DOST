import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export function issueListenToken(secret,origin,now=Date.now()){
 if(!secret||secret.length<32)throw Error('Voice signing unavailable');
 const payload=Buffer.from(JSON.stringify({origin,expires:now+30000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
export function verifyListenToken(secret,token,origin,now=Date.now()){
 try{
  if(!secret||secret.length<32||typeof token!=='string'||token.length>1024)return null;
  const [payload,signature,...rest]=token.split('.');if(rest.length||!signature)return null;
  const expected=createHmac('sha256',secret).update(payload).digest(),actual=Buffer.from(signature,'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  const value=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  if(value.origin!==origin||!Number.isSafeInteger(value.expires)||value.expires<=now||value.expires>now+30000||!/^[a-f0-9]{32}$/.test(value.nonce))return null;
  return value;
 }catch{return null;}
}

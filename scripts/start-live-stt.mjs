import {createLiveSttServer} from '../bridge/src/live-stt.mjs';
if(process.env.NODE_ENV==='production')throw Error('Local demo only');
const server=createLiveSttServer({secret:process.env.SESSION_SIGNING_SECRET,apiKey:process.env.GNANI_API_KEY,origin:'http://localhost:3000'});
server.listen(3001,'127.0.0.1',()=>console.log('Local Prisma microphone gateway listening on 127.0.0.1:3001'));

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { site, paths } from './src/config.mjs';
import { validateInquiry, saveInquiry, deliverInquiry } from './src/inquiries.mjs';
import { renderForm } from './src/form.mjs';
import { shell } from './src/render.mjs';
import { serveVideo } from './src/media.mjs';
import { readEncodedFile } from './src/encoding.mjs';
import { createHash } from 'node:crypto';

const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
export async function createServer(options={}) {
  const dist=options.dist||path.join(root,'dist');
  const manifest=JSON.parse(await readFile(path.join(dist,'manifest.json'),'utf8'));
  const inquiryDirectory=options.inquiryDirectory||path.resolve(root,process.env.INQUIRY_DATA_DIR||'.data/inquiries');
  const webhookUrl=options.webhookUrl??process.env.INQUIRY_WEBHOOK_URL;
  const webhookToken=options.webhookToken??process.env.INQUIRY_WEBHOOK_TOKEN;
  const rateLimit=Number(options.rateLimit??process.env.INQUIRY_RATE_LIMIT??8);
  if(!Number.isSafeInteger(rateLimit)||rateLimit<1)throw new Error('INQUIRY_RATE_LIMIT must be a positive integer.');
  const rates=new Map();
  const allowed=new Set(manifest.pages.map(p=>p.path));
  const pending=new Set();
  const server=http.createServer(async(req,res)=>{
    const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
    for(const [k,v]of Object.entries(headers))res.setHeader(k,v);
    if(!manifest.indexing)res.setHeader('X-Robots-Tag','noindex, nofollow');
    const send=(status,body,type='text/html; charset=utf-8',extra={})=>{res.writeHead(status,{'Content-Type':type,...extra});res.end(req.method==='HEAD'?undefined:body);};
    const fail=(status,message,errors={},values={})=>{
      const extra={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
      if(req.headers.accept?.includes('application/json'))send(status,JSON.stringify({saved:false,message,errors}),'application/json; charset=utf-8',extra);
      else send(status,shell({path:paths.contact,title:'Check Your Inquiry | Summit Custom Builders',description:message,noindex:true},`<div class="container"><header class="page-intro"><h1>Let’s check your request.</h1><p>${message}</p></header><div class="narrow">${renderForm(values,errors)}</div></div>`),undefined,extra);
    };
    try {
      const url=new URL(req.url,'http://localhost');
      let pathname;
      try {pathname=decodeURIComponent(url.pathname);}catch {send(400,'Invalid address.');return;}
      if(pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').some(p=>p==='..'||p==='.')||/%2f|%5c/i.test(url.pathname)){send(400,'Invalid address.');return;}
      // The homepage scrubber decodes same-origin video downloads as local Blobs.
      if(pathname==='/')res.setHeader('Content-Security-Policy',headers['Content-Security-Policy'].replace("media-src 'self'","media-src 'self' blob:"));
      if(pathname==='/api/inquiries') {
        if(req.method!=='POST'){send(405,'Method not allowed.','text/plain',{'Allow':'POST'});return;}
        if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||'')){fail(415,'Use the consultation form to send your request.');return;}
        const permittedOrigins=new Set([manifest.siteUrl,`http://127.0.0.1:${req.socket.localPort}`,`http://localhost:${req.socket.localPort}`,...(options.allowedOrigins||[])]);
        if(req.headers.origin&&!permittedOrigins.has(req.headers.origin)){fail(403,'Open the consultation form on this website before sending your request.');return;}
        if(req.headers['sec-fetch-site']==='cross-site'){fail(403,'Open the consultation form on this website before sending your request.');return;}
        if(!req.headers.origin&&req.headers.referer){let origin;try{origin=new URL(req.headers.referer).origin;}catch{}if(!permittedOrigins.has(origin)){fail(403,'Open the consultation form on this website before sending your request.');return;}}
        const ip=req.socket.remoteAddress||'unknown',now=Date.now();
        for(const [key,rate]of rates)if(now-rate.start>600000)rates.delete(key);
        const rate=rates.get(ip)||{start:now,count:0};rate.count++;rates.set(ip,rate);
        if(rate.count>rateLimit){res.setHeader('Retry-After','600');fail(429,'Too many requests. Please wait a few minutes or call 720-431-1056.');return;}
        let length=0;const chunks=[];
        for await(const chunk of req){length+=chunk.length;if(length>32768){fail(413,'The request is too long. Shorten the description and try again.');return;}chunks.push(chunk);}
        const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
        if([...new Set(params.keys())].some(key=>params.getAll(key).length>1)){fail(400,'Please reload the form and try again.');return;}
        const input=Object.fromEntries(params);
        if(input.website){fail(422,'Your request could not be recorded. Please call 720-431-1056.');return;}
        const {data,errors}=validateInquiry(input);
        if(Object.keys(errors).length){fail(422,'Please check the highlighted fields.',errors,input);return;}
        let record;
        try {record=await saveInquiry(data,inquiryDirectory);}catch {console.error('Inquiry storage failed.');fail(503,'Your request could not be recorded. Please try again or call 720-431-1056.');return;}
        const job=deliverInquiry(record,inquiryDirectory,{webhookUrl,webhookToken,fetchImpl:options.fetchImpl}).catch(()=>console.error('Inquiry delivery status could not be updated.')).finally(()=>pending.delete(job));pending.add(job);
        // Success is returned only after a durable write. Remote delivery can be retried.
        if(req.headers.accept?.includes('application/json'))send(201,JSON.stringify({saved:true,id:record.id}),'application/json; charset=utf-8',{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
        else send(303,'','text/plain',{'Location':paths.thanks,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
        return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){send(405,'Method not allowed.','text/plain',{'Allow':'GET, HEAD'});return;}
      if(pathname.startsWith('/.')){send(404,await readFile(path.join(dist,'404.html')));return;}
      const queryTarget=manifest.redirects[pathname+url.search];
      const normalized=pathname.endsWith('/')||path.extname(pathname)?pathname:pathname+'/';
      const target=queryTarget||manifest.redirects[normalized];
      if(target){send(301,'','text/plain',{'Location':target,'Cache-Control':'public, max-age=3600'});return;}
      if(pathname!==normalized&&allowed.has(normalized)){send(301,'','text/plain',{'Location':normalized+url.search});return;}
      let file;
      if(allowed.has(pathname))file=path.join(dist,pathname,'index.html');
      else if(/^\/assets\/(?:scroll-hero\/)?[a-z0-9.-]+$/.test(pathname)||['/robots.txt','/sitemap.xml'].includes(pathname))file=path.join(dist,pathname);
      else {send(404,await readFile(path.join(dist,'404.html')),undefined,{'X-Robots-Tag':'noindex, follow'});return;}
      if(path.extname(file)==='.mp4'&&await serveVideo(req,res,file))return;
      let body,encoding;try {({body,encoding}=await readEncodedFile(file,req.headers['accept-encoding']));}catch {send(404,await readFile(path.join(dist,'404.html')),undefined,{'X-Robots-Tag':'noindex, follow'});return;}
      const page=manifest.pages.find(p=>p.path===pathname);
      const versioned=manifest.assetRevisions?.[pathname]===url.searchParams.get('v');
      const cache=versioned?'public, max-age=31536000, immutable':pathname.startsWith('/assets/')&&manifest.indexing&&!/\.(css|js)$/.test(pathname)?'public, max-age=3600':'no-cache';
      const etag='"'+createHash('sha256').update(body).digest('hex').slice(0,16)+'"';
      const responseHeaders={'Cache-Control':cache,'ETag':etag,'Vary':'Accept-Encoding',...(encoding?{'Content-Encoding':encoding}:{}),...(page?.noindex?{'X-Robots-Tag':'noindex, follow'}:{})};
      if(req.headers['if-none-match']===etag){res.writeHead(304,responseHeaders);res.end();return;}
      send(200,body,mime[path.extname(file)]||'application/octet-stream',{...responseHeaders,'Content-Length':body.length});
    } catch {if(!res.headersSent)send(500,'The page could not be loaded. Please try again.','text/plain; charset=utf-8');else res.end();}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  server.drain=()=>Promise.allSettled([...pending]);
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=await createServer();
  const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
  server.listen(port,host,()=>{console.log(`Summit preview: http://${host}:${port}`);console.log(process.env.INQUIRY_WEBHOOK_URL?'Inquiry delivery configured.':'Inquiries are saved privately on this server. Configure delivery before public launch.');});
  const stop=()=>server.close(async()=>{await server.drain();process.exit(0);});
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}

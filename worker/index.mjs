import manifest from '../dist/manifest.json' with { type: 'json' };
import { paths } from '../src/config.mjs';
import { renderForm } from '../src/form.mjs';
import { validateInquiry } from '../src/inquiry-validation.mjs';
import { shell } from '../src/render.mjs';

const securityHeaders={
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};

function response(status,body,type='text/html; charset=utf-8',headers={}) {
  return new Response(body,{status,headers:{'Content-Type':type,...headers}});
}

function fail(request,status,message,errors={},values={}) {
  const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
  if((request.headers.get('accept')||'').includes('application/json'))return response(status,JSON.stringify({saved:false,message,errors}),'application/json; charset=utf-8',headers);
  const html=shell({path:paths.contact,title:'Check Your Inquiry | Summit Custom Builders',description:message,noindex:true},`<div class="container"><header class="page-intro"><h1>Let’s check your request.</h1><p>${message}</p></header><div class="narrow">${renderForm(values,errors)}</div></div>`);
  return response(status,html,undefined,headers);
}

async function fingerprint(request,env) {
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const bytes=new TextEncoder().encode(`${env.RATE_LIMIT_SALT||'preview'}:${ip}`);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

async function deliver(record,env) {
  if(!env.INQUIRY_WEBHOOK_URL)return;
  let status='failed',error='Delivery failed; retrieve the inquiry from D1.';
  try {
    const url=new URL(env.INQUIRY_WEBHOOK_URL);
    if(url.protocol!=='https:')throw new Error('Webhook must use HTTPS');
    const result=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':record.id,...(env.INQUIRY_WEBHOOK_TOKEN?{Authorization:`Bearer ${env.INQUIRY_WEBHOOK_TOKEN}`}:{})},body:JSON.stringify(record),signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!result.ok)throw new Error(`Webhook returned ${result.status}`);
    status='delivered';error=null;
  } catch (caught) {
    if(caught instanceof Error&&caught.message.startsWith('Webhook'))error=caught.message;
  }
  await env.INQUIRIES.prepare('UPDATE inquiries SET delivery_status = ?, delivery_error = ? WHERE id = ?').bind(status,error,record.id).run();
}

async function handleInquiry(request,env,ctx) {
  if(request.method!=='POST')return response(405,'Method not allowed.','text/plain; charset=utf-8',{Allow:'POST'});
  if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('content-type')||''))return fail(request,415,'Use the consultation form to send your request.');
  const requestUrl=new URL(request.url);
  const origin=request.headers.get('origin');
  if(origin&&origin!==requestUrl.origin)return fail(request,403,'Open the consultation form on this website before sending your request.');
  if(request.headers.get('sec-fetch-site')==='cross-site')return fail(request,403,'Open the consultation form on this website before sending your request.');
  const referer=request.headers.get('referer');
  if(!origin&&referer)try {if(new URL(referer).origin!==requestUrl.origin)return fail(request,403,'Open the consultation form on this website before sending your request.');}catch {return fail(request,403,'Open the consultation form on this website before sending your request.');}

  const body=await request.text();
  if(new TextEncoder().encode(body).length>32768)return fail(request,413,'The request is too long. Shorten the description and try again.');
  const params=new URLSearchParams(body);
  if([...new Set(params.keys())].some(key=>params.getAll(key).length>1))return fail(request,400,'Please reload the form and try again.');
  const input=Object.fromEntries(params);
  if(input.website)return fail(request,422,'Your request could not be recorded. Please call 720-431-1056.');
  const {data,errors}=validateInquiry(input);
  if(Object.keys(errors).length)return fail(request,422,'Please check the highlighted fields.',errors,input);

  const now=Date.now(),key=await fingerprint(request,env),windowStart=now-600000;
  await env.INQUIRIES.prepare('DELETE FROM inquiry_attempts WHERE attempted_at < ?').bind(windowStart).run();
  const rate=await env.INQUIRIES.prepare('SELECT COUNT(*) AS count FROM inquiry_attempts WHERE fingerprint = ? AND attempted_at >= ?').bind(key,windowStart).first();
  const limit=Number(env.INQUIRY_RATE_LIMIT||8);
  if(Number(rate?.count||0)>=limit)return fail(request,429,'Too many requests. Please wait a few minutes or call 720-431-1056.',{},input);
  await env.INQUIRIES.prepare('INSERT INTO inquiry_attempts (fingerprint, attempted_at) VALUES (?, ?)').bind(key,now).run();

  const record={id:crypto.randomUUID(),receivedAt:new Date(now).toISOString(),...data};
  const deliveryStatus=env.INQUIRY_WEBHOOK_URL?'pending':'stored';
  try {
    await env.INQUIRIES.prepare(`INSERT INTO inquiries
      (id, received_at, name, email, phone, city, service, timing, message, landing_path, referring_host, channel, delivery_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(record.id,record.receivedAt,record.name,record.email,record.phone,record.city,record.service,record.timing,record.message,record.landingPath,record.referringHost,record.channel,deliveryStatus).run();
  } catch {
    return fail(request,503,'Your request could not be recorded. Please try again or call 720-431-1056.',{},input);
  }
  if(env.INQUIRY_WEBHOOK_URL)ctx.waitUntil(deliver(record,env));
  if((request.headers.get('accept')||'').includes('application/json'))return response(201,JSON.stringify({saved:true,id:record.id}),'application/json; charset=utf-8',{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
  return response(303,'','text/plain; charset=utf-8',{Location:paths.thanks,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
}

function applyHeaders(request,assetResponse) {
  const url=new URL(request.url),headers=new Headers(assetResponse.headers);
  for(const [name,value] of Object.entries(securityHeaders))headers.set(name,value);
  if(url.hostname.endsWith('.workers.dev')||!manifest.indexing)headers.set('X-Robots-Tag','noindex, nofollow');
  const revision=manifest.assetRevisions?.[url.pathname];
  if(revision&&url.searchParams.get('v')===revision)headers.set('Cache-Control','public, max-age=31536000, immutable');
  else if(url.pathname.startsWith('/assets/')&&!/\.(?:css|js)$/.test(url.pathname))headers.set('Cache-Control','public, max-age=3600');
  else headers.set('Cache-Control','no-cache');
  return new Response(assetResponse.body,{status:assetResponse.status,statusText:assetResponse.statusText,headers});
}

export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url);
    if(url.pathname==='/api/inquiries')return handleInquiry(request,env,ctx);
    const redirect=manifest.redirects[url.pathname+url.search]||manifest.redirects[url.pathname];
    if(redirect)return Response.redirect(new URL(redirect,url.origin),301);
    return applyHeaders(request,await env.ASSETS.fetch(request));
  }
};

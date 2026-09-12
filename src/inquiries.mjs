import { mkdir, open, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { services } from './content/services.mjs';
import { cities } from './content/cities.mjs';

export function validateInquiry(input) {
  const clean=key=>typeof input[key]==='string'?input[key].trim():'';
  const data=Object.fromEntries(['name','email','phone','city','service','timing','message','landingPath','referringHost'].map(k=>[k,clean(k)]));
  const errors={};
  if(!data.name||data.name.length>100)errors.name='Enter your name (up to 100 characters).';
  if(data.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))errors.email='Enter a valid email address.';
  if(data.phone&&(!/^[+\d\s().-]{7,32}$/.test(data.phone)||data.phone.replace(/\D/g,'').length<7))errors.phone='Enter a phone number, or leave this field empty.';
  if(![...cities.map(c=>c.id),'unsure'].includes(data.city))errors.city='Choose the project city or “Not sure about jurisdiction.”';
  if(![...services.map(s=>s.id),'unsure'].includes(data.service))errors.service='Choose the project type or “Help me choose.”';
  if(data.timing.length>150)errors.timing='Keep timing information under 150 characters.';
  if(data.message.length<20||data.message.length>5000)errors.message='Describe the project in 20–5,000 characters.';
  for(const k of ['name','email','phone','timing'])if(/[\x00-\x1f\x7f]/.test(data[k]))errors[k]='Remove control characters from this field.';
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(data.message))errors.message='Remove control characters from the description.';
  if(!/^\/(?:[a-z0-9-]+\/)*$/.test(data.landingPath))data.landingPath='';
  if(!/^[a-z0-9.-]{0,253}$/i.test(data.referringHost))data.referringHost='';
  data.referringHost=data.referringHost.toLowerCase();
  data.channel=/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(data.referringHost)?'organic':data.referringHost?'referral':'direct-or-unknown';
  return {data,errors};
}

export async function saveInquiry(data,directory) {
  await mkdir(directory,{recursive:true,mode:0o700});
  const record={id:randomUUID(),receivedAt:new Date().toISOString(),...data,delivery:{status:'pending'}};
  const file=path.join(directory,record.id+'.json');
  const handle=await open(file,'wx',0o600);
  try {await handle.writeFile(JSON.stringify(record,null,2));await handle.sync();}
  catch(error) {await unlink(file).catch(()=>{});throw error;}
  finally {await handle.close();}
  return record;
}

async function writeRecord(record,directory) {
  const file=path.join(directory,record.id+'.json');const temp=file+'.'+randomUUID()+'.tmp';
  await writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});await rename(temp,file);
}

export async function deliverInquiry(record,directory,{webhookUrl,webhookToken,fetchImpl=fetch}={}) {
  if(!webhookUrl) {record.delivery={status:'stored-locally',updatedAt:new Date().toISOString()};await writeRecord(record,directory);return false;}
  try {
    const url=new URL(webhookUrl);
    if(url.protocol!=='https:')throw new Error('Webhook must use HTTPS');
    const response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':record.id,...(webhookToken?{Authorization:`Bearer ${webhookToken}`}:{})},body:JSON.stringify(record),signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!response.ok)throw new Error('Webhook returned '+response.status);
    record.delivery={status:'delivered',updatedAt:new Date().toISOString()};
  } catch(error) {
    record.delivery={status:'failed',updatedAt:new Date().toISOString(),error:error.message.startsWith('Webhook')?error.message:'Delivery failed; retry from the private inbox.'};
  }
  await writeRecord(record,directory);return record.delivery.status==='delivered';
}

export async function readInquiries(directory) {
  let files;try {files=await readdir(directory);}catch(e){if(e.code==='ENOENT')return [];throw e;}
  return Promise.all(files.filter(f=>/^[a-f0-9-]+\.json$/.test(f)).map(async f=>JSON.parse(await readFile(path.join(directory,f),'utf8'))));
}

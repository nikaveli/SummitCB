import { mkdir, open, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { validateInquiry } from './inquiry-validation.mjs';

export { validateInquiry };

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

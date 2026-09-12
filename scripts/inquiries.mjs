import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInquiries, deliverInquiry } from '../src/inquiries.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.resolve(root,process.env.INQUIRY_DATA_DIR||'.data/inquiries');
const records=(await readInquiries(directory)).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt));
if(process.argv.includes('--retry')) {
  if(!process.env.INQUIRY_WEBHOOK_URL)throw new Error('Set INQUIRY_WEBHOOK_URL before retrying delivery.');
  for(const record of records.filter(r=>r.delivery.status!=='delivered')){await deliverInquiry(record,directory,{webhookUrl:process.env.INQUIRY_WEBHOOK_URL,webhookToken:process.env.INQUIRY_WEBHOOK_TOKEN});console.log(record.id,record.delivery.status);}
} else if(process.argv.includes('--details')) {
  // Explicit local inbox command; never exposed as a public HTTP route.
  console.log(JSON.stringify(records,null,2));
} else {
  const grouped={};
  for(const r of records){const key=[r.service,r.city,r.channel].join(' / ');grouped[key]=(grouped[key]||0)+1;}
  console.log(JSON.stringify({total:records.length,awaitingDelivery:records.filter(r=>r.delivery.status!=='delivered').length,byServiceCityChannel:grouped},null,2));
  console.log('Use --details to view the private local inbox, or --retry to resend pending deliveries.');
}

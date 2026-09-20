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

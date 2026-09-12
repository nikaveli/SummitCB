import { readFile } from 'node:fs/promises';

export async function readEncodedFile(file,acceptEncoding='') {
  if(/\.(html|css|js|xml|txt)$/.test(file)) {
    const accepted=new Map(String(acceptEncoding).toLowerCase().split(',').map(part=>{
      const [name,...params]=part.trim().split(';');const q=params.map(p=>p.trim()).find(p=>p.startsWith('q='));
      return [name,q?Number(q.slice(2)):1];
    }));
    const candidates=['br','gzip'].map(name=>({name,q:accepted.get(name)??accepted.get('*')??0})).filter(x=>x.q>0&&x.q<=1).sort((a,b)=>b.q-a.q);
    for(const {name} of candidates)try{return {body:await readFile(file+(name==='br'?'.br':'.gz')),encoding:name};}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return {body:await readFile(file),encoding:null};
}

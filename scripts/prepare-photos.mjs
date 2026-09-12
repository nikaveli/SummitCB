import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { photos } from '../src/photos.mjs';
// Optional authoring tool. Optimized files are checked in; normal builds need no image library.
const sharp=(await import(process.env.SHARP_MODULE||'sharp')).default;
const root=fileURLToPath(new URL('../',import.meta.url));
const input=path.join(root,'website images/Website Images Assets');
const output=path.join(root,'public/assets');
await mkdir(output,{recursive:true});
const report=[];
for(const p of Object.values(photos)) {
  const from=path.join(input,p.file+'-4k-16x9.jpg');
  const original=await stat(from);const metadata=await sharp(from).metadata();
  if(metadata.width!==3840||metadata.height!==2160)throw new Error('Unexpected source dimensions: '+from);
  const files=[];
  for(const width of [480,800,1280,1920]) {
    const name=p.file+'-'+width+'.webp';
    await sharp(from).rotate().resize({width,withoutEnlargement:true}).webp({quality:82,effort:4}).toFile(path.join(output,name));
    files.push({name,width,bytes:(await stat(path.join(output,name))).size});
  }
  const name=p.file+'-1280.jpg';
  await sharp(from).rotate().resize({width:1280,withoutEnlargement:true}).jpeg({quality:84,mozjpeg:true}).toFile(path.join(output,name));
  files.push({name,width:1280,bytes:(await stat(path.join(output,name))).size});
  report.push({id:p.id,source:path.relative(root,from),originalBytes:original.size,alt:p.alt,files});
}
await writeFile(path.join(root,'data/photo-assets.json'),JSON.stringify(report,null,2));
console.log(`Prepared ${report.length} photos in four WebP widths plus JPEG fallbacks. Source files preserved.`);

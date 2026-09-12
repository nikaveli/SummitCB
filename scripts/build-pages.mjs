import { readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const siteUrl=(process.env.PAGES_URL || 'https://nikaveli.github.io/SummitCB').replace(/\/$/,'');
const base=new URL(siteUrl).pathname.replace(/\/$/,'');
if(!/^https:\/\//.test(siteUrl)||!/^\/[a-zA-Z0-9_/-]*$|^$/.test(base))throw new Error('PAGES_URL must be an HTTPS site URL with a simple path.');
const out=path.join(root,'dist-pages');
const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,SITE_URL:siteUrl,PUBLIC_INDEXING:'false',BUILD_DIR:'dist-pages',WRITE_REPORTS:'false'}});
if(build.status!==0)process.exit(build.status || 1);
const prefix=url=>url.startsWith('/')&&!url.startsWith('//')?base+url:url;
const phoneContact=`<div class="prose"><p class="eyebrow">Let’s talk about your home</p><h2>A good project starts with a conversation.</h2><p>Tell us about your space, the changes you have in mind, and your timing. We’ll help you work through the next steps.</p><a class="button" href="tel:+17204311056">Call 720-431-1056 <span aria-hidden="true">↗</span></a></div>`;
async function walk(dir){const all=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())all.push(...await walk(file));else all.push(file);}return all;}
for(const file of await walk(out)){
  // Pages negotiates compression itself. Do not publish sidecars for the Node server.
  if(/\.(br|gz)$/.test(file)||path.basename(file)==='.DS_Store'){await rm(file);continue;}
  if(!/\.(html|css|js)$/.test(file))continue;
  let text=await readFile(file,'utf8');
  if(file.endsWith('.html')){
    // A static deployment has no inquiry endpoint: offer a real contact action.
    text=text.replace(/<form\b[^>]*id="consultation-form"[^>]*>[\s\S]*?<\/form>/g,phoneContact)
      .replace('Call 720-431-1056 or send a project inquiry.','Call 720-431-1056 to discuss your project.')
      .replace('<h3>Before you send</h3>','<h3>Before we talk</h3>')
      .replace('Include the city and the spaces involved.','Have the city and the spaces involved in mind.')
      .replace('Core content and the consultation form are available without JavaScript.','Core content and telephone contact links are available without JavaScript.')
      .replace('You can also use the contact form if it is accessible to you.','You can also visit the contact page for our telephone number and address.');
    if(file===path.join(out,'privacy-policy/index.html')){
      text=text.replace(/<div class="prose narrow">[\s\S]*?<\/div>/,`<div class="prose narrow"><h2>Contacting Summit</h2><p>This preview provides telephone contact links. It does not collect or submit project inquiry forms.</p><h2>Browser storage and hosting</h2><p>When available, session storage remembers the first page visited and the referring website’s hostname during your visit. This preview does not send that information to an inquiry service or load advertising trackers. Hosting infrastructure may maintain access logs.</p><h2>Questions</h2><p>Call <a href="tel:+17204311056">720-431-1056</a> with questions about information you have shared with Summit. Linked websites have their own privacy practices.</p></div>`);
    }
    // Rewrite URL attributes, including every candidate in responsive image sets.
    text=text.replace(/\b(href|src|poster|action|data-small|data-large|data-src|data-poster)="(\/(?!\/)[^"]*)"/g,(_,attr,url)=>`${attr}="${prefix(url)}"`)
      .replace(/\b(srcset|data-srcset)="([^"]*)"/g,(_,attr,urls)=>`${attr}="${urls.split(',').map(candidate=>candidate.replace(/^(\s*)(\/\S+)/,(_,space,url)=>space+prefix(url))).join(',')}"`);
  }
  if(file.endsWith('.js'))text=text.replace(/(['"`])\/(assets\/|thank-you\/)/g,(_,quote,part)=>quote+base+'/'+part);
  if(file.endsWith('.css'))text=text.replace(/url\((['"]?)(\/(?!\/)[^)'"\s]+)\1\)/g,(_,quote,url)=>`url(${quote}${prefix(url)}${quote})`);
  await writeFile(file,text);
}
const manifest=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
// Preserve useful legacy navigation aliases on static hosting (query redirects require Node).
for(const [from,to] of Object.entries(manifest.redirects)){
  if(!from.endsWith('/')||from.includes('?'))continue;
  const dir=path.join(out,from);await mkdir(dir,{recursive:true});
  const destination=prefix(to);
  await writeFile(path.join(dir,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${destination}"><title>Continue to Summit Custom Builders</title><link rel="canonical" href="${siteUrl+to}"></head><body><a href="${destination}">Continue to Summit Custom Builders</a></body></html>`);
}
// A form confirmation is not a meaningful destination on this static preview.
await writeFile(path.join(out,'thank-you/index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${prefix('/contact/')}"><title>Contact Summit Custom Builders</title></head><body><a href="${prefix('/contact/')}">Contact Summit Custom Builders</a></body></html>`);
await writeFile(path.join(out,'.nojekyll'),'');
console.log(`GitHub Pages preview ready: ${siteUrl}/`);

import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';

// Stream public films without buffering the whole file; support native browser seeking.
export async function serveVideo(req,res,file) {
  let info;try{info=await stat(file);}catch(error){if(error.code==='ENOENT')return false;throw error;}
  if(!info.isFile())return false;
  const size=info.size,etag='"'+path.basename(file)+'"';
  const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','ETag':etag,'Last-Modified':info.mtime.toUTCString(),'Cache-Control':/\-[a-f0-9]{12}\.mp4$/.test(file)?'public, max-age=31536000, immutable':'public, max-age=3600'};
  if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return true;}
  const range=req.method==='GET'&&(!req.headers['if-range']||req.headers['if-range']===etag)?req.headers.range:null;
  let start=0,end=size-1,status=200;
  if(range) {
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    let valid=!!match&&!!(match[1]||match[2]);
    if(valid) {
      if(!match[1]) {const suffix=Number(match[2]);valid=Number.isSafeInteger(suffix)&&suffix>0;start=Math.max(0,size-suffix);}
      else {start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;valid=Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start;}
    }
    if(!valid){res.writeHead(416,{...headers,'Content-Range':`bytes */${size}`,'Content-Length':'0'});res.end();return true;}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length']=String(end-start+1);
  res.writeHead(status,headers);
  if(req.method==='HEAD'){res.end();return true;}
  const stream=createReadStream(file,{start,end});
  res.once('close',()=>stream.destroy());stream.once('error',()=>res.destroy());stream.pipe(res);
  return true;
}

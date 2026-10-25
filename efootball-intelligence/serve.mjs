import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};

http.createServer(async(request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'}).end('Method not allowed');return;}
  let pathname;
  try { pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request');return; }
  const target=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(target!==root&&!target.startsWith(`${root}${path.sep}`)){response.writeHead(403).end('Forbidden');return;}
  try {
    const body=await readFile(target);
    response.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
    response.end(request.method==='HEAD'?undefined:body);
  } catch { response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found'); }
}).listen(port,'127.0.0.1',()=>console.log(`Touchline Lab: http://127.0.0.1:${port}`));


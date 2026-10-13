import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), api=require('../api/tmdb.js');
const root=path.resolve('public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/tmdb'){
   if (!process.env.TMDB_READ_TOKEN) {
     try { const upstream=await fetch('https://carimarshow-native.vercel.app/api/tmdb'+url.search,{signal:AbortSignal.timeout(10000)}); res.writeHead(upstream.status,{'Content-Type':'application/json'}); return res.end(await upstream.text()); } catch { res.writeHead(502); return res.end(JSON.stringify({error:'Sin conexión al proxy'})); }
   }
   req.query=Object.fromEntries(url.searchParams);res.status=code=>{res.statusCode=code;return res};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return res};await api(req,res);return;
 }
 try{
  let p=decodeURIComponent(url.pathname);if(p==='/')p='/index.html'; else if(p==='/app'||p==='/app/')p='/app/index.html';
  const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('No encontrado')}
}).listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log(`CarimarShow lista en el puerto ${process.env.PORT||8080}`));

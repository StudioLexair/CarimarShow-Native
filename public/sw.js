const SHELL='carimarshow-shell-v1.0.1-r2', DATA='carimarshow-data-v1';
const CORE=['/','/index.html','/styles.css','/app.js','/config.js','/catalog-snapshot.json','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png'];
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const cache=await caches.open(SHELL); await cache.addAll(CORE);
 const snapshot=await (await cache.match('/catalog-snapshot.json')).json();
 await cache.addAll([...new Set(Object.values(snapshot.images||{}))].map(p=>'/'+p));
 await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('carimarshow-shell-')&&k!==SHELL)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
 e.respondWith((async()=>{
  const cache=await caches.open(SHELL);
  if(e.request.mode==='navigate') {try {const r=await fetch(e.request);if(r.ok)return r;}catch{}return await cache.match('/index.html');}
  const saved=await cache.match(e.request,{ignoreSearch:true});if(saved)return saved;
  return fetch(e.request);
 })());
});

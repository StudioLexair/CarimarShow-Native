// Genera el catálogo incluido. Requiere TMDB_READ_TOKEN en el entorno.
import fs from 'node:fs/promises';
import path from 'node:path';
const token=process.env.TMDB_READ_TOKEN;
if(!token)throw new Error('Configura TMDB_READ_TOKEN en el entorno.');
const snapshot={generatedAt:new Date().toISOString(),catalog:[],details:{},people:{},images:{}};
async function api(p){const r=await fetch('https://api.themoviedb.org/3/'+p+(p.includes('?')?'&':'?')+'language=es-ES&include_adult=false',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`TMDB: ${r.status}`);return r.json()}
async function pool(items,fn,n=5){let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const item=items[i++];await fn(item)}}))}
const trending=await api('trending/all/week'),movies=await api('movie/popular'),tv=await api('tv/popular');
const seen=new Set();
for(const item of [...trending.results,...movies.results.map(m=>({...m,media_type:'movie'})),...tv.results.map(m=>({...m,media_type:'tv'}))]){const k=`${item.media_type}/${item.id}`;if(item.media_type==='person'||item.adult||seen.has(k))continue;seen.add(k);snapshot.catalog.push(item)}
snapshot.catalog=snapshot.catalog.slice(0,50);
await pool(snapshot.catalog,async m=>{const k=`${m.media_type}/${m.id}`;snapshot.details[k]=await api(`${k}?append_to_response=credits,videos`)});
const actors=[...new Map(Object.values(snapshot.details).flatMap(d=>(d.credits?.cast||[]).slice(0,2)).map(p=>[p.id,p])).values()].slice(0,10);
await pool(actors,async p=>{snapshot.people[`person/${p.id}`]=await api(`person/${p.id}`);snapshot.people[`person/${p.id}/combined_credits`]=await api(`person/${p.id}/combined_credits`)});
const images=snapshot.catalog.filter(m=>m.poster_path).map(m=>['w342',m.poster_path]);
images.push(...snapshot.catalog.slice(0,6).filter(m=>m.backdrop_path).map(m=>['w780',m.backdrop_path]));
images.push(...actors.filter(p=>p.profile_path).map(p=>['w185',p.profile_path]));
await fs.mkdir('public/posters',{recursive:true});
await pool(images,async([size,p])=>{const filename='posters/'+size+'-'+path.basename(p);const r=await fetch(`https://image.tmdb.org/t/p/${size}${p}`,{signal:AbortSignal.timeout(20000)});if(r.ok){await fs.writeFile('public/'+filename,Buffer.from(await r.arrayBuffer()));snapshot.images[size+p]=filename}});
await fs.writeFile('public/catalog-snapshot.json',JSON.stringify(snapshot));
console.log(`Catálogo incluido: ${snapshot.catalog.length} títulos, ${Object.keys(snapshot.details).length} fichas, ${actors.length} actores, ${Object.keys(snapshot.images).length} imágenes.`);

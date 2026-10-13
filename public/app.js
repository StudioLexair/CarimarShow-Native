'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title = m => m.title || m.name || 'Sin título';
const kind = m => m.media_type === 'tv' || m.first_air_date ? 'tv' : 'movie';
const year = m => (m.release_date || m.first_air_date || '').slice(0,4) || '—';
const stars = m => Number(m.vote_average || 0).toFixed(1);
const keyOf = m => `${kind(m)}:${m.id}`;
const view = $('#view');
let seed = { catalog: [], details: {}, people: {}, images: {}, generatedAt: '' };
let currentPage = 1, installPrompt, routeRevision = 0, searchRevision = 0;
let list;
try { list = JSON.parse(localStorage.getItem('cs_list_v1') || '[]'); if (!Array.isArray(list)) list = []; } catch { list = []; }
const dbPromise = new Promise(resolve => {
  if (!window.indexedDB) return resolve(null);
  const req = indexedDB.open('carimarshow-offline', 1);
  req.onupgradeneeded = () => { req.result.createObjectStore('api'); req.result.createObjectStore('images'); };
  req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null);
});
async function storeGet(store, key) {
  const db = await dbPromise; if (!db) return null;
  return new Promise(resolve => { try { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); } catch { resolve(null); } });
}
async function storePut(store, key, value) {
  const db = await dbPromise; if (!db) return;
  return new Promise(resolve => {
    try { const tx = db.transaction(store, 'readwrite'); const s = tx.objectStore(store); s.put(value,key);
      // Mantener el almacenamiento acotado. La lista personal no se borra.
      const r = s.getAllKeys(); r.onsuccess = () => { const limit = store === 'images' ? 100 : 250; for (const k of r.result.slice(0, Math.max(0, r.result.length-limit))) s.delete(k); };
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    } catch { resolve(); }
  });
}
function toast(msg) { $('#toast').textContent=msg; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3200); }
function updateCount() { $('#listCount').textContent=list.length; document.querySelectorAll('[data-save]').forEach(b => { const saved=list.some(m=>keyOf(m)===b.dataset.save); b.classList.toggle('saved',saved); b.textContent=saved?'♥':'♡'; b.setAttribute('aria-label',saved?'Quitar de mi lista':'Guardar en mi lista'); }); }
function toggleSave(m) {
  const k=keyOf(m), exists=list.some(x=>keyOf(x)===k);
  const next=exists?list.filter(x=>keyOf(x)!==k):[...list,{...m,media_type:kind(m)}];
  try { localStorage.setItem('cs_list_v1',JSON.stringify(next)); list=next; updateCount(); toast(exists?'Quitado de tu lista':'Guardado en tu lista'); }
  catch { toast('No hay espacio para guardar. Borra la caché desde Ajustes.'); }
}
function seedFallback(path, params) {
  if (seed.details[path]) return seed.details[path];
  if (seed.people[path]) return seed.people[path];
  if (/^search\//.test(path)) {
    const q=(params.query||'').toLocaleLowerCase('es'); const type=path.split('/')[1];
    let found=seed.catalog.filter(m=>title(m).toLocaleLowerCase('es').includes(q));
    if (type==='movie'||type==='tv') found=found.filter(m=>kind(m)===type);
    const people=Object.values(seed.people).filter(p=>p.id&&p.name&&p.name.toLocaleLowerCase('es').includes(q)).map(p=>({...p,media_type:'person'}));
    return {results:type==='person'?people:type==='multi'?[...found,...people]:found,total_pages:1,_offline:true};
  }
  if (/^(trending|movie\/popular|movie\/top_rated|movie\/now_playing|tv\/popular|tv\/top_rated|tv\/on_the_air)/.test(path)) {
    if(Number(params.page||1)>1) return {results:[],total_pages:1,_offline:true};
    const wanted=path.startsWith('movie/')?'movie':path.startsWith('tv/')?'tv':null;
    return {results:seed.catalog.filter(m=>!wanted||kind(m)===wanted),total_pages:1,_offline:true};
  }
  return null;
}
async function api(path, params={}) {
  const query=new URLSearchParams({path,...params}), key=query.toString();
  if(navigator.onLine) {
    const ctl=new AbortController(), timeout=setTimeout(()=>ctl.abort(),8500);
    try {
      const r=await fetch(`${window.CARIMAR_CONFIG.apiOrigin}/api/tmdb?${query}`,{signal:ctl.signal});
      if(!r.ok) throw new Error('TMDB no disponible');
      const data=await r.json(); await storePut('api',key,data); return data;
    } catch {} finally { clearTimeout(timeout); }
  }
  const cached=await storeGet('api',key); if(cached) return {...cached,_offline:true};
  const fallback=seedFallback(path,params); if(fallback) return {...fallback,_offline:true};
  throw new Error('Esta información aún no está guardada. Conéctate a internet para consultarla.');
}
const placeholder='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#254655"/><stop offset="1" stop-color="#16222e"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" text-anchor="middle" fill="#7eb7c4" font-family="sans-serif" font-size="22">CarimarShow</text></svg>');
function image(path, size='w342', alt='', cls='poster') {
  if(!path || !/^\/[\w.-]+$/.test(path)) return `<img class="${esc(cls)}" src="${placeholder}" alt="${esc(alt)}">`;
  const bundled=seed.images[`${size}${path}`];
  return `<img class="${esc(cls)}" ${cls==='hero-image'||cls==='detail-backdrop'?'':'loading="lazy"'} src="${bundled ? '/'+esc(bundled) : placeholder}" data-image="${esc(size+path)}" data-bundled="${bundled?'1':''}" alt="${esc(alt)}">`;
}
const objectUrls=new Set();
let imageObserver;
async function hydrateImage(img) {
  if(img.dataset.loaded) return; img.dataset.loaded='1';
  const key=img.dataset.image; const cached=await storeGet('images',key);
  if(cached instanceof Blob) { const url=URL.createObjectURL(cached); objectUrls.add(url); if(img.isConnected) img.src=url; return; }
  if(!navigator.onLine || img.dataset.bundled) return;
  try {
    const r=await fetch('https://image.tmdb.org/t/p/'+key,{signal:AbortSignal.timeout(12000)});
    if(!r.ok) return; const blob=await r.blob(); if(!blob.type.startsWith('image/') || blob.size>3000000) return;
    await storePut('images',key,blob);
    if(img.isConnected) { const url=URL.createObjectURL(blob); objectUrls.add(url); img.src=url; }
  } catch {}
}
function hydrate() {
  if(imageObserver) imageObserver.disconnect();
  imageObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){hydrateImage(e.target);imageObserver.unobserve(e.target)}}),{rootMargin:'200px'});
  document.querySelectorAll('[data-image]').forEach(img=>imageObserver.observe(img)); updateCount();
}
function setView(html) { for(const u of objectUrls) URL.revokeObjectURL(u); objectUrls.clear(); view.innerHTML=html; hydrate(); }
function cards(items) {
  return `<div class="cards">${items.map(m=>m.media_type==='person'?personCard(m):`<article class="card"><div class="poster-wrap"><a class="poster-link" href="#detail/${kind(m)}/${m.id}" aria-label="Ver ${esc(title(m))}">${image(m.poster_path,'w342',title(m))}</a><span class="score">★ ${stars(m)}</span><button class="save" data-save="${keyOf(m)}" aria-label="Guardar en mi lista">♡</button></div><h3><a href="#detail/${kind(m)}/${m.id}">${esc(title(m))}</a></h3><div class="card-meta"><span>${year(m)}</span><span class="type">${kind(m)==='tv'?'SERIE':'PELÍCULA'}</span></div></article>`).join('')}</div>`;
}
function personCard(p) { return `<a class="person" href="#person/${p.id}">${image(p.profile_path,'w185',p.name)}<strong>${esc(p.name)}</strong><small>${esc(p.character||p.known_for_department||'Actor / actriz')}</small></a>`; }
let visibleItems=[];
function remember(items) { visibleItems=[...items,...visibleItems].slice(0,400); }
function offlineNote(d) { return d._offline?'<div class="notice">Sin conexión a TMDB: estás viendo información guardada. Las novedades se actualizarán al recuperar la conexión.</div>':''; }
function failure(err) { setView(`<a class="back" href="#home">← Volver al inicio</a><div class="empty"><div class="symbol">☁</div><h2>Vamos a necesitar conexión</h2><p>${esc(err.message)}</p><button class="primary" data-retry>Intentar otra vez</button></div>`); }
async function home(rev) {
  const data=await api('trending/all/week'); if(rev!==routeRevision) return;
  const items=(data.results||[]).filter(m=>m.media_type!=='person'); remember(items);
  const hero=items.find(m=>m.backdrop_path)||items[0];
  setView(`<div class="intro"><div><span class="eyebrow">ELIGE TU PRÓXIMA HISTORIA</span><h1>Siempre hay algo por descubrir.</h1><p>El cine que te gusta. Las series de las que todos hablan.</p></div><span class="date-label">✦ Tu dosis de entretenimiento</span></div>${offlineNote(data)}${hero?`<section class="hero">${image(hero.backdrop_path,'w780','','hero-image')}<div class="hero-content"><span class="tag">EN EL RADAR · ESTA SEMANA</span><h2>${esc(title(hero))}</h2><div class="meta"><span class="rating">★ ${stars(hero)}</span><span class="separator">•</span><span>${year(hero)}</span><span class="separator">•</span><span>${kind(hero)==='tv'?'Serie':'Película'}</span></div><p>${esc(hero.overview||'Descubre la historia, conoce al reparto y guárdala para después.')}</p><div class="hero-actions"><a class="primary" href="#detail/${kind(hero)}/${hero.id}">Explorar historia ↗</a><button class="outline" data-add="${keyOf(hero)}">＋ Mi lista</button></div></div><div class="hero-index"><b>01</b> / DESTACADO</div></section>`:''}<section><div class="section-head"><h2>Tendencias <span>ESTA SEMANA</span></h2><a href="#movies">Ver películas ↗</a></div><div class="tabs"><button class="active" data-filter="all">Para ti</button><button data-filter="movie">Películas</button><button data-filter="tv">Series</button></div><div id="catalog">${cards(items.slice(0,15))}</div></section>`);
  $('#view').querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b)); $('#catalog').innerHTML=cards(items.filter(m=>b.dataset.filter==='all'||kind(m)===b.dataset.filter).slice(0,15));hydrate();}));
}
async function browse(type,rev,page=1) {
  const data=await api(`${type}/popular`,{page:String(page)}); if(rev!==routeRevision) return;
  remember(data.results||[]); currentPage=page;
  const heading=type==='movie'?'Películas para todos tus moods.':'Un episodio más. Y otro más.';
  if(page===1) setView(`<span class="eyebrow">EXPLORA EL CATÁLOGO</span><h1 class="page-title">${heading}</h1><p class="muted">Historias populares, nuevas favoritas y clásicos por descubrir.</p>${offlineNote(data)}<div class="section-head"><h2>${type==='movie'?'Películas populares':'Series populares'}</h2></div><div id="browseCatalog">${cards(data.results||[])}</div><div class="more-wrap"><button class="outline" id="loadMore">Cargar más</button></div>`);
  else { $('#browseCatalog').insertAdjacentHTML('beforeend',cards(data.results||[])); hydrate(); }
  const btn=$('#loadMore'); if(btn){btn.hidden=page>=data.total_pages || !data.results?.length;btn.disabled=false;btn.onclick=async()=>{btn.disabled=true;try{await browse(type,rev,currentPage+1)}catch(e){toast(e.message);btn.disabled=false}};}
}
async function detail(type,id,rev) {
  if(!['movie','tv'].includes(type)||!/^\d+$/.test(id)) throw new Error('Ficha no válida');
  let data;
  try { data=await api(`${type}/${id}`,{append_to_response:'credits,videos'}); }
  catch(e) { const local=[...list,...visibleItems,...seed.catalog].find(m=>kind(m)===type&&String(m.id)===id); if(!local) throw e;data={...local,_offline:true}; }
  if(rev!==routeRevision)return; data.media_type=type;remember([data]);
  const trailer=(data.videos?.results||[]).filter(v=>v.site==='YouTube'&&/^[\w-]+$/.test(v.key)).sort((a,b)=>(b.type==='Trailer')-(a.type==='Trailer'))[0];
  const site=data.homepage && /^https?:\/\//i.test(data.homepage) ? data.homepage : null;
  setView(`<a class="back" href="#${type==='movie'?'movies':'tv'}">← Volver al catálogo</a>${offlineNote(data)}<section class="detail-hero">${image(data.backdrop_path,'w780','','detail-backdrop')}${image(data.poster_path,'w342',title(data),'detail-poster')}<div class="detail-info"><div class="detail-title"><span class="eyebrow">${type==='movie'?'PELÍCULA':'SERIE'}</span><h1>${esc(title(data))}</h1><div class="meta"><span class="rating">★ ${stars(data)}</span><span>${year(data)}</span><span>${data.runtime?data.runtime+' min':data.number_of_seasons?data.number_of_seasons+' temporada(s)':''}</span></div></div>${data.tagline?`<p class="tagline">${esc(data.tagline)}</p>`:''}<div class="chips">${(data.genres||[]).map(g=>`<span class="chip">${esc(g.name)}</span>`).join('')}</div><p class="overview">${esc(data.overview||'Todavía no hay una sinopsis disponible en español.')}</p><div class="detail-actions"><button class="primary" data-add="${keyOf(data)}">${list.some(m=>keyOf(m)===keyOf(data))?'♥ En mi lista':'＋ Mi lista'}</button>${trailer?`<a class="outline" href="https://www.youtube.com/watch?v=${esc(trailer.key)}" target="_blank" rel="noopener">▷ Ver tráiler ↗</a>`:'<span class="chip">Tráiler no disponible</span>'}${site?`<a class="outline" href="${esc(site)}" target="_blank" rel="noopener">Sitio oficial ↗</a>`:''}</div></div></section><section><div class="section-head"><h2>El talento detrás de la historia</h2></div>${data.credits?.cast?.length?`<div class="cast">${data.credits.cast.slice(0,12).map(personCard).join('')}</div>`:'<div class="notice">El reparto no está disponible en esta ficha guardada. Consulta la ficha con conexión para completarla.</div>'}</section>`);
}
async function person(id,rev) {
  if(!/^\d+$/.test(id))throw new Error('Persona no válida');
  const [p,credits]=await Promise.all([api(`person/${id}`),api(`person/${id}/combined_credits`)]);if(rev!==routeRevision)return;
  const seen=new Set(), items=(credits.cast||[]).filter(m=>{const k=keyOf(m);if(seen.has(k)||!m.poster_path)return false;seen.add(k);return true}).sort((a,b)=>(b.popularity||0)-(a.popularity||0));remember(items);
  setView(`<a class="back" href="#search">← Buscar personas</a>${offlineNote(p)}<section class="person-header">${image(p.profile_path,'w185',p.name)}<div><span class="eyebrow">PERSONAS · FILMOGRAFÍA</span><h1>${esc(p.name)}</h1><p class="muted">${esc(p.known_for_department||'Actuación')}${p.place_of_birth?' · '+esc(p.place_of_birth):''}</p></div></section>${p.biography?`<p class="person-bio">${esc(p.biography)}</p>`:''}<div class="section-head"><h2>Sus historias <span>${items.length} TÍTULOS</span></h2></div>${items.length?cards(items):'<div class="empty">No hay títulos disponibles.</div>'}`);
}
function searchPage() {
  setView(`<span class="eyebrow">ENCUENTRA ALGO INCREÍBLE</span><h1 class="page-title">¿Qué tienes en mente?</h1><p class="muted">Una película, una serie o esa persona que siempre te sorprende.</p><form class="search-form" id="searchForm"><input id="query" type="search" placeholder="Nombre de película, serie o actor…" aria-label="Buscar" maxlength="120" required><select id="searchType" aria-label="Tipo de búsqueda"><option value="multi">Todo</option><option value="movie">Películas</option><option value="tv">Series</option><option value="person">Personas / actores</option></select><button class="primary">Buscar ↗</button></form><div id="searchResults"><div class="empty"><div class="symbol">⌕</div><h2>Una búsqueda. Miles de historias.</h2><p>También puedes explorar el catálogo completo de tus actores favoritos.</p></div></div>`);
  $('#searchForm').onsubmit=async e=>{
    e.preventDefault();const q=$('#query').value.trim();if(!q)return;
    const rev=++searchRevision, route=routeRevision,type=$('#searchType').value;
    $('#searchResults').innerHTML='<div class="loading-state">Buscando…</div>';
    try {const data=await api(`search/${type}`,{query:q}); if(rev!==searchRevision||route!==routeRevision)return; if(type!=='multi') data.results=(data.results||[]).map(m=>({...m,media_type:type})); remember(data.results||[]);$('#searchResults').innerHTML=offlineNote(data)+`<div class="section-head"><h2>Resultados para “${esc(q)}”</h2></div>`+(data.results?.length?cards(data.results):'<div class="empty">No encontramos coincidencias. Prueba otro nombre o consulta con conexión.</div>');hydrate();}
    catch(err){if(rev===searchRevision&&route===routeRevision)$('#searchResults').innerHTML=`<div class="notice error-msg">${esc(err.message)}</div>`;}
  };$('#query').focus({preventScroll:true});
}
function listPage() {remember(list);setView(`<span class="eyebrow">TUS HISTORIAS PENDIENTES</span><h1 class="page-title">Tu próxima maratón, aquí.</h1><p class="muted">${list.length} títulos guardados en este dispositivo. Sin cuentas ni registros.</p>${list.length?cards(list):'<div class="empty"><div class="symbol">♡</div><h2>Tu lista empieza con una historia.</h2><p>Toca el corazón de cualquier película o serie para guardarla.</p><a class="primary" href="#home">Encontrar mi próxima historia</a></div>'}`);}
async function settings() {
  const movies=list.filter(m=>kind(m)==='movie').length,tv=list.length-movies, percent=list.length?movies/list.length*100:0;
  setView(`<span class="eyebrow">A TU MANERA</span><h1 class="page-title">Tu app, tu universo.</h1><p class="muted">Lo que sigues, tu almacenamiento y las personas detrás de CarimarShow.</p><div class="settings-grid"><section class="setting-panel"><h2>Tu lista, en números</h2><div class="stat-row"><div class="stat"><strong>${movies}</strong><span>Películas</span></div><div class="stat"><strong>${tv}</strong><span>Series</span></div></div><div class="bar" role="img" aria-label="${movies} películas y ${tv} series"><span style="width:${percent}%"></span></div><div class="legend"><span><i></i>Películas</span><span><i class="tv-dot"></i>Series</span></div></section><section class="setting-panel"><h2>Disponible sin conexión</h2><p>La app incluye una selección inicial de títulos y pósteres. Las fichas que consultas y las imágenes vistas se guardan también en este dispositivo.</p><p id="storageInfo">Calculando almacenamiento…</p><button class="outline small danger" id="clearCache">Borrar caché de consultas e imágenes</button><p style="font-size:10px">No se borra tu lista ni el catálogo incluido en el instalador.</p></section><section class="setting-panel"><h2>CarimarShow-shop</h2><dl><dt>Dirección</dt><dd>Lealtad 559 e/ Salud y Dragones, Centro Habana, Cuba</dd><dt>Horario</dt><dd>Lunes a viernes · 1:00 PM – 10:00 PM</dd><dt>Teléfonos</dt><dd><a href="tel:+5353324928">+53 53324928</a><br><a href="tel:+5378660658">+53 78660658</a></dd><dt>Correo</dt><dd><a href="mailto:carimarshowapk@qmail.com">carimarshowapk@qmail.com</a></dd></dl><a class="outline small" href="https://wa.me/5353324928" target="_blank" rel="noopener">Contactar por WhatsApp ↗</a></section><section class="setting-panel"><h2>Hecha para acompañarte</h2><p>Desarrollado por <b>Studio Lexair · Yolexis</b></p><dl><dt>Versión</dt><dd>${esc(window.CARIMAR_CONFIG.version)}</dd><dt>Catálogo inicial</dt><dd>${seed.catalog.length} títulos · ${esc(seed.generatedAt?.slice(0,10)||'—')}</dd><dt>Datos</dt><dd><a href="https://www.themoviedb.org" target="_blank" rel="noopener" class="tmdb-logo">TMDB ↗</a></dd></dl><p>Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB. Solo ofrece información: no aloja películas ni series.</p><a class="button-link" href="#privacy">Privacidad y almacenamiento ↗</a></section><section class="setting-panel"><h2>Llévala contigo</h2><p>Android: APK con interfaz web incluida. Windows: instalador con archivos locales. En iPhone y otros navegadores: versión web instalable.</p><div class="install-options"><a class="primary small" href="https://github.com/StudioLexair/CarimarShow-Native/releases" target="_blank" rel="noopener">Descargar instaladores ↗</a><button class="outline small" id="installFromSettings">Instalar versión web</button></div></section></div>`);
  $('#clearCache').onclick=async()=>{
    if(!confirm('¿Borrar consultas e imágenes guardadas? Tu lista y el catálogo incluido se conservan.'))return;
    const db=await dbPromise;if(db)await new Promise(resolve=>{const tx=db.transaction(['api','images'],'readwrite');tx.objectStore('api').clear();tx.objectStore('images').clear();tx.oncomplete=tx.onerror=tx.onabort=resolve;});
    if('caches'in window)for(const k of await caches.keys())if(k.startsWith('carimarshow-data'))await caches.delete(k);
    toast('Caché borrada. Tu lista se conserva.');storageInfo();
  };$('#installFromSettings').onclick=install;storageInfo();
}
async function storageInfo(){try{const info=await navigator.storage?.estimate();if($('#storageInfo'))$('#storageInfo').textContent=info?`${((info.usage||0)/1024/1024).toFixed(1)} MB usados en este dispositivo.`:'Consultas e imágenes guardadas localmente.';}catch{}}
function privacy(){setView(`<a class="back" href="#settings">← Ajustes</a><h1 class="page-title">Tu privacidad importa.</h1><section class="setting-panel"><p>No necesitas registrarte. Tu lista y los datos offline se guardan únicamente en el almacenamiento de este navegador o aplicación; no se sincronizan entre dispositivos.</p><p>Para buscar o actualizar fichas, tu consulta se envía al servidor de CarimarShow alojado en Vercel y desde allí a TMDB. Vercel y TMDB pueden registrar información técnica, como IP y datos de la petición, según sus políticas. Los pósteres se descargan de TMDB.</p><p>YouTube, WhatsApp y sitios oficiales se abren fuera de la aplicación y tienen sus propias políticas. No se solicitan permisos de cámara, micrófono, ubicación ni contactos.</p><p>La caché está limitada a 250 consultas y 100 imágenes adicionales. El sistema operativo puede eliminar datos locales si necesita espacio. Puedes borrar la caché desde Ajustes; desinstalar la app puede borrar tu lista.</p><p>Contacto: <a class="accent" href="mailto:carimarshowapk@qmail.com">carimarshowapk@qmail.com</a></p></section>`);}
async function route(){
  const rev=++routeRevision;searchRevision++;const parts=(location.hash.slice(1)||'home').split('/'),name=parts[0];
  document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));
  window.scrollTo({top:0,behavior:'instant'});
  if(!['search','list','settings','privacy'].includes(name))setView('<div class="loading-state">Preparando tu próxima historia…</div>');
  try{if(name==='home')await home(rev);else if(name==='movies'||name==='tv')await browse(name==='movies'?'movie':'tv',rev);else if(name==='detail')await detail(parts[1],parts[2],rev);else if(name==='person')await person(parts[1],rev);else if(name==='search')searchPage();else if(name==='list')listPage();else if(name==='settings')await settings();else if(name==='privacy')privacy();else location.hash='#home';}catch(err){if(rev===routeRevision)failure(err);}
}
view.addEventListener('click',e=>{
 const b=e.target.closest('[data-save],[data-add]'); if(b){const k=b.dataset.save||b.dataset.add;const m=[...visibleItems,...seed.catalog,...list].find(x=>keyOf(x)===k);if(m){toggleSave(m);if(location.hash==='#list')listPage();else if(b.dataset.add)b.textContent=list.some(x=>keyOf(x)===k)?'♥ En mi lista':'＋ Mi lista';}}
 if(e.target.closest('[data-retry]'))route();
});
function connection(){const online=navigator.onLine;$('#connection').classList.toggle('offline',!online);$('#connection').innerHTML=`<i></i>${online?'En línea':'Sin conexión'}`;}
async function install(){
 if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;return;}
 $('#installInstructions').textContent=/iPhone|iPad|iPod/.test(navigator.userAgent)?'En Safari: toca Compartir → Añadir a la pantalla de inicio. Para actualizar el catálogo necesitas internet; después puedes consultar lo guardado.':'Para instalar la versión web, usa la opción “Instalar aplicación” de Chrome o Edge. Para Android y Windows también puedes descargar el instalador nativo desde Releases.';
 $('#installDialog').showModal();
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install').hidden=false});
window.addEventListener('appinstalled',()=>{installPrompt=null;$('#install').hidden=true;toast('CarimarShow instalada')});
$('#install').onclick=install;$('#searchTrigger').onclick=()=>location.hash='#search';
window.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();location.hash='#search';}});
window.addEventListener('hashchange',route);window.addEventListener('online',connection);window.addEventListener('offline',connection);
(async()=>{
 try{const r=await fetch('/catalog-snapshot.json');if(r.ok)seed=await r.json()}catch{}
 connection();updateCount();await route();
 if('serviceWorker'in navigator&&!window.CARIMAR_CONFIG.apiOrigin)navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();

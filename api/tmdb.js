// El token vive en el entorno de Vercel, nunca en la web ni el APK.
const ORIGINS = new Set(['https://carimarshow-native.vercel.app', 'https://appassets.androidplatform.net', 'https://carimarshow.local']);
const ALLOWED = /^(trending\/(all|movie|tv)\/(day|week)|movie\/(popular|top_rated|now_playing|\d+)|tv\/(popular|top_rated|on_the_air|\d+)|search\/(multi|movie|tv|person)|person\/\d+(\/combined_credits)?)$/;
module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    if (origin && !ORIGINS.has(origin)) return res.status(403).json({ error: 'Origen no permitido' });
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  if (origin && !ORIGINS.has(origin) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return res.status(403).json({ error: 'Origen no permitido' });
  const path = String(req.query.path || '');
  if (!ALLOWED.test(path)) return res.status(400).json({ error: 'Consulta no permitida' });
  if (!process.env.TMDB_READ_TOKEN) return res.status(503).json({ error: 'TMDB no configurado' });
  const params = new URLSearchParams({ language: 'es-ES', include_adult: 'false' });
  for (const k of ['query', 'page', 'append_to_response']) {
    if (req.query[k]) params.set(k, String(req.query[k]).slice(0, 300));
  }
  if (params.has('page') && !/^[1-9]\d{0,2}$/.test(params.get('page'))) return res.status(400).json({ error: 'Página inválida' });
  if (params.has('append_to_response') && !/^(credits,videos|videos,credits)$/.test(params.get('append_to_response'))) return res.status(400).json({ error: 'Expansión no permitida' });
  try {
    const upstream = await fetch(`https://api.themoviedb.org/3/${path}?${params}`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!upstream.ok) return res.status(upstream.status === 429 ? 429 : 502).json({ error: 'TMDB no disponible. Intenta más tarde.' });
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(await upstream.json());
  } catch { return res.status(502).json({ error: 'No se pudo conectar con TMDB' }); }
};

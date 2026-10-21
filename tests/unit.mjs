import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import {
  orderMessage,
  whatsappChoices,
  uniqueSelection,
} from "../public/app/modules/services-orders.mjs";
import {
  MAX_CONTENT_AGE,
  AUTO_CACHE_AGE,
  LIMITS,
  EXPLICIT_LIMITS,
  validAge,
  record,
  expired,
  evictions,
  logicalBytes,
} from "../public/app/modules/storage-policy.mjs";
import {
  youtube,
  trailerList,
  kind,
  title,
  esc,
  personCreditRole,
  personFilmography,
  listStatusOptions,
  normalizeListStatus,
} from "../public/app/modules/core-model.mjs";
import { validateResponse } from "../public/app/modules/core-validation.mjs";
import { imageProxyUrl } from "../public/app/modules/services-image-proxy.mjs";
const require = createRequire(import.meta.url),
  { validateQuery, limiter, validPayload } = require("../lib/tmdb-policy.cjs");
const items = [
  {
    id: 1,
    title: "Película & prueba",
    release_date: "2024-03-01",
    media_type: "movie",
  },
  {
    id: 1,
    name: "Serie prueba",
    first_air_date: "2022-01-01",
    media_type: "tv",
  },
  { id: 1, title: "Duplicada", media_type: "movie" },
  { id: 8, name: "Actor", media_type: "person" },
];
test("pedido: deduplicación por tipo/id, película y serie, año y total", () => {
  assert.equal(uniqueSelection(items).length, 2);
  const m = orderMessage(items);
  assert.match(m, /Películas:\n1\. Película & prueba \(2024\)/);
  assert.match(m, /Series:\n1\. Serie prueba \(2022\)/);
  assert.match(m, /Total de títulos: 2/);
  assert.doesNotMatch(m, /Quisiera consultar la disponibilidad y las condiciones del pedido/);
  assert.doesNotMatch(m, /undefined|null|confirmado|Duplicada|Actor/);
  assert.equal(orderMessage([]), "");
});
test("pedido: dos WhatsApp propios, orden exacto y codificación reversible", () => {
  const choices = whatsappChoices(items);
  assert.deepEqual(
    choices.map((c) => new URL(c.url).pathname),
    ["/5353324928", "/5378660658"],
  );
  for (const c of choices)
    assert.equal(new URL(c.url).searchParams.get("text"), orderMessage(items));
  const edited = "Mensaje editado por la persona usuaria";
  assert.deepEqual(
    whatsappChoices(items, edited).map((c) => new URL(c.url).searchParams.get("text")),
    [edited, edited],
  );
  assert.equal(items.length, 4);
});
test("Mi Lista: estados por tipo y valor predeterminado ante datos inválidos", () => {
  assert.deepEqual([...listStatusOptions("movie")], ["Pendiente", "Vista"]);
  assert.deepEqual([...listStatusOptions("tv")], [
    "Pendiente",
    "En emisión",
    "Terminada",
  ]);
  assert.equal(
    normalizeListStatus({ id: 1, media_type: "movie" }, "Vista"),
    "Vista",
  );
  assert.equal(
    normalizeListStatus({ id: 2, media_type: "tv" }, "Vista"),
    "Pendiente",
  );
  assert.equal(normalizeListStatus("tv", "Terminada"), "Terminada");
  assert.equal(normalizeListStatus("movie", "desconocido"), "Pendiente");
});
test("tráiler: solo YouTube, tipo Trailer y clave válida; sin teasers ajenos", () => {
  const good = {
    site: "YouTube",
    type: "Trailer",
    key: "Abc_123-xy",
    name: "Clip corto",
  };
  assert.equal(youtube(good), false);
  good.key = "Abc_123-xyz";
  assert.equal(youtube(good), true);
  assert.equal(
    trailerList({
      videos: {
        results: [
          good,
          { ...good, type: "Teaser" },
          { ...good, site: "Vimeo" },
          { ...good, key: "javascript:bad" },
        ],
      },
    }).length,
    1,
  );
  assert.equal(trailerList({}).length, 0);
  assert.equal(youtube(null), false);
});
test("política: 30/150 días, inválidos/futuros y límites declarados", () => {
  const now = Date.now();
  assert.equal(validAge(now - MAX_CONTENT_AGE + 1, MAX_CONTENT_AGE, now), true);
  assert.equal(validAge(now - MAX_CONTENT_AGE, MAX_CONTENT_AGE, now), false);
  assert.equal(validAge("invalid"), false);
  assert.equal(validAge(now + 2 * 86400000), false);
  const r = record({ x: "á" }, "api", now);
  assert.equal(r.expiresAt - now, AUTO_CACHE_AGE);
  assert.equal(expired(r, r.expiresAt), true);
  assert.equal(expired(r, r.expiresAt - 1), false);
  assert.equal(expired({ value: 3 }), true);
  assert.equal(logicalBytes(new Blob(["abc"])), 3);
  assert.equal(LIMITS.api.count, 250);
  assert.equal(EXPLICIT_LIMITS.downloads.count, 100);
});
test("LRU: limita tanto elementos como bytes y respeta acceso reciente", () => {
  const rows = [
    { key: "a", bytes: 10, accessedAt: 3 },
    { key: "b", bytes: 10, accessedAt: 1 },
    { key: "c", bytes: 10, accessedAt: 2 },
  ];
  assert.deepEqual(evictions(rows, { count: 2, bytes: 100 }), ["b"]);
  assert.deepEqual(evictions(rows, { count: 20, bytes: 10 }), ["b", "c"]);
  assert.deepEqual(evictions(rows, { count: 3, bytes: 30 }), []);
});
test("tipos/modelo: personas no son películas, escapado sin null/undefined", () => {
  assert.equal(
    kind({ name: "Actor", known_for_department: "Acting" }),
    "person",
  );
  assert.equal(kind({ name: "Serie", first_air_date: "2020-01-01" }), "tv");
  assert.equal(esc(undefined), "");
  assert.equal(esc("<script>"), "&lt;script&gt;");
  assert.match(title({ _contentExpired: true }), /actualizar/);
});
test("filmografía: créditos de actuación limpios, ordenados y separados de otros oficios", () => {
  const credits = {
    cast: [
      { id: 1, title: "Película válida", media_type: "movie", release_date: "2000-01-01" },
      { id: 2, name: "Serie válida", media_type: "tv", first_air_date: "2024-05-01", genre_ids: [18] },
      { id: 3, name: "Programa de entrevistas", media_type: "tv", first_air_date: "2025-01-01", genre_ids: [10767] },
      { id: 4, name: "Noticias", media_type: "tv", first_air_date: "2025-01-01", genre_ids: [10763] },
      { id: 5, name: "Telerrealidad", media_type: "tv", first_air_date: "2025-01-01", genre_ids: [10764] },
      { id: 13, name: "Netflix Tudum 2025", media_type: "tv", first_air_date: "2025-06-01", character: "Self" },
      { id: 14, title: "Especial de comedia", media_type: "movie", release_date: "2025-04-01", genre_ids: [35], character: "Himself" },
      { id: 15, title: "Drama ficticio", media_type: "movie", release_date: "1999-04-01", character: "Self Made" },
      { id: 16, title: "Autopresentación", media_type: "movie", release_date: "2025-05-01", character: "As Herself (archive footage)" },
      { id: 17, name: "El show de los Teleñecos", media_type: "tv", first_air_date: "1976-09-01", genre_ids: [35, 10751], character: "Actor Ejemplo - Special Guest Star" },
      { id: 18, title: "Aparición propia", media_type: "movie", release_date: "2024-01-01", character: "Actor Ejemplo" },
      { id: 19, title: "Año no informado", media_type: "movie", character: "Papel desconocido" },
      { id: 9, title: "Documental sobre otra persona", media_type: "movie", release_date: "2025-03-01", genre_ids: [99] },
      { id: 1, title: "Película duplicada", media_type: "movie", release_date: "2000-01-01" },
      { id: 6, title: "Contenido adulto", media_type: "movie", adult: true },
      { id: 7, name: "Sin tipo de medio" },
      { id: 8, name: "Persona ajena", media_type: "person" },
    ],
    crew: [
      { id: 10, title: "Trabajo de montaje", media_type: "movie", department: "Editing" },
    ],
  };
  const acting = personFilmography(
    { name: "Actor Ejemplo", known_for_department: "Acting" },
    credits,
  );
  assert.deepEqual(acting.map((m) => m.id), [2, 1, 15, 19]);
  assert.deepEqual(acting.map((m) => m.media_type), ["tv", "movie", "movie", "movie"]);
  assert.equal(personCreditRole({ character: "Bruce Wayne", job: "Actor" }), "Bruce Wayne");
  assert.equal(personCreditRole({ job: "Director" }), "Director");
  const directing = personFilmography(
    { known_for_department: "Directing" },
    {
      cast: credits.cast,
      crew: [
        { id: 11, title: "Dirigida", media_type: "movie", department: "Directing" },
        { id: 12, title: "Montada", media_type: "movie", department: "Editing" },
      ],
    },
  );
  assert.deepEqual(directing.map((m) => m.id), [11]);
  assert.deepEqual(
    personFilmography({ name: "Actor Ejemplo" }, credits).map((m) => m.id),
    [2, 1, 15, 19],
  );
});
test("proxy: allowlist y parámetros estrictos bloquean SSRF, tokens y expansión arbitraria", () => {
  for (const q of [
    { path: "https://evil.test" },
    { path: "movie/1/../../account" },
    { path: ["movie/1"] },
    { path: "movie/1", api_key: "x" },
    { path: "movie/1", page: "501" },
    { path: "movie/1", page: "0" },
    { path: "movie/1", language: "xx" },
    { path: "movie/1", append_to_response: "account" },
    { path: "search/movie", query: "a".repeat(201) },
    { path: "search/movie", query: "" },
    { path: "movie/0" },
    { path: "discover/tv", with_genres: "1,x" },
    { path: "discover/movie", sort_by: "DROP TABLE" },
    { path: "movie/popular", sort_by: "vote_average.desc" },
    { path: "discover/movie", primary_release_year: "2101" },
    { path: "discover/movie", first_air_date_year: "2025" },
    { path: "discover/tv", "vote_average.gte": "10.1" },
    { path: "discover/movie", "vote_count.gte": "-1" },
    { path: "trending/person/today" },
  ])
    assert.throws(() => validateQuery(q));
  for (const path of [
    "movie/1",
    "tv/2/videos",
    "person/3/combined_credits",
    "search/person",
    "trending/all/day",
    "trending/person/week",
    "discover/movie",
    "genre/tv/list",
  ])
    assert.equal(
      validateQuery({
        path,
        ...(path.startsWith("search") ? { query: "Película & serie" } : {}),
      }).path,
      path,
    );
  const movieFilters = validateQuery({
      path: "discover/movie",
      sort_by: "vote_average.desc",
      primary_release_year: "2024",
      "vote_average.gte": "7",
      "vote_count.gte": "100",
      with_genres: "28",
    }).params,
    tvFilters = validateQuery({
      path: "discover/tv",
      sort_by: "first_air_date.desc",
      first_air_date_year: "2025",
    }).params;
  assert.equal(movieFilters.get("sort_by"), "vote_average.desc");
  assert.equal(movieFilters.get("primary_release_year"), "2024");
  assert.equal(movieFilters.get("vote_average.gte"), "7");
  assert.equal(movieFilters.get("vote_count.gte"), "100");
  assert.equal(movieFilters.get("with_genres"), "28");
  assert.equal(tvFilters.get("first_air_date_year"), "2025");
  assert.equal(
    validateQuery({ path: "search/movie", query: " á & b " }).params.get(
      "query",
    ),
    "á & b",
  );
});
test("validación: cero resultados es éxito; ficha o vídeo de otro ID es error", () => {
  assert.equal(validateResponse("search/movie", { results: [] }), true);
  assert.equal(validateResponse("search/movie", { error: "bad" }), false);
  assert.equal(validateResponse("movie/1", { id: 2, title: "Otro" }), false);
  assert.equal(
    validateResponse("movie/1/videos", { id: 2, results: [] }),
    false,
  );
  assert.equal(validPayload("movie/1", { id: 1, title: "Título" }), true);
  assert.equal(validPayload("movie/1", { id: 2, title: "Otro" }), false);
  assert.equal(validPayload("search/movie", { results: [] }), true);
});
test("rate limiting de instancia: 429, reset y tamaño acotado", () => {
  const allow = limiter({ limit: 2, windowMs: 1000, maxKeys: 1 });
  assert.equal(allow("ip", 0).allowed, true);
  assert.equal(allow("ip", 1).allowed, true);
  assert.equal(allow("ip", 2).allowed, false);
  assert.equal(allow("other", 3).allowed, false);
  assert.equal(allow("other", 1000).allowed, true);
});
test("handler: método, origen, validación, upstream válido y errores sin credencial", async () => {
  const handler = require("../api/tmdb.js");
  function response() {
    return {
      headers: {},
      code: 0,
      body: null,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(c) {
        this.code = c;
        return this;
      },
      json(d) {
        this.body = d;
        return this;
      },
      end() {
        return this;
      },
    };
  }
  let r = response();
  await handler({ method: "POST", headers: {}, query: {} }, r);
  assert.equal(r.code, 405);
  r = response();
  await handler(
    {
      method: "GET",
      headers: { origin: "https://evil.test" },
      query: { path: "movie/1" },
    },
    r,
  );
  assert.equal(r.code, 403);
  r = response();
  await handler({ method: "GET", headers: {}, query: { path: "account" } }, r);
  assert.equal(r.code, 400);
  const old = globalThis.fetch,
    token = process.env.TMDB_READ_TOKEN;
  process.env.TMDB_READ_TOKEN = "unit-test-only-not-a-real-credential";
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ id: 1, title: "Fixture de prueba" }), {
        headers: { "Content-Type": "application/json" },
      });
    r = response();
    await handler(
      { method: "GET", headers: {}, query: { path: "movie/1" } },
      r,
    );
    assert.equal(r.code, 200);
    assert.doesNotMatch(JSON.stringify(r), /unit-test-only/);
    globalThis.fetch = async () => new Response("bad", { status: 429 });
    r = response();
    await handler(
      { method: "GET", headers: {}, query: { path: "movie/1" } },
      r,
    );
    assert.equal(r.code, 429);
    assert.equal(r.headers["Retry-After"], "60");
    globalThis.fetch = async () =>
      new Response("{}", { headers: { "Content-Type": "application/json" } });
    r = response();
    await handler(
      { method: "GET", headers: {}, query: { path: "movie/1" } },
      r,
    );
    assert.equal(r.code, 502);
  } finally {
    globalThis.fetch = old;
    if (token === undefined) delete process.env.TMDB_READ_TOKEN;
    else process.env.TMDB_READ_TOKEN = token;
  }
});
test("arquitectura: imports locales existentes y sin ciclos", () => {
  const dir = path.resolve("public/app/modules"),
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs")),
    graph = new Map();
  for (const file of files) {
    const imports = [
      ...fs
        .readFileSync(path.join(dir, file), "utf8")
        .matchAll(/from\s+['"]\.\/([^'"]+)['"]/g),
    ].map((m) => m[1]);
    for (const i of imports)
      assert.equal(files.includes(i), true, file + " → " + i);
    graph.set(file, imports);
  }
  const done = new Set(),
    visiting = new Set();
  function visit(f) {
    assert.equal(visiting.has(f), false, "Ciclo en " + f);
    if (done.has(f)) return;
    visiting.add(f);
    for (const next of graph.get(f)) visit(next);
    visiting.delete(f);
    done.add(f);
  }
  for (const f of files) visit(f);
});

import {
  moveWithinType,
  sortSelection,
} from "../public/app/modules/core-model.mjs";
test("organización: reordenar salta el tipo oculto sin mutar la selección original", () => {
  const a = { id: 1, title: "Z", media_type: "movie" },
    tv = { id: 9, name: "TV", media_type: "tv" },
    b = { id: 2, title: "A", media_type: "movie" };
  const input = [a, tv, b];
  assert.deepEqual(moveWithinType(input, "movie:1", 1), [b, tv, a]);
  assert.deepEqual(input, [a, tv, b]);
  assert.equal(moveWithinType(input, "movie:1", -1), input);
  assert.equal(moveWithinType(input, "tv:9", 1), input);
  assert.equal(moveWithinType(input, "movie:99", 1), input);
  assert.equal(moveWithinType(input, "movie:1", 0), input);
  assert.deepEqual(sortSelection([a, b], "title"), [b, a]);
  assert.deepEqual(sortSelection([a, b]), [a, b]);
});

import {
  mergeGenres,
  genreSupports,
  interleaveTitles,
} from "../public/app/modules/core-genres.mjs";
test("géneros: correspondencias TMDB para series sin confundir IDs de cine", () => {
  const groups = mergeGenres(
    [
      { id: 28, name: "Acción" },
      { id: 12, name: "Aventura" },
      { id: 27, name: "Terror" },
      { id: 878, name: "Ciencia ficción" },
      { id: 14, name: "Fantasía" },
      { id: 35, name: "Comedia" },
    ],
    [
      { id: 10759, name: "Action & Adventure" },
      { id: 10765, name: "Sci-Fi & Fantasy" },
      { id: 35, name: "Comedia" },
      { id: 10762, name: "Kids" },
    ],
  );
  assert.deepEqual(groups.find((g) => g.id === 28).tvIds, [10759]);
  assert.deepEqual(groups.find((g) => g.id === 12).tvIds, [10759]);
  assert.deepEqual(groups.find((g) => g.id === 878).tvIds, [10765]);
  assert.deepEqual(groups.find((g) => g.id === 14).tvIds, [10765]);
  assert.deepEqual(groups.find((g) => g.id === 35).tvIds, [35]);
  assert.equal(
    genreSupports(
      groups.find((g) => g.id === 27),
      "tv",
    ),
    false,
  );
  assert.equal(
    genreSupports(
      groups.find((g) => g.id === 10762),
      "movie",
    ),
    false,
  );
});
test("géneros: resultados mixtos intercalados conservan tipo aunque compartan ID", () => {
  const items = interleaveTitles(
    [
      { id: 1, title: "Película" },
      { id: 2, title: "Otra" },
    ],
    [{ id: 1, name: "Serie" }],
  );
  assert.deepEqual(
    items.map((m) => m.media_type),
    ["movie", "tv", "movie"],
  );
  assert.deepEqual(
    items.map((m) => m.id),
    [1, 1, 2],
  );
});

test("proxy: dominio corto y nativas permitidos, origen ajeno rechazado", async () => {
  const handler = require("../api/tmdb.js");
  for (const origin of ["https://carimarshow.vercel.app", "https://carimarshow-native.vercel.app", "https://appassets.androidplatform.net", "https://carimarshow.local", "https://ajeno.example"]) {
    const res = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.code=n; return this; }, end() {}, json(data) { this.data=data; return this; } };
    await handler({method: "OPTIONS", headers: {origin}}, res);
    assert.equal(res.code, ["https://ajeno.example", "https://carimarshow-native.vercel.app"].includes(origin) ? 403 : 204);
    assert.equal(res.headers["Access-Control-Allow-Origin"], ["https://ajeno.example", "https://carimarshow-native.vercel.app"].includes(origin) ? undefined : origin);
  }
});


test("native retirado: proxy y allowlists nativas usan únicamente el dominio corto", () => {
  for (const file of ["public/app/config.js", "android/app/src/main/java/com/studiolexair/carimarshow/MainActivity.kt", "windows/MainWindow.xaml.cs", "public/app/modules/services-platform.mjs"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.ok(source.includes("carimarshow.vercel.app"), file);
    assert.ok(!source.includes("carimarshow-native.vercel.app"), file);
  }
});

test("landing Android: el botón usa la descarga del dominio propio en la pestaña actual", () => {
  const html = fs.readFileSync("public/index.html", "utf8");
  assert.ok(html.includes("Versión actual: 2.2.8"));
  assert.ok(html.includes("Versión 2.2.8 · Android"));
  assert.ok(html.includes("Versión 2.2.8 · Windows"));
  assert.ok(html.includes("/releases/latest/download/CarimarShow-Windows-x64-Setup.exe"));
  const buttonIndex = html.indexOf("Descargar APK");
  assert.ok(buttonIndex >= 0, "Debe existir el enlace Descargar APK");
  const start = html.lastIndexOf("<a ", buttonIndex);
  const end = html.indexOf(">", buttonIndex);
  const tag = html.slice(start, end + 1);
  const href = tag.split('href="')[1]?.split('"')[0];
  assert.equal(href, "/api/download-apk");
  assert.ok(!tag.includes("target="), "No debe abrir una pestaña nueva");
});

test("descarga Android: el dominio propio resuelve el asset firmado y salta la página de GitHub", async () => {
  const { createHandler } = require("../api/download-apk.js");
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1)
      return {
        status: 302,
        ok: false,
        headers: {
          get: () =>
            "/StudioLexair/CarimarShow-Native/releases/download/v2.2.8/CarimarShow-Android.apk",
        },
      };
    if (calls.length === 2)
      return {
        status: 302,
        ok: false,
        headers: {
          get: () =>
            "https://release-assets.githubusercontent.com/github-production-release-asset/file?signature=test",
        },
      };
    return { status: 200, ok: true, headers: { get: () => null } };
  };
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; },
  };
  await createHandler(fakeFetch)({ method: "GET" }, res);
  assert.equal(res.statusCode, 302);
  assert.equal(new URL(res.headers.location).hostname, "release-assets.githubusercontent.com");
  assert.equal(calls.length, 3);
  assert.ok(calls.every(({ options }) => options.method === "HEAD" && options.redirect === "manual"));
  assert.equal(res.headers["cache-control"], "no-store");
});

test("descarga Android: rechaza métodos y redirecciones fuera de GitHub", async () => {
  const { createHandler } = require("../api/download-apk.js");
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return {
      status: 302,
      ok: false,
      headers: { get: () => "https://evil.example/payload.apk" },
    };
  };
  const makeResponse = () => ({
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; },
  });
  const handler = createHandler(fakeFetch);
  const methodRes = makeResponse();
  await handler({ method: "POST" }, methodRes);
  assert.equal(methodRes.statusCode, 405);
  assert.equal(methodRes.headers.allow, "GET, HEAD");
  assert.equal(calls, 0);
  const redirectRes = makeResponse();
  await handler({ method: "GET" }, redirectRes);
  assert.equal(redirectRes.statusCode, 502);
  assert.equal(calls, 1);
});

test("candidato 2.2.8: versiones de Android, Windows y web están alineadas", () => {
  const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
  assert.equal(version, "2.2.8");
  for (const [file, marker] of [
    ["public/app/config.js", "version:'" + version + "'"],
    ["android/app/build.gradle.kts", 'versionName = "' + version + '"'],
    ["windows/CarimarShow.csproj", "<Version>" + version + "</Version>"],
    ["windows/installer.iss", '#define MyAppVersion "' + version + '"'],
  ])
    assert.ok(fs.readFileSync(file, "utf8").includes(marker), file);
  assert.ok(fs.readFileSync("public/app/index.html", "utf8").includes('data-app-version="' + version + '"'));
  assert.ok(fs.readFileSync("public/app/startup.mjs", "utf8").includes('|| "' + version + '"'));
});

test("PWA: el shell acompaña la versión pública y startup conserva revisiones por sufijo", () => {
  const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version,
    worker = fs.readFileSync("public/app/sw.js", "utf8"),
    shell = worker.match(/const SHELL = "([^"]+)"/)?.[1];
  assert.ok(shell, "Debe existir un nombre de caché para la aplicación web");
  assert.ok(shell.startsWith("carimarshow-shell-v" + version + "-"), "A code correction should revise the shell cache without inventing a public version");
  assert.ok(worker.includes('"modules/services-image-proxy.mjs"'), "The offline shell must precache the image proxy client module");
  const startup = fs.readFileSync("public/app/startup.mjs", "utf8");
  assert.ok(startup.includes('name !== shellVersion'));
  assert.ok(startup.includes('!name.startsWith(shellVersion + "-")'), "Startup must preserve suffix revisions of the current shell");
});

test("imágenes TMDB: la presentación directa conserva fallback y el cache usa el proxy", () => {
  const source = fs.readFileSync("public/app/modules/ui-images.mjs", "utf8"),
    downloads = fs.readFileSync("public/app/modules/services-downloads.mjs", "utf8");
  assert.ok(source.includes("https://image.tmdb.org/t/p/${size}${p}"));
  assert.ok(source.includes('i.addEventListener("error", fallback, { once: true })'));
  assert.ok(source.includes("imageProxyUrl(key)"));
  assert.ok(downloads.includes("imageProxyUrl(ik)"));
  assert.ok(!source.includes('fetch("https://image.tmdb.org/t/p/" + k'));
  assert.ok(!downloads.includes('fetch("https://image.tmdb.org/t/p/" + ik'));
});

test("offline detalle: el póster usa la imagen incluida y el visor consulta las copias locales", () => {
  const detailSource = fs.readFileSync("public/app/modules/views-detail.mjs", "utf8"),
    posterMarkup = detailSource.split("posterMarkup = d.poster_path")[1]?.split(': "";')[0] || "",
    imageSource = fs.readFileSync("public/app/modules/ui-images.mjs", "utf8"),
    viewerSource = fs.readFileSync("public/app/modules/ui-lightbox.mjs", "utf8"),
    snapshot = JSON.parse(fs.readFileSync("public/app/catalog-snapshot.json", "utf8")),
    hope = snapshot.details?.["movie/1058424"];
  assert.ok(posterMarkup.includes('"w342"'), "Detail poster must match the bundled and explicitly downloaded poster size");
  assert.ok(hope?.poster_path && snapshot.images?.["w342" + hope.poster_path], "Hope must have a bundled w342 poster for offline use");
  assert.ok(imageSource.includes("delete img.dataset.placeholderShown"), "A successful cached blob clears the old CDN error marker");
  assert.ok(viewerSource.includes("cachedImage(imageKey)"), "The zoom viewer must read stored images when original-size CDN fails");
  assert.ok(viewerSource.includes("fetchAndCacheImage(imageKey)"), "The zoom viewer may use the same-origin image proxy when online");
});

test("proxy de imágenes: URL con tamaños y rutas TMDB permitidas, sin traversal", () => {
  const previous = globalThis.window;
  globalThis.window = {
    CARIMAR_CONFIG: { apiOrigin: "https://carimarshow.vercel.app/" },
  };
  try {
    const url = imageProxyUrl("w185/abc-123.jpg");
    assert.equal(
      url,
      "https://carimarshow.vercel.app/api/tmdb-image?size=w185&path=%2Fabc-123.jpg",
    );
    assert.equal(imageProxyUrl("original/abc.jpg"), "");
    assert.equal(imageProxyUrl("w185/../secret.jpg"), "");
    assert.equal(imageProxyUrl("w185/abc.svg"), "");
    assert.equal(imageProxyUrl(null), "");
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test("proxy de imágenes: restringe CORS, valida ruta y tamaño, devuelve una imagen pública acotada", async () => {
  const { createHandler } = require("../api/tmdb-image.js");
  const makeResponse = () => ({
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; },
  });
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(Buffer.from("fake-jpeg"), {
      status: 200,
      headers: { "Content-Type": "image/jpeg" },
    });
  };
  const handler = createHandler(fakeFetch);
  let res = makeResponse();
  await handler(
    { method: "OPTIONS", headers: { origin: "https://appassets.androidplatform.net" }, query: {} },
    res,
  );
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers["access-control-allow-methods"], "GET, OPTIONS");
  assert.equal(calls.length, 0);
  res = makeResponse();
  await handler({ method: "POST", headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 405);
  res = makeResponse();
  await handler(
    {
      method: "GET",
      headers: { origin: "https://appassets.androidplatform.net" },
      query: { size: "w185", path: "/abc.jpg" },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["access-control-allow-origin"], "https://appassets.androidplatform.net");
  assert.equal(res.headers["content-type"], "image/jpeg");
  assert.match(res.headers["cache-control"], /s-maxage=86400/);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.deepEqual(res.body, Buffer.from("fake-jpeg"));
  assert.equal(calls[0].url, "https://image.tmdb.org/t/p/w185/abc.jpg");
  assert.equal(calls[0].options.redirect, "error");

  res = makeResponse();
  await handler(
    { method: "GET", headers: { origin: "https://evil.test" }, query: { size: "w185", path: "/abc.jpg" } },
    res,
  );
  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 1);
  res = makeResponse();
  await handler(
    { method: "GET", headers: {}, query: { size: "original", path: "/abc.jpg" } },
    res,
  );
  assert.equal(res.statusCode, 400);
  res = makeResponse();
  await handler(
    { method: "GET", headers: {}, query: { size: "w185", path: "/../secret.jpg" } },
    res,
  );
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 1);

  const htmlHandler = createHandler(async () => new Response("not an image", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  }));
  res = makeResponse();
  await htmlHandler(
    { method: "GET", headers: {}, query: { size: "w185", path: "/abc.jpg" } },
    res,
  );
  assert.equal(res.statusCode, 502);
});

test("Windows: la ventana usa un icono PNG decodificable por WPF", () => {
  const xaml = fs.readFileSync("windows/MainWindow.xaml", "utf8");
  const project = fs.readFileSync("windows/CarimarShow.csproj", "utf8");
  const icon = fs.readFileSync("windows/app.png");
  assert.ok(xaml.includes('Icon="app.png"'));
  assert.ok(project.includes('<Resource Include="app.png" />'));
  assert.deepEqual(icon.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
});

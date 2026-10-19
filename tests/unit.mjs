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
  personFilmography,
} from "../public/app/modules/core-model.mjs";
import { validateResponse } from "../public/app/modules/core-validation.mjs";
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
  const acting = personFilmography({ known_for_department: "Acting" }, credits);
  assert.deepEqual(acting.map((m) => m.id), [2, 1]);
  assert.deepEqual(acting.map((m) => m.media_type), ["tv", "movie"]);
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
  assert.deepEqual(personFilmography({}, credits).map((m) => m.id), [2, 1]);
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
  ])
    assert.throws(() => validateQuery(q));
  for (const path of [
    "movie/1",
    "tv/2/videos",
    "person/3/combined_credits",
    "search/person",
    "trending/all/day",
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
            "/StudioLexair/CarimarShow-Native/releases/download/v2.2.4/CarimarShow-Android.apk",
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

test("candidato 2.2.4: versiones de Android, Windows y web están alineadas", () => {
  assert.equal(JSON.parse(fs.readFileSync("package.json", "utf8")).version, "2.2.4");
  for (const [file, marker] of [
    ["public/app/config.js", "version:'2.2.4'"],
    ["android/app/build.gradle.kts", 'versionName = "2.2.4"'],
    ["windows/CarimarShow.csproj", "<Version>2.2.4</Version>"],
    ["windows/installer.iss", '#define MyAppVersion "2.2.4"'],
  ])
    assert.ok(fs.readFileSync(file, "utf8").includes(marker), file);
});

test("PWA: la revisión del shell cambia sin fingir una nueva versión pública", () => {
  const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version,
    worker = fs.readFileSync("public/app/sw.js", "utf8"),
    shell = worker.match(/const SHELL = "([^"]+)"/)?.[1];
  assert.ok(shell, "Debe existir un nombre de caché para la aplicación web");
  assert.notEqual(shell, `carimarshow-shell-v${version}`, "Una corrección debe invalidar el shell instalado sin subir el número de versión pública");
});
test("imágenes TMDB: la carga directa evita placeholders cuando falla el cache CORS", () => {
  const source = fs.readFileSync("public/app/modules/ui-images.mjs", "utf8");
  assert.ok(source.includes("https://image.tmdb.org/t/p/${size}${p}"));
  assert.ok(source.includes('i.addEventListener("error", fallback, { once: true })'));
  assert.ok(source.includes('fetch("https://image.tmdb.org/t/p/" + k'));
});

test("Windows: la ventana usa un icono PNG decodificable por WPF", () => {
  const xaml = fs.readFileSync("windows/MainWindow.xaml", "utf8");
  const project = fs.readFileSync("windows/CarimarShow.csproj", "utf8");
  const icon = fs.readFileSync("windows/app.png");
  assert.ok(xaml.includes('Icon="app.png"'));
  assert.ok(project.includes('<Resource Include="app.png" />'));
  assert.deepEqual(icon.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
});

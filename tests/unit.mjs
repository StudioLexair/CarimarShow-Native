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
  assert.match(m, /consultar la disponibilidad/);
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

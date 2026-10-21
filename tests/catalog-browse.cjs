const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://localhost:8083";
const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#246078"/></svg>',
);

function apiResult(path, params) {
  if (path === "genre/movie/list")
    return {
      genres: [
        { id: 28, name: "Acción" },
        { id: 12, name: "Aventura" },
        { id: 16, name: "Animación" },
        { id: 35, name: "Comedia" },
        { id: 80, name: "Crimen" },
        { id: 99, name: "Documental" },
        { id: 18, name: "Drama" },
        { id: 10751, name: "Familia" },
        { id: 14, name: "Fantasía" },
        { id: 36, name: "Historia" },
        { id: 27, name: "Terror" },
        { id: 10402, name: "Música" },
        { id: 9648, name: "Misterio" },
        { id: 10749, name: "Romance" },
        { id: 878, name: "Ciencia ficción" },
        { id: 10770, name: "Película de TV" },
        { id: 53, name: "Suspense" },
        { id: 10752, name: "Bélica" },
        { id: 37, name: "Western" },
      ],
    };
  if (path === "genre/tv/list")
    return {
      genres: [
        { id: 10759, name: "Action & Adventure" },
        { id: 16, name: "Animación" },
        { id: 35, name: "Comedia" },
        { id: 80, name: "Crimen" },
        { id: 99, name: "Documental" },
        { id: 18, name: "Drama" },
        { id: 10751, name: "Familia" },
        { id: 10762, name: "Infantil" },
        { id: 9648, name: "Misterio" },
        { id: 10763, name: "Noticias" },
        { id: 10764, name: "Reality" },
        { id: 10765, name: "Sci-Fi & Fantasy" },
        { id: 10766, name: "Soap" },
        { id: 10767, name: "Talk" },
        { id: 10768, name: "War & Politics" },
        { id: 37, name: "Western" },
      ],
    };
  if (path === "discover/movie")
    return {
      results:
        params.page === "2"
          ? []
          : [
              {
                id: 101,
                title: "Acción 2024",
                media_type: "movie",
                genre_ids: [28],
                release_date: "2024-05-01",
                vote_average: 8.2,
                popularity: 70,
              },
              {
                id: 102,
                title: "Comedia 2024",
                media_type: "movie",
                genre_ids: [35],
                release_date: "2024-06-01",
                vote_average: 6.8,
                popularity: 80,
              },
              {
                id: 103,
                title: "Drama 2023",
                media_type: "movie",
                genre_ids: [18],
                release_date: "2023-06-01",
                vote_average: 7.7,
                popularity: 40,
              },
            ],
      total_pages: 2,
    };
  if (path === "discover/tv")
    return {
      results: [
        {
          id: 201,
          name: "Serie 2025",
          media_type: "tv",
          genre_ids: [18],
          first_air_date: "2025-03-01",
          vote_average: 8.1,
          popularity: 40,
        },
      ],
      total_pages: 1,
    };
  if (path === "trending/movie/week")
    return {
      results: [
        {
          id: 104,
          title: "Tendencia",
          media_type: "movie",
          genre_ids: [28],
          release_date: "2024-02-01",
          vote_average: 8.4,
          popularity: 150,
        },
      ],
      total_pages: 1,
    };
  if (path === "person/popular" || path === "trending/person/week")
    return {
      results: [
        {
          id: 301,
          name: "Ari Directora",
          media_type: "person",
          known_for_department: "Directing",
          popularity: 90,
        },
        {
          id: 302,
          name: "Bea Actriz",
          media_type: "person",
          known_for_department: "Acting",
          popularity: 80,
        },
      ],
      total_pages: 2,
    };
  if (path === "search/person")
    return {
      results: [
        {
          id: 301,
          name: "Ari Directora",
          media_type: "person",
          known_for_department: "Directing",
          popularity: 90,
        },
      ],
      total_pages: 1,
    };
  return { results: [], total_pages: 1 };
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  const calls = [];
  page.on("pageerror", (error) => calls.push({ pageError: error.message }));
  await page.route(/\/api\/tmdb\?/, async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.searchParams.get("path") || "";
    const params = Object.fromEntries(requestUrl.searchParams.entries());
    delete params.path;
    calls.push({ path, params });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(apiResult(path, params)),
    });
  });
  await page.route(/\/api\/tmdb-image\?/, (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg }),
  );
  await page.route(/https:\/\/image\.tmdb\.org\/t\/p\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg }),
  );

  async function waitForApi(path, key, value) {
    return page.waitForRequest(
      (request) => {
        if (!request.url().includes("/api/tmdb?")) return false;
        const url = new URL(request.url());
        return (
          url.searchParams.get("path") === path &&
          url.searchParams.get(key) === value
        );
      },
      { timeout: 10000 },
    );
  }
  async function selectAndWait(selector, choice, path, key, value) {
    const request = waitForApi(path, key, value);
    await page.selectOption(selector, choice);
    return request;
  }

  await page.goto(`${BASE}/app/#browse/movie`);
  await page.locator("#catalogFilters").waitFor();
  await page.locator("#browseCards .card").first().waitFor();
  await page
    .locator('#catalogGenre option[value="28"]')
    .waitFor({ state: "attached" });
  assert.equal(await page.locator("#catalogFilters select").count(), 4);
  assert.equal(await page.locator("#catalogGenre option").filter({ hasText: "Acción" }).count(), 1);

  await selectAndWait("#catalogGenre", "28", "discover/movie", "with_genres", "28");
  await selectAndWait("#catalogYear", "2024", "discover/movie", "primary_release_year", "2024");
  await selectAndWait("#catalogRating", "7", "discover/movie", "vote_average.gte", "7");
  const ratedRequest = await selectAndWait("#catalogSort", "rating", "discover/movie", "sort_by", "vote_average.desc");
  assert.equal(new URL(ratedRequest.url()).searchParams.get("vote_count.gte"), "50");
  assert.match(await page.locator("#catalogSummary").innerText(), /películas/);
  await selectAndWait("#catalogSort", "trending", "trending/movie/week", "page", "1");
  const resetRequest = waitForApi("discover/movie", "sort_by", "popularity.desc");
  await page.locator("#clearCatalogFilters").click();
  await resetRequest;

  await page.goto(`${BASE}/app/#browse/tv`);
  await page.locator("#catalogFilters").waitFor();
  await page.locator("#browseCards .card").first().waitFor();
  await selectAndWait("#catalogYear", "2025", "discover/tv", "first_air_date_year", "2025");
  await selectAndWait("#catalogSort", "recent", "discover/tv", "sort_by", "first_air_date.desc");

  await page.goto(`${BASE}/app/#browse/person`);
  await page.locator("#peopleFilters").waitFor();
  await page.locator("#browseCards .person-card").first().waitFor();
  await page.selectOption("#peopleRole", "Directing");
  await page.locator('.person-card:has-text("Ari Directora")').waitFor();
  assert.equal(await page.locator(".person-card").count(), 1);
  const searchRequest = waitForApi("search/person", "query", "Ari");
  await page.fill("#peopleQuery", "Ari");
  await searchRequest;
  await page.locator('.person-card:has-text("Ari Directora")').waitFor();
  assert.equal(await page.locator(".person-card").count(), 1);
  assert.equal(await page.locator("#peopleSort option").count(), 3);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    "Los filtros de Personas no deben desbordarse en móvil",
  );
  await page.setViewportSize({ width: 1365, height: 900 });

  await page.goto(`${BASE}/app/#genres/all`);
  await page.locator(".genre-tile").first().waitFor();
  await page.locator(".genre-tile-image.is-active").first().waitFor();
  const initialNavigationCount = await page.evaluate(
      () => performance.getEntriesByType("navigation").length,
    ),
    initial = await page.evaluate(() => {
      window.__firstGenreTile = document.querySelector(".genre-tile");
      window.__initialGenrePath = window.__firstGenreTile.dataset.imagePath;
      return {
        tileCount: document.querySelectorAll(".genre-tile").length,
        paths: [...document.querySelectorAll(".genre-tile")].map(
          (tile) => tile.dataset.imagePath,
        ),
      };
    });
  assert.ok(initial.tileCount >= 20, "Se muestran las categorías consultadas");
  assert.ok(initial.paths.every(Boolean), "Todas las categorías reciben una imagen");
  assert.equal(new Set(initial.paths).size, initial.paths.length, "No se repite el arte entre géneros");
  await page.waitForFunction(
    () =>
      window.__firstGenreTile?.isConnected &&
      window.__firstGenreTile.dataset.imagePath !== window.__initialGenrePath,
    null,
    { timeout: 12000 },
  );
  const rotated = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll(".genre-tile")],
      firstImage = tiles[0].querySelector(".genre-tile-image.is-active"),
      rect = tiles[0].getBoundingClientRect();
    return {
      sameTileNode: window.__firstGenreTile === tiles[0],
      paths: tiles.map((tile) => tile.dataset.imagePath),
      firstImageLoaded:
        rect.bottom <= 0 || rect.top >= innerHeight ||
        (firstImage && firstImage.complete && firstImage.naturalWidth > 0),
      hash: location.hash,
      navigationCount: performance.getEntriesByType("navigation").length,
    };
  });
  assert.equal(rotated.sameTileNode, true, "La rotación no reemplaza las tarjetas ni recarga la vista");
  assert.equal(new Set(rotated.paths).size, rotated.paths.length, "La rotación mantiene imágenes únicas");
  assert.equal(rotated.firstImageLoaded, true, "La transición conserva el arte visible, sin parpadeo");
  assert.equal(rotated.hash, "#genres/all");
  assert.equal(rotated.navigationCount, initialNavigationCount, "No se recarga la página");

  const pageErrors = calls.filter((entry) => entry.pageError);
  assert.deepEqual(pageErrors, [], "No hay errores JavaScript en las vistas de catálogo");
  console.log("PASS browse filters: movie/series genre, year, rating, sort; people role/search; genre images unique and rotated in-place");
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

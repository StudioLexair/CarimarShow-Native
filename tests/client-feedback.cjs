const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://localhost:8083";

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Keep live TMDB catalog calls real; use a tiny deterministic CDN response so
  // the cache assertion doesn't depend on image.tmdb.org being reachable in CI.
  const testImage = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nmWQAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("https://image.tmdb.org/t/p/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
      body: testImage,
    }),
  );
  try {
    await page.goto(`${BASE}/app/#home`);
    await page.locator('[data-home-trends="day"]').waitFor({ timeout: 30000 });
    await page.locator('[data-home-trends="week"]').waitFor({ timeout: 30000 });
    await page.locator(".hero h1 a").waitFor({ timeout: 30000 });
    assert.equal(await page.locator(".home-trend-filter").count(), 0, "Home must not hide a feed behind period buttons");
    assert.deepEqual(
      await page.locator("[data-home-trends]").evaluateAll((sections) => sections.map((section) => section.dataset.homeTrends)),
      ["day", "week"],
      "Today's trend section must appear before this week's section",
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    const trendBounds = await page.locator("[data-home-trends]").evaluateAll((sections) =>
      sections.map((section) => {
        const rect = section.getBoundingClientRect();
        return { top: rect.top + scrollY, bottom: rect.bottom + scrollY };
      }),
    );
    assert.ok(
      trendBounds[1].top >= trendBounds[0].bottom,
      "Daily and weekly trends remain stacked at desktop widths",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      (await page.locator('[data-home-trends="day"] .section-head h2').innerText()).trim(),
      "Tendencias de hoy",
    );
    assert.equal(
      (await page.locator('[data-home-trends="week"] .section-head h2').innerText()).trim(),
      "Tendencias de esta semana",
    );
    assert.equal(
      await page.locator('[data-home-trends="day"] .section-head a').getAttribute("href"),
      "#browse/trending/day",
    );
    assert.equal(
      await page.locator('[data-home-trends="week"] .section-head a').getAttribute("href"),
      "#browse/trending/week",
    );

    const heroImageKey = await page.locator(".hero-image").getAttribute("data-image");
    const cacheHandle = await page.waitForFunction(async (key) => {
      const image = document.querySelector(".hero-image");
      if (!image || image.dataset.image !== key || !image.complete || image.naturalWidth < 1) return 0;
      if (image.dataset.bundled === "1") return 1;
      if (!image.src.startsWith("blob:")) return 0;
      const { dbGet } = await import("./modules/storage-cache.mjs");
      const blob = (await dbGet("pinnedImages", key)) || (await dbGet("images", key));
      return blob instanceof Blob ? blob.size : 0;
    }, heroImageKey, { timeout: 30000 });
    const cachedHero = await cacheHandle.jsonValue();
    assert.ok(cachedHero > 0, "Hero artwork should be ready from a bundled or stored TMDB image");

    const heroHref = await page.locator(".hero h1 a").getAttribute("href");
    assert.ok(heroHref.startsWith("#detail/"));
    const todayHrefs = await page
      .locator("#homeTrendDayResults .poster-link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    assert.ok(todayHrefs.length > 0, "TMDB daily trending titles should render");
    assert.ok(todayHrefs.includes(heroHref), "Hero is selected from the live daily TMDB feed");
    const weekHrefs = await page
      .locator("#homeTrendWeekResults .poster-link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    assert.ok(weekHrefs.length > 0, "TMDB weekly trending titles should render below the daily feed");
    console.log("PASS home shows both real TMDB trend feeds vertically, day first, with working browse links");

    await page.goto(`${BASE}/app/#browse/trending/day`);
    await page.locator("#browseCards .card").first().waitFor();
    assert.equal(await page.locator("[data-trend-period]").count(), 0, "Browse trend feeds also avoid period-toggle buttons");
    assert.equal((await page.locator(".page-head .back").innerText()).trim(), "Tendencias de hoy");
    const dailyBrowseCount = await page.locator("#browseCards .card").count();
    assert.ok(dailyBrowseCount > 0, "Daily browse route loads live TMDB results");

    await page.goto(`${BASE}/app/#browse/trending/week`);
    await page.locator("#browseCards .card").first().waitFor();
    assert.equal((await page.locator(".page-head .back").innerText()).trim(), "Tendencias de esta semana");
    const weeklyBrowseCount = await page.locator("#browseCards .card").count();
    assert.ok(weeklyBrowseCount > 0, "Weekly browse route loads its own TMDB results");
    console.log("PASS separate daily/weekly browse routes work without trend period buttons");

    await page.goto(`${BASE}/app/#detail/movie/693134`);
    await page.locator(".detail-heading").waitFor();
    await page.locator("[data-detail-tab=description].active").waitFor();
    const original = page.locator(".original-title");
    await original.waitFor({ timeout: 30000 });
    assert.equal((await original.locator("dd").innerText()).trim(), "Dune: Part Two");
    assert.match((await original.locator("dt").innerText()), /Título original/);
    console.log("PASS localized movie detail shows the TMDB original title in its original language");

    await page.goto(`${BASE}/app/#detail/movie/245891`);
    await page.locator(".detail-heading").waitFor();
    await page.locator("[data-detail-tab=description].active").waitFor();
    assert.equal(await page.locator(".original-title").count(), 0, "Do not repeat an identical localized/original title");
    console.log("PASS identical original title is not redundantly duplicated");

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

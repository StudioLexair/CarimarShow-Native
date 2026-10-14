const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://localhost:8083";

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${BASE}/app/#home`);
    await page.locator(".home-trend-filter").waitFor({ timeout: 30000 });
    await page.locator(".hero h1 a").waitFor({ timeout: 30000 });
    const heroImageKey = await page.locator(".hero-image").getAttribute("data-image");
    const cacheHandle = await page.waitForFunction(async (key) => {
      const image = document.querySelector(".hero-image");
      if (!image || image.dataset.image !== key || !image.complete || image.naturalWidth < 2 || !image.src.startsWith("blob:")) return 0;
      const { dbGet } = await import("./modules/storage-cache.mjs");
      const blob = await dbGet("images", key);
      return blob instanceof Blob ? blob.size : 0;
    }, heroImageKey, { timeout: 30000 });
    const cachedHero = await cacheHandle.jsonValue();
    assert.ok(cachedHero > 0, "Live TMDB artwork is fully loaded and cached automatically");

    const heroHref = await page.locator(".hero h1 a").getAttribute("href");
    assert.ok(heroHref.startsWith("#detail/"));
    const todayHrefs = await page
      .locator("#homeTrendResults .poster-link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    assert.ok(todayHrefs.length > 0, "TMDB daily trending titles should render");
    assert.ok(todayHrefs.includes(heroHref), "Hero is selected from the live daily TMDB feed");
    assert.equal(await page.locator('[data-home-trend="day"]').getAttribute("aria-selected"), "true");

    await page.locator('[data-home-trend="week"]').click();
    assert.equal(await page.locator('[data-home-trend="week"]').getAttribute("aria-selected"), "true");
    const weekHrefs = await page
      .locator("#homeTrendResults .poster-link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    assert.ok(weekHrefs.length > 0, "TMDB weekly trending titles should render");
    console.log("PASS home hero comes from real daily TMDB feed; Hoy and Esta semana both work");

    await page.goto(`${BASE}/app/#browse/trending/day`);
    await page.locator('[data-trend-period="day"][aria-selected="true"]').waitFor();
    await page.locator("#browseCards .card").first().waitFor();
    await page.locator('[data-trend-period="week"]').click();
    await page.waitForURL(/#browse\/trending\/week$/);
    await page.locator('[data-trend-period="week"][aria-selected="true"]').waitFor();
    await page.locator("#browseCards .card").first().waitFor();
    console.log("PASS browse retains both daily and weekly TMDB trending options");

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

const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("fs");
const BASE = process.env.BASE || "http://localhost:8083",
  shots = process.env.TEST_OUTPUT || "artifacts/profile-genres";
fs.mkdirSync(shots, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] }),
    ctx = await browser.newContext({ viewport: { width: 584, height: 890 } }),
    page = await ctx.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function assertDetailArtwork() {
    await page.locator(".detail-backdrop .detail-image").waitFor();
    await page.locator(".detail-poster-frame .detail-poster-image").waitFor();
    const artwork = await page.locator(".detail-visual").evaluate((visual) => {
      const backdrop = visual.querySelector(".detail-backdrop .detail-image");
      const poster = visual.querySelector(".detail-poster-frame .detail-poster-image");
      return {
        hasBackdrop: visual.dataset.hasBackdrop === "true",
        backdropKey: backdrop?.dataset.image || "",
        posterKey: poster?.dataset.image || "",
        backdropWidth: backdrop?.getBoundingClientRect().width || 0,
        posterWidth: poster?.getBoundingClientRect().width || 0,
        posterHeight: poster?.getBoundingClientRect().height || 0,
        viewportWidth: innerWidth,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.ok(artwork.backdropKey, "La ficha debe mostrar una imagen panorámica");
    assert.ok(artwork.posterKey, "La ficha debe mostrar el póster por separado");
    assert.ok(artwork.backdropWidth > 0 && artwork.posterWidth > 0);
    assert.ok(artwork.posterHeight >= artwork.posterWidth * 1.45, "The vertical poster must remain portrait-shaped");
    assert.ok(artwork.posterWidth >= (artwork.viewportWidth <= 700 ? 130 : 170), "The poster must be readable at mobile and desktop sizes");
    assert.equal(artwork.horizontalOverflow, false);
    if (artwork.hasBackdrop)
      assert.notEqual(artwork.backdropKey.slice(4), artwork.posterKey.slice(4));
  }
  await page.goto(BASE + "/app/#profile");
  await page.locator(".profile-hero").waitFor();
  assert.match(await page.locator(".profile-note").innerText(), /2\.2\.4/);
  assert.equal(await page.locator(".profile-stats strong").count(), 3);
  assert.equal(await page.locator("#checkUpdate").count(), 1);
  await page.screenshot({ path: shots + "/perfil.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log(
    "PASS profile redesigned: real stats, local profile controls, current version, no overflow",
  );
  await page.locator("#editProfile").click();
  await page.fill("#profileName", "Mi colección");
  await page.locator("#profileForm .primary").click();
  assert.equal(
    await page.locator(".profile-head h2").innerText(),
    "Mi colección",
  );
  await page.locator('a[href="#support"]').click();
  await page.locator(".support-contacts").waitFor();
  const links = await page
    .locator("[data-support-whatsapp]")
    .evaluateAll((a) => a.map((n) => n.href));
  assert.deepEqual(links, [
    "https://wa.me/5353324928",
    "https://wa.me/5378660658",
  ]);
  assert.equal(await page.locator("details").count(), 6);
  await page.screenshot({ path: shots + "/ayuda.png", fullPage: true });
  console.log("PASS help redesign, ordered real contacts and FAQ");
  await page.goto(BASE + "/app/#genres/all");
  await page.locator(".genre-tile").first().waitFor();
  assert.equal(await page.locator("[data-catalog-type]").count(), 3);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shots + "/generos.png", fullPage: false });
  await page.locator('a[href^="#genre/all/28/"]').click();
  await page.locator("#browseCards .card").first().waitFor();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('#browseCards a.poster-link[href*="/tv/"]')
        .length > 0,
  );
  const mixed = await page
    .locator("#browseCards .poster-link")
    .evaluateAll((a) => a.map((n) => n.getAttribute("href")));
  assert.ok(mixed.some((h) => h.includes("/movie/")));
  assert.ok(mixed.some((h) => h.includes("/tv/")));
  assert.match(
    await page.locator(".genre-taxonomy-note").first().innerText(),
    /Action|Acción/,
  );
  const n = mixed.length;
  await page.locator("#loadMore").click();
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll("#browseCards .poster-link").length > count,
    n,
  );
  console.log(
    "PASS mixed genre movie 28 / TV 10759: real results and pagination",
  );
  await page.locator('[data-catalog-type="tv"]').click();
  await page.waitForURL(/#genre\/tv\//);
  await page.locator('[data-catalog-type="tv"][aria-current="page"]').waitFor();
  await page.locator("#browseCards .card").first().waitFor();
  assert.equal(
    await page.locator('#browseCards .poster-link[href*="/movie/"]').count(),
    0,
  );
  assert.ok(
    (await page.locator('#browseCards .poster-link[href*="/tv/"]').count()) > 0,
  );
  await page.screenshot({ path: shots + "/series-accion.png", fullPage: true });
  const tvHref = await page
    .locator("#browseCards .poster-link")
    .first()
    .getAttribute("href");
  await page.locator("#browseCards .poster-link").first().click();
  await page.locator(".detail-heading").waitFor();
  await assertDetailArtwork();
  await page.screenshot({ path: shots + "/serie-banner-y-poster.png", fullPage: true });
  await page.locator("[data-back]").first().click();
  await page.waitForURL(/#genre\/tv\//);
  await page.locator('[data-catalog-type="tv"][aria-current="page"]').waitFor();
  await page.locator("#browseCards .card").first().waitFor();
  console.log("PASS only TV and back from real series detail restores filter");
  await page.locator('[data-catalog-type="movie"]').click();
  await page.waitForURL(/#genre\/movie\//);
  await page
    .locator('[data-catalog-type="movie"][aria-current="page"]')
    .waitFor();
  await page.locator("#browseCards .card").first().waitFor();
  assert.equal(
    await page.locator('#browseCards .poster-link[href*="/tv/"]').count(),
    0,
  );
  await page.locator("#browseCards .poster-link").first().click();
  await page.locator(".detail-heading").waitFor();
  await assertDetailArtwork();
  await page.screenshot({ path: shots + "/pelicula-banner-y-poster.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await assertDetailArtwork();
  await page.screenshot({ path: shots + "/pelicula-poster-escritorio.png", fullPage: true });
  await page.setViewportSize({ width: 584, height: 890 });
  await page.locator("[data-back]").first().click();
  await page.waitForURL(/#genre\/movie\//);
  console.log("PASS movie and series detail show backdrop plus separate poster");
  await page.goto(BASE + "/app/#genres/tv");
  await page.locator(".genre-tile").first().waitFor();
  assert.equal(await page.locator('a[href*="/27/"]').count(), 0);
  await page.locator('a[href^="#genre/tv/10762/"]').click();
  await page.locator("#browseCards .card").first().waitFor();
  assert.ok(
    (await page.locator('#browseCards .poster-link[href*="/tv/"]').count()) > 0,
  );
  console.log(
    "PASS official TV-only genre and movie-only genres not misrepresented",
  );
  await page.goto(BASE + "/app/#person/16483");
  await page.locator(".actor-title h1").waitFor({ timeout: 30000 });
  await page.locator(".filmography-note").waitFor();
  assert.match(await page.locator(".actor-title h1").innerText(), /Stallone/);
  assert.match(await page.locator(".filmography-note").innerText(), /se omiten documentales/i);
  assert.equal(await page.locator("[data-offline-note]").count(), 0, "Connected person credits must come from a fresh TMDB response");
  const filmographyLinks = await page.locator('a[href="#filmography/16483"]').evaluateAll((links) => links.length);
  assert.equal(filmographyLinks, 2, "Both profile links should open the same complete filmography");
  const previewTitles = await page.locator(".rail .card h3").allTextContents();
  assert.equal(previewTitles.length, 9);
  await page.locator('.actor-actions a[href="#filmography/16483"]').click();
  await page.waitForURL(/#filmography\/16483$/);
  await page.locator(".grid .card").first().waitFor();
  const fullTitles = await page.locator(".grid .card h3").allTextContents();
  assert.ok(fullTitles.length > 9, "The full route should show more than the profile preview");
  assert.deepEqual(fullTitles.slice(0, 9), previewTitles, "Profile preview and full filmography must use identical filters and ordering");
  assert.ok(fullTitles.some((title) => /Tulsa King/i.test(title)));
  assert.ok(!fullTitles.some((title) => /Tonight Show|Late Show|60 Minutes|The View|Family Stallone/i.test(title)), "Talk, news and reality appearances must not pollute the actor filmography");
  console.log("PASS connected Stallone filmography: same filtered credits in profile and full list");
  await page.evaluate(() => { location.hash = "#person/16483"; });
  await page.waitForURL(/#person\/16483$/);
  await page.locator(".actor-title h1").waitFor();
  await page.locator('.section-head a[href="#filmography/16483"]').click();
  await page.waitForURL(/#filmography\/16483$/);
  await page.locator(".grid .card").first().waitFor();
  assert.deepEqual(await page.locator(".grid .card h3").allTextContents(), fullTitles, "Ver todo must open the same list as Ver filmografía");
  const replay = await page.evaluate(async () => {
    const { dbGet } = await import("./modules/storage-cache.mjs");
    return {
      person: await dbGet("api", "path=person%2F16483"),
      credits: await dbGet("api", "path=person%2F16483%2Fcombined_credits"),
    };
  });
  assert.ok(replay.person && replay.credits, "The connected TMDB response should be cached for offline use");
  await ctx.setOffline(true);
  await page.evaluate(() => { location.hash = "#person/16483"; });
  await page.waitForURL(/#person\/16483$/);
  await page.locator("[data-offline-note]").waitFor();
  assert.equal(await page.locator("[data-offline-note] [data-retry]").count(), 0, "Do not offer an online retry while the browser is offline");
  await page.route("**/api/tmdb?**", async (route) => {
    const path = new URL(route.request().url()).searchParams.get("path"),
      body = path === "person/16483" ? replay.person : path === "person/16483/combined_credits" ? replay.credits : null;
    if (!body) return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await ctx.setOffline(false);
  await page.locator("[data-offline-note] [data-retry]").waitFor();
  await page.locator("[data-offline-note] [data-retry]").click();
  await page.locator(".actor-title h1").waitFor();
  await page.waitForFunction(() => !document.querySelector("[data-offline-note]"));
  await page.unroute("**/api/tmdb?**");
  assert.deepEqual(errors, []);
  console.log("PASS cached filmography is labelled offline and can be refreshed after reconnection");
  for (const width of [360, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + "/app/#profile");
    await page.locator(".profile-hero").waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.evaluate(async () => await navigator.serviceWorker.ready);
  await ctx.setOffline(true);
  await page.goto(BASE + "/app/#genres/tv");
  await page.locator(".genre-tile").first().waitFor();
  assert.ok((await page.locator(".notice").count()) > 0);
  console.log("PASS offline TV taxonomy available and marked local");
  await ctx.setOffline(false);
  assert.deepEqual(errors, []);
  await ctx.close();
  // Existing shells must not serve old JS while keeping the user's selection/profile untouched.
  const old = await browser.newContext(),
    p = await old.newPage();
  await p.goto(BASE + "/app/config.js");
  await p.evaluate(async () => {
    localStorage.setItem(
      "cs_profile_v2",
      JSON.stringify({ name: "Perfil conservado", avatar: "" }),
    );
    localStorage.setItem(
      "cs_list_v1",
      JSON.stringify([
        {
          id: 693134,
          title: "Dune: Parte dos",
          media_type: "movie",
          _contentSavedAt: new Date().toISOString(),
        },
      ]),
    );
    const c = await caches.open("carimarshow-shell-v2.0.0");
    await c.put(
      "/app/app.js",
      new Response('throw new Error("STALE_2_0");', {
        headers: { "Content-Type": "text/javascript" },
      }),
    );
  });
  let stale = [];
  p.on("pageerror", (e) => stale.push(e.message));
  await p.goto(BASE + "/app/#profile");
  await p.locator(".profile-hero").waitFor();
  assert.equal(
    await p.locator(".profile-head h2").innerText(),
    "Perfil conservado",
  );
  assert.match(await p.locator(".profile-note").innerText(), /2\.2\.4/);
  await p.evaluate(async () => await navigator.serviceWorker.ready);
  const shellCaches = await p.evaluate(async () =>
    (await caches.keys()).filter((key) => key.startsWith("carimarshow-shell-")),
  );
  assert.deepEqual(shellCaches, ["carimarshow-shell-v2.2.4-fix1"], "The updated service worker must replace the prior offline shell");
  assert.equal(
    await p.evaluate(
      () => JSON.parse(localStorage.getItem("cs_list_v1")).length,
    ),
    1,
  );
  assert.deepEqual(stale, []);
  console.log("PASS obsolete shell bypassed; existing personal data preserved");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

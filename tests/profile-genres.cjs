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
  async function assertZoom(triggerSelector, closeWithEscape = true) {
    const trigger = page.locator(triggerSelector);
    await trigger.waitFor();
    assert.match(await trigger.getAttribute("aria-label"), /Ampliar/i);
    const box = await trigger.boundingBox();
    if (triggerSelector.includes("detail-backdrop"))
      await trigger.click({ position: { x: Math.max(1, box.width - 18), y: Math.max(1, box.height / 2) } });
    else await trigger.click();
    const viewer = page.locator("dialog.image-viewer");
    await viewer.waitFor({ state: "visible" });
    assert.equal(await viewer.locator(".image-viewer-close").isVisible(), true);
    assert.match(await viewer.locator(".image-viewer-image").getAttribute("src"), /\/original\//);
    if (closeWithEscape) await page.keyboard.press("Escape");
    else await viewer.locator(".image-viewer-close").click();
    await viewer.waitFor({ state: "detached" });
    assert.equal(await trigger.evaluate((node) => document.activeElement === node), true, "Closing the viewer should restore focus to the image control");
  }
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
    assert.equal(await page.locator(".detail-backdrop[data-image-zoom]").count(), 1);
    assert.equal(await page.locator(".detail-poster-frame[data-image-zoom]").count(), 1);
    if (artwork.hasBackdrop)
      assert.notEqual(artwork.backdropKey.slice(4), artwork.posterKey.slice(4));
    await assertZoom(".detail-backdrop[data-image-zoom]");
    await assertZoom(".detail-poster-frame[data-image-zoom]", false);
  }
  await page.goto(BASE + "/app/#profile");
  await page.locator(".profile-hero").waitFor();
  assert.match(await page.locator(".profile-note").innerText(), /2\.2\.6/);
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
  assert.match(await page.locator(".filmography-note").innerText(), /autopresentación/i);
  assert.equal(await page.locator("[data-offline-note]").count(), 0, "Connected person credits must come from a fresh TMDB response");
  const filmographyLinks = await page.locator('a[href="#filmography/16483"]').evaluateAll((links) => links.length);
  assert.equal(filmographyLinks, 2, "Both profile links should open the same complete filmography");
  const previewCredits = await page.locator(".rail .card").evaluateAll((cards) =>
    cards.map((card) => ({
      title: card.querySelector("h3 a")?.textContent.trim(),
      href: card.querySelector("h3 a")?.getAttribute("href"),
      year: card.querySelector(".subtitle time")?.textContent.trim(),
      type: card.querySelector(".subtitle span")?.textContent.trim(),
    })),
  );
  assert.equal(previewCredits.length, 9);
  await page.locator('.actor-actions a[href="#filmography/16483"]').click();
  await page.waitForURL(/#filmography\/16483$/);
  await page.locator(".filmography-list .filmography-card").first().waitFor();
  const fullCards = await page.locator(".filmography-list .filmography-card").evaluateAll((cards) =>
    cards.map((card) => {
      const link = card.querySelector(".filmography-card-link"),
        poster = card.querySelector(".filmography-poster"),
        roleText = card.querySelector(".filmography-role")?.textContent.trim() || "";
      return {
        title: card.querySelector(".filmography-title")?.textContent.trim(),
        href: link?.getAttribute("href"),
        year: card.querySelector(".filmography-year")?.textContent.trim(),
        type: card.querySelector(".filmography-type")?.textContent.trim(),
        role: roleText.replace("·", "").trim(),
        posterAlt: poster?.getAttribute("alt") || "",
        posterKey: poster?.dataset.image || "",
        posterWidth: poster?.getBoundingClientRect().width || 0,
      };
    }),
  );
  assert.ok(fullCards.length > 9, "The full route should show more than the profile preview");
  assert.ok(fullCards.every(({ posterAlt, posterWidth }) => posterAlt.startsWith("Portada de ") && posterWidth > 0), "Every filmography card should show an accessible poster image");
  assert.ok(fullCards.some(({ posterKey }) => posterKey), "TMDB poster paths should be used when available");
  const mobileGrid = await page.locator(".filmography-list").evaluate((grid) => ({
    columns: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.equal(mobileGrid.columns, 2, "The phone layout should use two poster columns");
  assert.equal(mobileGrid.overflow, false, "The poster grid must not overflow on mobile");
  await page.setViewportSize({ width: 1280, height: 890 });
  const desktopGrid = await page.locator(".filmography-list").evaluate((grid) => ({
    columns: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.equal(desktopGrid.columns, 4, "The desktop layout should use four poster columns");
  assert.equal(desktopGrid.overflow, false, "The poster grid must not overflow on desktop");
  await page.setViewportSize({ width: 584, height: 890 });
  assert.deepEqual(
    fullCards.slice(0, 9).map(({ title, href, year, type }) => ({ title, href, year, type })),
    previewCredits,
    "Profile preview and full filmography must use identical filters and ordering",
  );
  assert.ok(fullCards.every(({ href }) => /^#detail\/(?:movie|tv)\/\d+$/.test(href)), "Each poster card should link directly to its movie or series detail");
  assert.ok(fullCards.some(({ role }) => role), "Acting credits should show character names");
  const knownYears = fullCards.map(({ year }) => Number(year)).filter(Number.isFinite),
    firstUnknownYear = fullCards.findIndex(({ year }) => year === "—");
  assert.deepEqual(knownYears, [...knownYears].sort((a, b) => b - a), "The grid should remain ordered from newest year to oldest");
  assert.ok(firstUnknownYear < 0 || fullCards.slice(firstUnknownYear).every(({ year }) => year === "—"), "Credits without a year should follow dated credits");
  const fullTitles = fullCards.map(({ title }) => title);
  assert.ok(fullTitles.some((title) => /Tulsa King/i.test(title)));
  assert.ok(!fullTitles.some((title) => /Tonight Show|Late Show|60 Minutes|The View|Family Stallone/i.test(title)), "Talk, news and reality appearances must not pollute the actor filmography");
  assert.ok(!fullCards.some(({ title, role }) => /Muppet Show|Teleñecos|This Is Us/i.test(title) || /special guest star/i.test(role)), "Self and guest-star appearances must not pollute the acting filmography");
  const firstCreditHref = fullCards[0].href;
  await page.locator(".filmography-card-link").first().click();
  await page.waitForFunction((href) => location.hash === href, firstCreditHref);
  await page.locator(".detail-heading h1").waitFor({ timeout: 30000 });
  await page.evaluate(() => { location.hash = "#filmography/16483"; });
  await page.waitForURL(/#filmography\/16483$/);
  await page.locator(".filmography-list .filmography-card").first().waitFor();
  console.log("PASS connected Stallone filmography: real posters, 2/4-column responsive grid, year/role order and detail links");
  await page.evaluate(() => { location.hash = "#person/16483"; });
  await page.waitForURL(/#person\/16483$/);
  await page.locator(".actor-title h1").waitFor();
  await page.locator('.section-head a[href="#filmography/16483"]').click();
  await page.waitForURL(/#filmography\/16483$/);
  await page.locator(".filmography-list .filmography-card").first().waitFor();
  assert.deepEqual(
    await page.locator(".filmography-list .filmography-card").evaluateAll((cards) =>
      cards.map((card) => ({
        title: card.querySelector(".filmography-title")?.textContent.trim(),
        href: card.querySelector(".filmography-card-link")?.getAttribute("href"),
        year: card.querySelector(".filmography-year")?.textContent.trim(),
      })),
    ),
    fullCards.map(({ title, href, year }) => ({ title, href, year })),
    "Ver todo must open the same visual filmography as Ver filmografía",
  );
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
  assert.match(await p.locator(".profile-note").innerText(), /2\.2\.6/);
  await p.evaluate(async () => await navigator.serviceWorker.ready);
  const shellState = await p.evaluate(async () => {
    const names = (await caches.keys()).filter((key) => key.startsWith("carimarshow-shell-")),
      shell = names.length ? await caches.open(names[0]) : null;
    return {
      names,
      index: !!(shell && await shell.match(location.origin + "/app/index.html")),
      app: !!(shell && await shell.match(location.origin + "/app/app.js")),
      lightbox: !!(shell && await shell.match(location.origin + "/app/modules/ui-lightbox.mjs")),

    };
  });
  assert.deepEqual(shellState.names, ["carimarshow-shell-v2.2.6-detail-explore2"], "The updated service worker must replace the prior offline shell");
  assert.equal(shellState.index, true, "The revisioned shell must retain the offline entry page");
  assert.equal(shellState.app, true, "The revisioned shell must retain the app script");
  assert.equal(shellState.lightbox, true, "The revisioned shell must retain the accessible image viewer module");
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

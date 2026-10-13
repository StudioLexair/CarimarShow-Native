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
  await page.goto(BASE + "/app/#profile");
  await page.locator(".profile-hero").waitFor();
  assert.match(await page.locator(".profile-note").innerText(), /2\.2\.1/);
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
  console.log("PASS only movies within same genre");
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
  assert.match(await p.locator(".profile-note").innerText(), /2\.2\.1/);
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

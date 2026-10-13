// Browser assertions against actual TMDB/IDB. Specific failures below are deliberately injected.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://localhost:8083";
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] }),
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    p = await ctx.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const seed = await (
    await ctx.request.get(BASE + "/app/catalog-snapshot.json")
  ).json();
  await p.goto(BASE + "/app/#explore");
  await p.locator("#query").waitFor();
  await p.locator("#filterButton").click();
  await p.selectOption("#filterType", "movie");
  await p.locator("#applyFilter").click();
  await p.fill("#query", "Dune");
  await p.locator("#searchForm").evaluate((f) => f.requestSubmit());
  await p.locator("#searchResults .card").first().waitFor();
  await p.evaluate(() => window.scrollTo(0, 250));
  const scroll = await p.evaluate(() => scrollY);
  await p.locator("#searchResults .poster-link").first().click();
  await p.locator(".detail-heading").waitFor();
  await p.locator('[data-detail-tab="cast"]').click();
  await p.locator("#detailContent .person-card").first().click();
  await p.locator(".actor-title").waitFor();
  await p.locator(".actor-actions a").click();
  await p.locator(".page-head").waitFor();
  await p.locator("#view .poster-link").first().click();
  await p.locator(".detail-heading").waitFor();
  await p.locator(".floating-tools [data-back]").click();
  await p.waitForURL(/#filmography\//);
  await p.locator(".page-head").waitFor();
  await p.locator(".page-head [data-back]").click();
  await p.waitForURL(/#person\//);
  await p.locator(".actor-title").waitFor();
  await p.locator(".floating-tools [data-back]").click();
  await p.waitForURL(/#detail\//);
  await p.locator('[data-detail-tab="cast"].active').waitFor();
  await p.locator(".floating-tools [data-back]").click();
  await p.waitForURL(/#explore/);
  await p.locator("#searchResults .card").first().waitFor();
  assert.equal(await p.inputValue("#query"), "Dune");
  assert.match(await p.locator("#searchFilterLabel").innerText(), /Películas/);
  assert.ok(Math.abs((await p.evaluate(() => scrollY)) - scroll) < 80);
  console.log(
    "PASS context: search → detail/cast → person → filmography → title → back; query/type/tab/scroll",
  );
  const selected = [
    seed.catalog.find((m) => m.media_type === "movie"),
    seed.catalog.find((m) => m.media_type === "tv"),
  ];
  assert.ok(selected.every(Boolean));
  await p.evaluate((list) => {
    localStorage.setItem("cs_list_v1", JSON.stringify([...list, list[0]]));
  }, selected);
  await p.reload();
  await p.locator("#query").waitFor();
  await p.locator('a[data-nav="list"]').click();
  await p.locator("#shareOrder").click();
  const links = await p
    .locator("[data-order-contact]")
    .evaluateAll((nodes) => nodes.map((n) => n.href));
  assert.deepEqual(
    links.map((u) => new URL(u).pathname),
    ["/5353324928", "/5378660658"],
  );
  const text = await p.inputValue("#orderMessage");
  assert.match(text, /Películas:/);
  assert.match(text, /Series:/);
  assert.match(text, /Total de títulos: 2/);
  for (const href of links)
    assert.equal(new URL(href).searchParams.get("text"), text);
  await p.locator("[data-close]").first().click();
  await p.reload();
  await p.locator("#shareOrder").waitFor();
  assert.equal(
    await p.evaluate(
      () => JSON.parse(localStorage.getItem("cs_list_v1")).length,
    ),
    2,
  );
  console.log(
    "PASS order: persistent dedupe, groups/years, two contacts in order, encoded message, no deletion",
  );
  await p.locator("[data-menu]").first().click();
  await p.locator("#moveLater").click();
  assert.equal(
    await p.evaluate(
      () => JSON.parse(localStorage.getItem("cs_list_v1"))[1].media_type,
    ),
    "movie",
  );
  await p.selectOption("#listSort", "title");
  await p.reload();
  await p.locator("#listSort").waitFor();
  assert.equal(await p.inputValue("#listSort"), "title");
  console.log("PASS organization: manual reorder and persistent title sort");
  await p.locator('a[data-nav="settings"]').click();
  await p.locator("#storageInfo").waitFor();
  await p.waitForFunction(
    () =>
      !document
        .querySelector("#storageInfo")
        .textContent.includes("Calculando"),
  );
  assert.match(await p.locator("#storageInfo").innerText(), /estimado/);
  assert.equal(
    await p.locator('a[href="mailto:carimarshowapk@qmail.com"]').count(),
    1,
  );
  assert.equal(
    await p.locator('a[href="mailto:studio.lexair@gmail.com"]').count(),
    2,
  );
  await p.locator(".business-logo").waitFor();
  assert.ok(
    await p
      .locator(".business-logo")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  );
  console.log(
    "PASS settings: actual stats, exact contacts, original logo, mobile overflow",
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  );
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  const storage = await p.evaluate(async () => {
    const s = await import("./modules/storage-cache.mjs"),
      policy = await import("./modules/storage-policy.mjs");
    const db = await s.dbPromise;
    await new Promise((resolve, reject) => {
      const tx = db.transaction("api", "readwrite");
      tx.objectStore("api").put(
        policy.record({ results: [] }, "api", Date.now() - 31 * 86400000),
        "expired-test",
      );
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    const expired = await s.dbGet("api", "expired-test");
    for (let i = 0; i < 105; i++)
      await s.dbPut(
        "images",
        "lru-test-" + i,
        new Blob(["x"], { type: "image/png" }),
      );
    const stats = await s.cacheStats();
    const big = await s.dbPut("api", "oversize-test", {
      text: "x".repeat(13 * 1024 * 1024),
    });
    const explicit = await s.dbPut("downloads", "quota-test", {
      text: "x".repeat(9 * 1024 * 1024),
    });
    return { expired, count: stats.images.count, big, explicit };
  });
  assert.equal(storage.expired, null);
  assert.ok(storage.count <= 100);
  assert.equal(storage.big, false);
  assert.equal(storage.explicit, false);
  console.log(
    "PASS IndexedDB: expiry removes stale data; LRU ≤100; oversized automatic/explicit writes rejected without deletion",
  );
  await ctx.route("**/api/tmdb?**", async (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get("query") === "InjectedZeroResult")
      return r.fulfill({
        contentType: "application/json",
        body: '{"results":[]}',
      });
    if (u.searchParams.get("query") === "InjectedInvalid")
      return r.fulfill({
        contentType: "application/json",
        body: '{"error":"Injected invalid payload"}',
      });
    return r.continue();
  });
  await p.locator('a[data-nav="explore"]').click();
  await p.locator("#query").fill("InjectedZeroResult");
  await p.locator("#searchForm").evaluate((f) => f.requestSubmit());
  await p.locator("#searchResults .empty").waitFor();
  assert.equal(await p.locator("#searchResults .notice").count(), 0);
  assert.match(
    await p.locator("#searchResults").innerText(),
    /se realizó correctamente/,
  );
  await p.fill("#query", "InjectedInvalid");
  await p.locator("#searchForm").evaluate((f) => f.requestSubmit());
  await p.locator("#retrySearch").waitFor();
  assert.equal(await p.locator("#searchResults .notice").count(), 1);
  assert.match(
    await p.locator("#searchResults").innerText(),
    /información local/,
  );
  console.log(
    "PASS injected failures: valid zero ≠ invalid response/local fallback",
  );
  assert.deepEqual(errors, []);
  console.log("PASS no JS errors");
  await ctx.close();
  // Migration from the real previous IDB schema, retaining an explicit download and its image.
  const old = await browser.newContext(),
    q = await old.newPage();
  await q.goto(BASE + "/app/config.js");
  const migration = selected[0];
  await q.evaluate(async (item) => {
    await new Promise((resolve, reject) => {
      const r = indexedDB.open("carimarshow-offline", 2);
      r.onupgradeneeded = () => {
        for (const name of ["api", "images", "downloads", "pinnedImages"])
          r.result.createObjectStore(name);
      };
      r.onerror = reject;
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction(
            ["api", "downloads", "pinnedImages"],
            "readwrite",
          );
        tx.objectStore("api").put({ results: [] }, "undated-old");
        tx.objectStore("downloads").put(
          {
            item,
            detail: item,
            images: ["migration-image"],
            savedAt: new Date().toISOString(),
          },
          item.media_type + ":" + item.id,
        );
        tx.objectStore("pinnedImages").put(
          new Blob(["image"]),
          "migration-image",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, migration);
  await q.goto(BASE + "/app/#downloads");
  await q.locator(".download-badge").waitFor();
  const upgraded = await q.evaluate(async () => {
    const s = await import("./modules/storage-cache.mjs");
    return {
      image: !!(await s.dbGet("pinnedImages", "migration-image")),
      old: await s.dbGet("api", "undated-old"),
      version: (await s.dbPromise).version,
    };
  });
  assert.deepEqual(upgraded, { image: true, old: null, version: 3 });
  console.log(
    "PASS IDB v2→v3: preserve dated download/pinned image; discard undated automatic cache",
  );
  await old.close();
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

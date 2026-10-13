const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://localhost:8083";
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] }),
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    page = await ctx.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/app/#list/movie");
  await page.locator("#shareOrder").waitFor();
  const selected = await page.evaluate(async () => {
    const { state } = await import("./modules/core-state.mjs");
    const movies = state.seed.catalog
        .filter((m) => m.media_type === "movie")
        .slice(0, 2),
      tv = state.seed.catalog.find((m) => m.media_type === "tv");
    state.list = [movies[0], tv, movies[1]];
    localStorage.setItem("cs_list_v1", JSON.stringify(state.list));
    const { listPage } = await import("./modules/views-list.mjs");
    listPage();
    return state.list;
  });
  await page.locator("[data-menu]").first().click();
  assert.equal(await page.locator("#moveEarlier").isDisabled(), true);
  await page.locator("#moveLater").click();
  assert.equal(
    await page.locator("[data-menu]").first().getAttribute("data-menu"),
    "movie:" + selected[2].id,
  );
  await page.locator("[data-menu]").first().click();
  await page.locator("#menuSave").click();
  assert.equal(await page.locator(".title-row").count(), 1);
  assert.equal(await page.locator("#shareOrder").isDisabled(), false);
  console.log(
    "PASS grouped reorder skips hidden series; edge action disabled; delete refreshes /list/movie",
  );
  await page.locator('[data-list-tab="tv"]').click();
  await page.waitForURL(/#list\/tv$/);
  await page.locator("[data-menu]").first().click();
  assert.equal(await page.locator("#moveEarlier").isDisabled(), true);
  assert.equal(await page.locator("#moveLater").isDisabled(), true);
  await page.locator("[data-close]").first().click();
  await page.reload();
  await page.locator('[data-list-tab="tv"].active').waitFor();
  await page.locator("[data-menu]").first().click();
  await page.locator("#menuSave").click();
  assert.equal(await page.locator(".title-row").count(), 0);
  assert.match(await page.locator(".empty").innerText(), /Aún no hay series/);
  console.log(
    "PASS series tab route and preference preserved; delete refreshes /list/tv",
  );
  await page.evaluate(() => localStorage.setItem("cs_list_sort_v1", "year"));
  await page.goto(BASE + "/app/#list/movie");
  await page.locator("#listSort").waitFor();
  assert.equal(await page.inputValue("#listSort"), "year");
  await page.selectOption("#listSort", "title");
  await page.reload();
  await page.locator("#listSort").waitFor();
  assert.equal(await page.inputValue("#listSort"), "title");
  console.log("PASS sort preference migration: unquoted 2.1.0 and new JSON");
  // Finish any earlier thumbnail fetch before setting up isolated cache records.
  await page.waitForLoadState("networkidle");
  const imageKey = await page.evaluate(async () => {
    const { state } = await import("./modules/core-state.mjs"),
      db = await import("./modules/storage-cache.mjs");
    await db.dbClear("api");
    await db.dbClear("images");
    const m = state.seed.catalog.find((m) => m.media_type === "movie"),
      detail = state.seed.details["movie/" + m.id];
    await db.dbPut(
      "api",
      new URLSearchParams({
        path: "movie/" + m.id,
        append_to_response: "credits,videos",
      }).toString(),
      detail,
    );
    const [key, file] = Object.entries(state.seed.images)[0];
    const blob = await (await fetch("/app/" + file)).blob();
    await db.dbPut("images", key, blob);
    await db.dbPut("pinnedImages", key, blob);
    await db.dbPut("downloads", "movie:" + m.id, {
      item: m,
      detail,
      images: [key],
      savedAt: new Date().toISOString(),
    });
    return key;
  });
  const personalBefore = await page.evaluate(() =>
    localStorage.getItem("cs_list_v1"),
  );
  await page.goto(BASE + "/app/#cache/data");
  await page.locator("[data-cache-delete]").first().waitFor();
  assert.doesNotMatch(
    await page.locator(".cache-entry strong").first().innerText(),
    /^Consulta guardada \d/,
  );
  page.once("dialog", (d) => d.accept());
  await page.locator("[data-cache-delete]").first().click();
  await page.waitForFunction(
    () => document.querySelectorAll(".cache-entry").length === 0,
  );
  await page.goto(BASE + "/app/#cache/images");
  const expectedLabel = "Imagen guardada · " + imageKey.split("/").pop();
  const imageRow = page
    .locator(".cache-entry")
    .filter({ hasText: expectedLabel });
  await imageRow.locator("[data-cache-image]").waitFor();
  await page.waitForFunction(
    (label) =>
      [...document.querySelectorAll(".cache-entry")].some(
        (row) =>
          row.textContent.includes(label) &&
          row.querySelector("img")?.naturalWidth > 0,
      ),
    expectedLabel,
  );
  page.once("dialog", (d) => d.accept());
  await imageRow.locator("[data-cache-delete]").click();
  await imageRow.waitFor({ state: "detached" });
  const removed = await page.evaluate(async (key) => {
    const db = await import("./modules/storage-cache.mjs");
    return await db.dbGet("images", key);
  }, imageKey);
  assert.equal(removed, null);
  const preserved = await page.evaluate(async () => {
    const db = await import("./modules/storage-cache.mjs");
    return {
      pins: (await db.dbAll("pinnedImages")).length,
      downloads: (await db.dbAll("downloads")).length,
      list: localStorage.getItem("cs_list_v1"),
    };
  });
  assert.equal(preserved.list, personalBefore);
  assert.equal(preserved.pins, 1);
  assert.equal(preserved.downloads, 1);
  console.log(
    "PASS meaningful cache labels, actual thumbnail, individual deletion; list/download/pinned image preserved",
  );
  await page.evaluate(async () => {
    const { state } = await import("./modules/core-state.mjs");
    window.originalSeed = state.seed;
    state.seed = {
      catalog: [],
      details: {},
      people: {},
      images: {},
      responses: {},
      generatedAt: state.seed.generatedAt,
    };
    const db = await import("./modules/storage-cache.mjs");
    await db.dbClear("api");
  });
  await ctx.route("**/api/tmdb?**", (route) =>
    new URL(route.request().url()).searchParams.get("path") ===
    "trending/all/week"
      ? route.abort()
      : route.continue(),
  );
  await page.goto(BASE + "/app/#home");
  await page.getByText("Tendencias no disponibles", { exact: true }).waitFor();
  const fresh = page.locator(".home-sections > section").nth(1);
  assert.ok((await fresh.locator(".card").count()) > 0);
  assert.ok((await page.locator("[data-retry]").count()) > 0);
  console.log(
    "PASS injected single-feed failure keeps the other real feed and displays retry, not a false empty",
  );
  await ctx.unroute("**/api/tmdb?**");
  await page.evaluate(async () => {
    const { state } = await import("./modules/core-state.mjs");
    state.seed = window.originalSeed;
  });
  await page.locator("[data-retry]").first().click();
  await page.locator(".hero").waitFor();
  assert.deepEqual(errors, []);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log("PASS retry restores home; no JS errors or mobile overflow");
  const safe = await page.evaluate(async () => {
    const { readChoice } = await import("./modules/storage-local.mjs");
    const original = Storage.prototype.getItem;
    try {
      Storage.prototype.getItem = () => {
        throw new Error("Injected storage restriction");
      };
      return readChoice(
        "cs_list_sort_v1",
        ["manual", "year", "title"],
        "manual",
      );
    } finally {
      Storage.prototype.getItem = original;
    }
  });
  assert.equal(safe, "manual");
  console.log("PASS restricted storage read degrades safely to default sort");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

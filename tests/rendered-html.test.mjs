import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the betting app shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Hedstabacken Open<\/title>/i);
  assert.match(html, /Familjens Premier League-tips/);
  assert.match(html, /Logga in/);
  assert.match(html, /PIN/);
  assert.match(html, /10\/omg\./);
  assert.match(html, /Import/);
  assert.match(html, /Laddar/);
  assert.match(html, /Slumpa ej tippade matcher/);
  assert.match(html, /Slumpa alla matcher i omgången/);
  assert.match(html, /id="matchday"/);
  assert.ok(html.indexOf("Tippa matcher") < html.indexOf("Slumpa ej tippade matcher"));
  assert.ok(html.indexOf("Slumpa alla matcher i omgången") < html.indexOf('id="matchday"'));
  assert.match(html, /Välj omgång/);
  assert.match(html, /id="tips-member"/);
  assert.match(html, /Kompakt totalställning/);
  assert.match(html, /Totalställning/);
  assert.match(html, /Poängtabell/);
  assert.match(html, /Premier League-tabellen/);
  assert.match(html, /aria-label="Premier League-tabell"/);
  assert.match(html, /100 poäng/);
  assert.match(html, /delas mellan dem som tippat rätt/);
  assert.match(html, /50 bonuspoäng/);
  assert.match(html, /flest matchpoäng i omgången/);
  assert.doesNotMatch(html, /Omgångsvinnare|Bonuspoäng|Flest omgångsvinster/);
  assert.doesNotMatch(html, /Det här är fortfarande demodata|Ej körd/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("removes starter preview code and dependency", async () => {
  const [page, layout, packageJson, previewFiles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(new URL("../app/_sites-preview/", import.meta.url)).catch(() => []),
  ]);

  assert.deepEqual(previewFiles, []);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(page, /1979|2468|1357|8642|PIN-koder i prototypen|sparade i prototypen/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

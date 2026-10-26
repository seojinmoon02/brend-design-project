import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5173");
  await page.locator('[data-tab="color"]').click();
  assert.equal(await page.locator("[data-swatch]").count(), 4);
  for (const n of [4, 5, 6]) {
    await page.locator("#palette-count").selectOption(String(n));
    assert.equal(await page.locator("[data-swatch]").count(), n);
    assert.equal(await page.locator("#palette-enabled").isChecked(), true);
  }
  for (const [i, c] of [
    "#C62948",
    "#3164D9",
    "#DBA233",
    "#74AE88",
    "#8C56AE",
    "#D87B44",
  ].entries())
    await page
      .locator(`[data-hex="${i}"]`)
      .fill(c)
      .then(() => page.locator(`[data-hex="${i}"]`).dispatchEvent("change"));
  assert.equal(
    new Set(
      await page
        .locator("#artwork g[data-instance]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("fill"))),
    ).size,
    6,
  );
  const svg = await page.locator("#artwork").innerHTML();
  await page.locator("#undo").click();
  assert.notEqual(await page.locator("#artwork").innerHTML(), svg);
  await page.locator("#redo").click();
  assert.equal(await page.locator("#artwork").innerHTML(), svg);
  const getProject = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("ftp-project")));
  const before = await getProject();
  await page.locator("#random-palette").click();
  const after = await getProject();
  assert.notDeepEqual(before.appearance.palette, after.appearance.palette);
  assert.deepEqual(before.layoutRecipe, after.layoutRecipe);
  assert.deepEqual(before.unitRecipe, after.unitRecipe);
  assert.equal(before.seed, after.seed);
  assert.equal(before.appearance.background, after.appearance.background);
  await page.locator('[data-effect="blurEnabled"]').check();
  await page.locator('[data-effect="grainEnabled"]').check();
  assert.ok(
    (await page.locator("#artwork g[data-instance][filter]").count()) > 0,
  );
  await page.locator('input[type=number][data-key="soft"]').fill("16");
  await page
    .locator('input[type=number][data-key="soft"]')
    .dispatchEvent("change");
  const effected = await getProject();
  assert.equal(effected.appearance.soft, 16);
  assert.equal(effected.appearance.grain, 0.35);
  await page.locator('[data-effect="blurEnabled"]').uncheck();
  assert.equal(
    await page.locator("#artwork g[data-instance][filter]").count(),
    0,
  );
  await page.locator('[data-effect="blurEnabled"]').check();
  assert.equal((await getProject()).appearance.soft, 16);
  let wait = page.waitForEvent("download");
  await page.locator("#save-project").click();
  await (await wait).saveAs("/tmp/palette-project.json");
  await page.reload();
  await page.locator('[data-tab="color"]').click();
  assert.equal(await page.locator("[data-swatch]").count(), 6);
  assert.deepEqual((await getProject()).appearance, effected.appearance);
  await page.locator("#random-palette").click();
  await page
    .locator("#project-file")
    .setInputFiles("/tmp/palette-project.json");
  await page.waitForFunction(() =>
    document
      .querySelector("#toast")
      .textContent.includes("프로젝트를 불러왔습니다"),
  );
  assert.deepEqual((await getProject()).appearance, effected.appearance);
  await page.locator("#export").click();
  await page.locator("#export-format").selectOption("svg");
  wait = page.waitForEvent("download");
  await page.locator("#do-export").click();
  await (await wait).saveAs("/tmp/palette-export.svg");
  const output = readFileSync("/tmp/palette-export.svg", "utf8");
  for (const c of effected.appearance.palette) assert.ok(output.includes(c));
  assert.ok(output.includes('stdDeviation="16"'));
  assert.ok(output.includes('filter="url(#pattern-texture)"'));
  await page.screenshot({ path: "/tmp/palette-desktop.png", fullPage: true });
  // Load a version-1 project written before palettes/toggles were introduced.
  const old = structuredClone(effected);
  for (const key of [
    "palette",
    "paletteEnabled",
    "paletteSeed",
    "blurEnabled",
    "grainEnabled",
  ])
    delete old.appearance[key];
  await page.locator("#project-file").setInputFiles({
    name: "old-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  assert.equal((await getProject()).appearance.paletteEnabled, false);
  assert.equal((await getProject()).appearance.soft, 16);
  assert.equal((await getProject()).appearance.blurEnabled, true);
  // Compare real raster pixels, not just filter attributes.
  const changes = await page.evaluate(async () => {
    const { initial, renderSVG } = await import("/src/engine.js");
    const s = initial();
    s.canvas.width = s.canvas.height = 300;
    s.layoutRecipe.density = 2;
    async function pixels() {
      const im = new Image();
      im.src =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(renderSVG(s));
      await im.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 300;
      c.getContext("2d").drawImage(im, 0, 0);
      return c.getContext("2d").getImageData(0, 0, 300, 300).data;
    }
    const a = await pixels();
    s.appearance.soft = 16;
    s.appearance.blurEnabled = true;
    const b = await pixels();
    s.appearance.blurEnabled = false;
    s.appearance.grain = 0.9;
    s.appearance.grainEnabled = true;
    const c = await pixels();
    const diff = (x, y) =>
      x.reduce((n, v, i) => n + Math.abs(v - y[i]), 0) / x.length;
    return [diff(a, b), diff(a, c)];
  });
  assert.ok(
    changes.every((x) => x > 1),
    `pixel changes ${changes}`,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 4/5/6 manual colors, HEX, stable fills, seeded random palette, undo/redo, effect toggles, JSON round trip, legacy migration, SVG export, raster blur/grain pixel changes, responsive layout.",
  );
} finally {
  await browser.close();
}

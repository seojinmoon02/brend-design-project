import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
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
  await page.waitForSelector("#artwork svg");
  await page.screenshot({
    path: "/tmp/form-pattern-desktop.png",
    fullPage: true,
  });
  assert.equal(await page.locator(".preset").count(), 6);
  const signatures = [];
  for (const p of ["A", "B", "C", "D", "E", "F"]) {
    await page.locator(`[data-preset="${p}"]`).click();
    signatures.push(await page.locator("#artwork").innerHTML());
  }
  assert.equal(new Set(signatures).size, 6);
  await page.locator('[data-preset="E"]').click();
  await page.locator("#source-file").setInputFiles({
    name: "asymmetric-hole.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path fill-rule="evenodd" d="M0 0H300V100H0Z M20 20V80H100V20Z"/><script>alert(1)</script></svg>',
    ),
  });
  await page.waitForFunction(
    () =>
      document.querySelector("#source-name").textContent ===
      "asymmetric-hole.svg",
  );
  assert.equal(
    await page
      .locator('#artwork [id="pattern-source"] path')
      .getAttribute("fill-rule"),
    "evenodd",
  );
  assert.equal(await page.locator("#artwork script").count(), 0);
  await page.locator('[data-tab="color"]').click();
  await page.locator('[data-palette="1"]').click();
  await page.locator("#undo").click();
  await page.locator("#redo").click();
  const save = page.waitForEvent("download");
  await page.locator("#save-project").click();
  const project = await save;
  assert.equal(project.suggestedFilename(), "form-to-pattern.json");
  await project.saveAs("/tmp/form-pattern-project.json");
  await page.locator('[data-preset="A"]').click();
  await page
    .locator("#project-file")
    .setInputFiles("/tmp/form-pattern-project.json");
  await page.waitForSelector('[data-preset="E"].active');
  await page.locator('[data-mode="motion"]').click();
  await page.locator("#timeline").fill("3");
  await page.locator("#timeline").dispatchEvent("input");
  assert.match(await page.locator("#time-label").textContent(), /^3.00/);
  for (const f of ["svg", "png", "tile", "process"]) {
    await page.locator("#export").click();
    await page.locator("#export-format").selectOption(f);
    await page.locator("#export-size").selectOption("540");
    const pending = page.waitForEvent("download");
    await page.locator("#do-export").click();
    const dl = await pending;
    await dl.saveAs(`/tmp/form-pattern-${f}.${f === "svg" ? "svg" : "png"}`);
    await page.waitForFunction(
      () => !document.querySelector("#export-dialog").open,
    );
  }
  await page.locator('input[type="number"][data-key="duration"]').fill("1");
  await page
    .locator('input[type="number"][data-key="duration"]')
    .dispatchEvent("change");
  await page.locator('input[type="number"][data-key="fps"]').fill("3");
  await page
    .locator('input[type="number"][data-key="fps"]')
    .dispatchEvent("change");
  await page.locator("#export").click();
  await page.locator("#export-format").selectOption("frames");
  await page.locator("#export-size").selectOption("540");
  let pending = page.waitForEvent("download");
  await page.locator("#do-export").click();
  await (await pending).saveAs("/tmp/form-pattern-frames.zip");
  await page.waitForFunction(
    () => !document.querySelector("#export-dialog").open,
  );
  const frames = unzipSync(
    new Uint8Array(readFileSync("/tmp/form-pattern-frames.zip")),
  );
  assert.equal(Object.keys(frames).filter((n) => n.endsWith(".png")).length, 3);
  const image = readFileSync("/tmp/form-pattern-png.png");
  assert.equal(image.readUInt32BE(16), 540);
  assert.equal(image.readUInt32BE(20), 540);
  const processImage = readFileSync("/tmp/form-pattern-process.png");
  assert.equal(processImage.readUInt32BE(16), 1620);
  await page.locator("#rewind").click();
  await page.locator("#export").click();
  await page.locator("#export-format").selectOption("png");
  await page.locator("#export-size").selectOption("540");
  pending = page.waitForEvent("download");
  await page.locator("#do-export").click();
  await (await pending).saveAs("/tmp/form-pattern-frame-zero.png");
  await page.waitForFunction(
    () => !document.querySelector("#export-dialog").open,
  );
  assert.deepEqual(
    new Uint8Array(readFileSync("/tmp/form-pattern-frame-zero.png")),
    frames["frame-00000.png"],
  );
  assert.notDeepEqual(frames["frame-00000.png"], frames["frame-00002.png"]);
  // The same rendering function produces a full lattice and the repeated tile.
  const seamError = await page.evaluate(async () => {
    const { initial, renderSVG } = await import("/src/engine.js");
    const s = initial();
    s.canvas.width = s.canvas.height = 224;
    s.layoutRecipe.density = 1;
    s.layoutRecipe.gap = 0;
    async function raster(svg, w) {
      const im = new Image();
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      await im.decode();
      const c = document.createElement("canvas");
      c.width = c.height = w;
      c.getContext("2d").drawImage(im, 0, 0);
      return c;
    }
    const tile = await raster(renderSVG(s), 224);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 672;
    const ctx = canvas.getContext("2d");
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) ctx.drawImage(tile, x * 224, y * 224);
    s.canvas.width = s.canvas.height = 672;
    s.layoutRecipe.density = 3;
    const full = await raster(renderSVG(s), 672);
    const a = ctx.getImageData(0, 0, 672, 672).data,
      b = full.getContext("2d").getImageData(0, 0, 672, 672).data;
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference += Math.abs(a[i] - b[i]);
    return difference / a.length;
  });
  assert.ok(
    seamError < 0.1,
    `tile/full lattice average pixel error ${seamError}`,
  );
  await page.locator('[data-mode="compare"]').click();
  await page.locator("#capture").click();
  await page.locator("#density").click();
  assert.equal(await page.locator("[data-variant]").count(), 5);
  await page.locator('[data-variant="0"]').click();
  assert.equal(await page.locator(".comparison").count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/form-pattern-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 6 presets, SVG hole / sanitizer, undo / redo, JSON round trip, timeline, SVG / PNG / tile / process / ZIP exports, comparison and mobile layout; no browser exceptions.",
  );
} finally {
  await browser.close();
}

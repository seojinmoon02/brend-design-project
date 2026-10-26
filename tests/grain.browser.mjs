import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 620 } });
try {
  await page.goto("http://127.0.0.1:5173");
  const results = await page.evaluate(async () => {
    const { initial, renderSVG } = await import("/src/engine.js");
    const s = initial();
    s.canvas.width = s.canvas.height = 240;
    s.unitRecipe.size = 88;
    s.source.markup = '<rect x="-72" y="-72" width="144" height="144"/>';
    async function sample() {
      const im = new Image();
      im.src =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          renderSVG(s, 0, { sourceOnly: true, transparent: true }),
        );
      await im.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 240;
      c.getContext("2d").drawImage(im, 0, 0);
      const d = c.getContext("2d").getImageData(80, 80, 80, 80).data;
      const v = [];
      for (let i = 0; i < d.length; i += 4)
        v.push((d[i] + d[i + 1] + d[i + 2]) / 3);
      const mean = v.reduce((a, b) => a + b) / v.length;
      return {
        std: Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length),
        alpha: c
          .getContext("2d")
          .getImageData(0, 0, 240, 240)
          .data.filter((_, i) => i % 4 === 3),
      };
    }
    const results = [];
    for (const color of ["#FF471A", "#FFFFFF", "#161616", "#6F92B8"]) {
      s.appearance.primary = color;
      s.appearance.grainEnabled = false;
      s.appearance.blurEnabled = false;
      const flat = await sample();
      s.appearance.grainEnabled = true;
      s.appearance.grain = 0.35;
      const grain = await sample();
      s.appearance.grain = 0.8;
      const strong = await sample();
      s.appearance.soft = 16;
      s.appearance.blurEnabled = true;
      const both = await sample();
      s.appearance.grainEnabled = false;
      const blur = await sample();
      results.push({
        color,
        flat: flat.std,
        grain: grain.std,
        strong: strong.std,
        both: both.std,
        blur: blur.std,
        alphaError: Math.max(
          ...both.alpha.map((a, i) => Math.abs(a - blur.alpha[i])),
        ),
      });
    }
    const demo = initial();
    demo.canvas.width = demo.canvas.height = 300;
    demo.layoutRecipe.density = 2;
    demo.unitRecipe.size = 64;
    demo.unitRecipe.radius = 45;
    demo.appearance.paletteEnabled = true;
    let html =
      '<body style="margin:0;padding:24px;background:#f4f3ef;font:14px sans-serif"><h2>Grain visibility — same palette and shape</h2><div style="display:flex;gap:16px">';
    for (const [i, label, g, b] of [
      [0, "OFF", false, false],
      [1, "GRAIN 0.35", true, false],
      [2, "BLUR 16", false, true],
      [3, "BLUR + GRAIN", true, true],
    ]) {
      demo.appearance.grainEnabled = g;
      demo.appearance.grain = 0.35;
      demo.appearance.blurEnabled = b;
      demo.appearance.soft = 16;
      html += `<div style="width:270px"><p>${label}</p>${renderSVG(demo, 0, { namespace: "test-" + i })}</div>`;
    }
    document.body.innerHTML = html + "</div></body>";
    return results;
  });
  for (const r of results) {
    assert.ok(r.grain > 3, `${r.color}: default grain visibility ${r.grain}`);
    assert.ok(
      r.strong > r.grain * 1.5,
      `${r.color}: strength increases contrast`,
    );
    assert.ok(r.both > r.blur + 4, `${r.color}: grain survives blur`);
    assert.ok(
      r.alphaError <= 1,
      `${r.color}: alpha changed by ${r.alphaError}`,
    );
  }
  await page.screenshot({ path: "/tmp/grain-compare.png", fullPage: true });
  console.log(
    "PASS: default grain visible on orange/white/dark/blue, strength increases contrast, grain survives blur and preserves alpha.",
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}

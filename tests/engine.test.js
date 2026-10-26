import { test } from "node:test";
import assert from "node:assert/strict";
import { initial, renderSVG, randomize } from "../src/engine.js";
test("A–F have distinct structural output and source is defined once", () => {
  const outputs = [];
  for (const preset of ["A", "B", "C", "D", "E", "F"]) {
    const s = initial();
    s.layoutRecipe.preset = preset;
    let svg = renderSVG(s);
    assert.equal((svg.match(/<path d="M-34/g) || []).length, 1);
    const ids = [...svg.matchAll(/data-instance="([^"]+)"/g)].map((x) => x[1]);
    assert.equal(ids.length, new Set(ids).size);
    outputs.push(svg);
  }
  assert.equal(new Set(outputs).size, 6);
});
test("project round trip and seeded variation are deterministic", () => {
  const s = initial();
  assert.equal(renderSVG(s), renderSVG(JSON.parse(JSON.stringify(s))));
  assert.deepEqual(randomize(s), randomize(s));
  let locked = randomize(s, { unit: true, color: true, layout: true });
  assert.deepEqual(locked, s);
});
test("all seven loop modes close at the exact period for noninteger amount", () => {
  for (const type of [
    "rotate",
    "internal",
    "breathe",
    "density",
    "wave",
    "flow",
    "color",
  ]) {
    const s = initial();
    s.motion.type = type;
    s.motion.amount = 1.3;
    assert.equal(renderSVG(s, 0), renderSVG(s, s.motion.duration), type);
  }
});
test("new source preserves unit count, holes and aspect-ratio transform", () => {
  const s = initial();
  const count = (renderSVG(s).match(/data-instance/g) || []).length;
  s.source.markup =
    '<g transform="scale(.48) translate(-150 -50)"><path fill-rule="evenodd" d="M0 0H300V100H0Z M20 20V80H100V20Z"/></g>';
  const result = renderSVG(s);
  assert.equal((result.match(/data-instance/g) || []).length, count);
  assert.match(result, /fill-rule="evenodd"/);
  assert.match(result, /scale\(.48\)/);
});
test("frame sides are generated once per geometric edge", () => {
  const s = initial();
  s.layoutRecipe.preset = "C";
  const svg = renderSVG(s);
  const positions = [
    ...svg.matchAll(/data-instance="[^"]+" transform="([^"]+)"/g),
  ].map((x) => x[1]);
  assert.equal(new Set(positions).size, positions.length);
});
test("structure and exported pattern omit editing guides by default", () => {
  const svg = renderSVG(initial());
  assert.doesNotMatch(svg, /stroke-dasharray/);
  assert.doesNotMatch(svg, /SOURCE TRANSFORM|PATTERN EXPLORATION/);
});

test("4–6 colors appear in every preset, with stable assignments and loop closure", async () => {
  const { generatePalette, paletteIndex } = await import("../src/engine.js");
  for (const n of [4, 5, 6])
    for (const preset of ["A", "B", "C", "D", "E", "F"]) {
      const s = initial();
      s.layoutRecipe.preset = preset;
      s.appearance.paletteEnabled = true;
      s.appearance.palette = generatePalette(n, 7);
      const svg = renderSVG(s, 0);
      for (const color of s.appearance.palette)
        assert.ok(
          svg.includes(`fill="${color}"`),
          `${preset}/${n} missing ${color}`,
        );
      assert.equal(renderSVG(JSON.parse(JSON.stringify(s))), svg);
      s.motion.type = "color";
      assert.equal(renderSVG(s, 0), renderSVG(s, 6));
      for (let row = -3; row < 3; row++)
        assert.equal(
          paletteIndex(`${row}:2-4`, n),
          paletteIndex(`${row + n}:2-4`, n),
        );
    }
  assert.deepEqual(generatePalette(6, 42), generatePalette(6, 42));
  assert.notDeepEqual(generatePalette(6, 42), generatePalette(6, 43));
});
test("effect toggles preserve intensity and remove filters from instances", () => {
  const s = initial();
  s.appearance.soft = 16;
  s.appearance.grain = 0.7;
  assert.doesNotMatch(renderSVG(s), /<g data-instance[^>]*filter=/);
  s.appearance.blurEnabled = true;
  s.appearance.grainEnabled = true;
  assert.match(renderSVG(s), /stdDeviation="16"/);
  assert.match(renderSVG(s), /filter="url\(#pattern-texture\)"/);
  const structure = renderSVG(s, 0, { structure: true });
  assert.doesNotMatch(structure, /<g data-instance[^>]*filter=/);
  s.appearance.blurEnabled = false;
  s.appearance.grainEnabled = false;
  assert.equal(s.appearance.soft, 16);
  assert.doesNotMatch(renderSVG(s), /filter="url\(#pattern-texture\)"/);
});

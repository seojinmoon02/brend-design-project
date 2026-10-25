export const demo =
  '<path d="M-34-62 Q-34-72-24-72 H3 Q13-72 13-62 V-15 H24 Q34-15 34-5 V62 Q34 72 24 72 H-3 Q-13 72-13 62 V15 H-24 Q-34 15-34 5Z"/>';
export const presets = [
  ["A", "기본 반복", "같은 형태, 규칙적인 리듬", "03–04"],
  ["B", "두 크기 엇갈림", "크기 사이에서 생기는 리듬", "05–07"],
  ["C", "직렬쌍 프레임", "비워진 중심을 둘러싼 조형", "08–09"],
  ["D", "방사 + 프레임", "두 가지 질서의 만남", "10–12"],
  ["E", "방사 유닛 반복", "하나에서 여덟 방향으로", "13–14"],
  ["F", "4 · 8방향 재구성", "서로 다른 중심의 교차", "15–17"],
];
export const initial = () => ({
  version: 1,
  title: "이름 없는 실험",
  source: {
    kind: "svg",
    markup: demo,
    name: "계단형 조형",
    note: "레퍼런스 설명 기반 근사 벡터",
  },
  unitRecipe: {
    size: 72,
    rotation: 0,
    angle: 0,
    radius: 58,
    count: 8,
    pairGap: 42,
    edgeCopies: 2,
    centerGap: 0,
    small: 0.55,
    cx: 0,
    cy: 0,
    orientation: 0,
    anchor: 0,
  },
  layoutRecipe: {
    preset: "E",
    density: 5,
    gap: 8,
    stagger: 0.5,
    offsetX: 0,
    offsetY: 0,
  },
  appearance: {
    background: "#F2F0E9",
    primary: "#FF471A",
    secondary: "#FF471A",
    stroke: "#F2F2F2",
    strokeWidth: 0,
    grain: 0,
    light: 0,
    soft: 0,
    effectRole: "all",
    original: false,
  },
  motion: {
    type: "rotate",
    duration: 6,
    fps: 30,
    amount: 1,
    speed: 1,
    direction: 1,
    stagger: 0.2,
    easing: "smooth",
    formation: false,
    pingpong: false,
  },
  seed: 42,
  canvas: { width: 1080, height: 1080, tile: false },
});
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function renderSVG(
  s,
  t = 0,
  {
    width = s.canvas.width,
    height = s.canvas.height,
    unitOnly = false,
    sourceOnly = false,
    transparent = false,
    structure = false,
    guides = false,
    namespace = "pattern",
    motionEnabled = true,
  } = {},
) {
  let u = { ...s.unitRecipe },
    l = { ...s.layoutRecipe },
    a = { ...s.appearance };
  const m = motionEnabled
    ? s.motion
    : { ...s.motion, type: "none", formation: false };
  if (m.type === "states" && m.keyStates?.start && m.keyStates?.end) {
    let f = (1 - Math.cos((2 * Math.PI * t) / m.duration)) / 2;
    if (m.easing === "linear") f = 1 - Math.abs(((t / m.duration) % 1) * 2 - 1);
    for (const [group, obj] of [
      ["unitRecipe", u],
      ["layoutRecipe", l],
      ["appearance", a],
    ]) {
      for (const key of Object.keys(obj)) {
        const av = m.keyStates.start[group]?.[key],
          bv = m.keyStates.end[group]?.[key];
        if (
          typeof av === "number" &&
          typeof bv === "number" &&
          !["count", "edgeCopies"].includes(key)
        )
          obj[key] = av + (bv - av) * f;
        if (
          typeof av === "string" &&
          /^#[0-9a-f]{6}$/i.test(av) &&
          /^#[0-9a-f]{6}$/i.test(bv)
        ) {
          const rgb = [1, 3, 5].map((i) =>
            Math.round(
              parseInt(av.slice(i, i + 2), 16) * (1 - f) +
                parseInt(bv.slice(i, i + 2), 16) * f,
            )
              .toString(16)
              .padStart(2, "0"),
          );
          obj[key] = "#" + rgb.join("");
        }
      }
    }
  }
  const p = l.preset;
  const phase = ((((t / m.duration) * m.direction) % 1) + 1) % 1,
    theta = phase * Math.PI * 2,
    cyc = Math.sin(theta),
    cell = (s.canvas.width / l.density + l.gap) * (width / s.canvas.width);
  const form = m.formation
    ? m.pingpong
      ? (1 - Math.cos(theta)) / 2
      : Math.min(1, t / m.duration)
    : 1;
  const growth = m.formation ? Math.min(1, form * 2) : 1;
  const radius =
    (u.radius + (u.centerGap || 0)) *
    (m.type === "breathe" && !m.formation ? 1 + 0.32 * cyc * m.amount : 1) *
    growth;
  const loopAngle =
    m.amount === 0 ? 0 : phase * 360 + Math.sin(theta) * 90 * (m.amount - 1);
  const globalRotation =
    u.rotation + (m.type === "rotate" && !m.formation ? loopAngle : 0);
  let items = [];
  const size =
    u.size *
    (m.type === "density" && !m.formation ? 1 + 0.2 * cyc * m.amount : 1);
  function add(x, y, angle = 0, scale = 1, role = "primary", id = "") {
    items.push({ x, y, angle, scale, role, id });
  }
  function radial(x, y, n, r, scale = 1, id = "r") {
    for (let i = 0; i < n; i++) {
      let ang = (i * 360) / n + u.angle + globalRotation;
      let rad = (ang * Math.PI) / 180;
      add(
        x + Math.cos(rad) * r,
        y + Math.sin(rad) * r,
        ang + 90 + u.orientation,
        scale,
        i % 2 ? "secondary" : "primary",
        `${id}-${i}`,
      );
    }
  }
  function frame(x, y, c, id) {
    const half = c / 2;
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < (u.edgeCopies || 2); k++) {
        const delta = (k - ((u.edgeCopies || 2) - 1) / 2) * u.pairGap;
        if (side === 0)
          add(x + delta, y - half, 90, 1, "secondary", `${id}-h${k}`);
        else add(x - half, y + delta, 0, 1, "secondary", `${id}-v${k}`);
      }
    }
  }
  if (sourceOnly) add(width / 2, height / 2, 0, 2, "primary", "source");
  else if (unitOnly) {
    if (p === "A" || p === "B") add(width / 2, height / 2);
    else if (p === "C") {
      add(width / 2 - u.pairGap / 2, height / 2, 90);
      add(width / 2 + u.pairGap / 2, height / 2, 90);
    } else radial(width / 2, height / 2, u.count, radius, 1);
  } else {
    const extra = Math.ceil((radius + size * 2) / cell) + 1;
    for (let row = -extra; row <= Math.ceil(height / cell) + extra; row++)
      for (let col = -extra; col <= l.density + extra; col++) {
        let x = (col + 0.5) * cell + l.offsetX,
          y = (row + 0.5) * cell + l.offsetY;
        if (m.type === "flow" && !m.formation) {
          x += phase * cell;
          y += phase * cell;
        }
        let id = `${row}:${col}`;
        if (m.formation) {
          let delay = Math.min(
            0.45,
            (Math.hypot(x - width / 2, y - height / 2) /
              Math.hypot(width, height)) *
              m.stagger,
          );
          if (form < delay) continue;
          x =
            width / 2 +
            (x - width / 2) * Math.min(1, Math.max(0, (form - delay) * 2));
          y =
            height / 2 +
            (y - height / 2) * Math.min(1, Math.max(0, (form - delay) * 2));
        }
        if (p === "A") add(x, y, 0, 1, "primary", id);
        if (p === "B") {
          add(x, y, 0, 1, "primary", id);
          add(
            x + cell / 2,
            y + cell * l.stagger,
            0,
            u.small,
            "secondary",
            `${id}-s`,
          );
        }
        if (p === "C" || p === "D") frame(x, y, cell, id);
        if (p === "D" || p === "E" || p === "F")
          radial(x, y, u.count, radius, 1, id);
        if (p === "F")
          radial(
            x + cell / 2,
            y + cell / 2,
            4,
            radius * u.small,
            u.small,
            `${id}-4`,
          );
      }
  }
  let filter = `<filter id="texture" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" seed="${s.seed}" result="noise"/><feColorMatrix in="noise" type="saturate" values="0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="soft-light"/></filter><filter id="soft"><feGaussianBlur stdDeviation="${a.soft}"/></filter>`;
  const fill = (role) => (structure ? "#292a28" : a[role]);
  if (m.formation && form < 0.02)
    items = [
      {
        x: width / 2,
        y: height / 2,
        angle: 0,
        scale: 1,
        role: "primary",
        id: "formation-source",
      },
    ];
  let content = items
    .map((v, i) => {
      let angle =
        v.angle +
        (sourceOnly || ["D", "E", "F"].includes(p) ? 0 : globalRotation);
      if (m.type === "internal" && !m.formation) angle += loopAngle;
      if (m.type === "wave" && !m.formation)
        angle +=
          Math.sin(theta + (v.x / width + v.y / height) * Math.PI * 2) *
          30 *
          m.amount;
      let color = fill(v.role);
      if (m.type === "color" && !m.formation)
        color = `hsl(${(phase * 360 + (v.role === "primary" ? 15 : 210)) % 360} 85% 55%)`;
      const effect = a.effectRole === "all" || a.effectRole === v.role;
      return `<g data-instance="${esc(v.id || String(i))}" transform="translate(${v.x} ${v.y}) rotate(${angle}) scale(${(size / 144) * v.scale}) translate(${-u.cx + u.anchor} ${-u.cy})" fill="${color}" stroke="${structure ? "none" : a.stroke}" stroke-width="${a.strokeWidth}" ${effect && a.soft && !structure ? 'filter="url(#soft)"' : ""}><use href="#source"/>${effect && a.grain && !structure ? `<use href="#source" filter="url(#texture)" opacity="${a.grain}"/>` : ""}${effect && a.light && !structure ? `<use href="#source" fill="url(#shine)" opacity="${a.light}"/>` : ""}</g>`;
    })
    .join("");
  if (guides)
    content += `<path d="M${width / 2} 0V${height}M0 ${height / 2}H${width}" stroke="#555" opacity=".3" stroke-dasharray="5 8" fill="none"/>`;
  let output = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><g id="source">${s.source.markup}</g>${filter}<linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs>${transparent ? "" : `<rect width="100%" height="100%" fill="${structure ? "#f2f0e9" : a.background}"/>`}${content}</svg>`;
  const prefix = String(namespace).replace(/[^a-zA-Z0-9_-]/g, "");
  output = output
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/href="#([^"]+)"/g, (_, id) => `href="#${prefix}-${id}"`)
    .replace(/url\(#([^)]*)\)/g, (_, id) => `url(#${prefix}-${id})`);
  return output;
}
export function randomize(s, locks = {}) {
  let n = s.seed;
  const random = () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
  let r = structuredClone(s);
  if (!locks.unit) {
    r.unitRecipe.radius = 25 + random() * 50;
    r.unitRecipe.angle = Math.round(random() * 360);
    r.unitRecipe.size = 25 + random() * 50;
  }
  if (!locks.layout) {
    r.layoutRecipe.density = 3 + Math.floor(random() * 4);
    r.layoutRecipe.preset = ["A", "B", "C", "D", "E", "F"][
      Math.floor(random() * 6)
    ];
  }
  if (!locks.color) {
    let colors = ["#FF471A", "#6F92B8", "#B6975B", "#161616"];
    r.appearance.primary = colors[Math.floor(random() * 4)];
  }
  return r;
}

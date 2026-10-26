import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource-variable/noto-sans-kr";
import {
  createIcons,
  Asterisk,
  Undo2,
  Redo2,
  Save,
  ArrowUpRight,
  RotateCcw,
  ChevronDown,
  CheckSquare,
  Square,
  Grid3x3,
  Info,
  Upload,
  FolderOpen,
  ScanLine,
  Crosshair,
  PanelLeftClose,
  Maximize,
  Scan,
  Minus,
  Plus,
  Grid2x2,
  ArrowRight,
  Play,
  Pause,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Shuffle,
  Lock,
  Unlock,
  X,
  Download,
} from "lucide";
const icons = {
  Asterisk,
  Undo2,
  Redo2,
  Save,
  ArrowUpRight,
  RotateCcw,
  ChevronDown,
  CheckSquare,
  Square,
  Grid3x3,
  Info,
  Upload,
  FolderOpen,
  ScanLine,
  Crosshair,
  PanelLeftClose,
  Maximize,
  Scan,
  Minus,
  Plus,
  Grid2x2,
  ArrowRight,
  Play,
  Pause,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Shuffle,
  Lock,
  Unlock,
  X,
  Download,
};
import { zipSync, strToU8 } from "fflate";
import {
  initial,
  presets,
  renderSVG,
  randomize,
  demo,
  generatePalette,
  tileRecipe,
} from "./engine.js";
import "./style.css";
const $ = (s) => document.querySelector(s);
let state = initial();
try {
  const saved = localStorage.getItem("ftp-project");
  if (saved) state = validate(JSON.parse(saved));
} catch {}
let history = [],
  future = [],
  mode = "pattern",
  tab = "unit",
  time = 0,
  playing = false,
  last = 0,
  zoom = 1,
  guides = false,
  structure = false,
  panels = true,
  compare = null,
  variants = [],
  locks = {},
  cancelled = false;
const icon = (name, size = 16) =>
  `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
const button = (id, name, title, cls = "") =>
  `<button id="${id}" class="icon-btn ${cls}" title="${title}" aria-label="${title}">${icon(name)}</button>`;
function validate(v) {
  const base = initial();
  if (
    v?.version !== 1 ||
    !v.source?.markup ||
    !v.unitRecipe ||
    !v.layoutRecipe ||
    !v.appearance ||
    !v.motion ||
    !v.canvas
  )
    throw Error("올바른 프로젝트 파일이 아닙니다.");
  if (v.appearance.blurEnabled === undefined)
    v.appearance.blurEnabled = v.appearance.soft > 0;
  if (v.appearance.grainEnabled === undefined)
    v.appearance.grainEnabled = v.appearance.grain > 0;
  for (const group of [
    "unitRecipe",
    "layoutRecipe",
    "appearance",
    "motion",
    "canvas",
  ]) {
    for (const [key, value] of Object.entries(base[group])) {
      if (v[group][key] === undefined) v[group][key] = value;
      if (
        typeof value === "number" &&
        (!Number.isFinite(v[group][key]) ||
          Math.abs(v[group][key]) >
            (key === "paletteSeed" ? 4294967295 : 100000))
      )
        throw Error("프로젝트 설정값을 확인하세요.");
    }
  }
  if (
    v.layoutRecipe.density < 2 ||
    v.layoutRecipe.density > 12 ||
    v.motion.duration < 1 ||
    v.motion.fps < 1 ||
    v.motion.fps > 60 ||
    v.canvas.width < 64 ||
    v.canvas.width > 4096 ||
    v.canvas.height < 64 ||
    v.canvas.height > 4096
  )
    throw Error("지원 범위를 벗어난 설정입니다.");
  if (
    !["svg", "png"].includes(v.source.kind) ||
    !["A", "B", "C", "D", "E", "F"].includes(v.layoutRecipe.preset) ||
    !Number.isInteger(v.seed) ||
    v.seed < 0
  )
    throw Error("지원하지 않는 프로젝트 구조입니다.");
  for (const key of ["background", "primary", "secondary", "stroke"])
    if (!/^#[0-9a-f]{6}$/i.test(v.appearance[key]))
      throw Error("올바른 색상값이 아닙니다.");
  if (
    !Array.isArray(v.appearance.palette) ||
    v.appearance.palette.length < 4 ||
    v.appearance.palette.length > 6 ||
    v.appearance.palette.some(
      (c) => typeof c !== "string" || !/^#[0-9a-f]{6}$/i.test(c),
    ) ||
    !["paletteEnabled", "blurEnabled", "grainEnabled"].every(
      (k) => typeof v.appearance[k] === "boolean",
    ) ||
    !Number.isInteger(v.appearance.paletteSeed) ||
    v.appearance.paletteSeed < 0
  )
    throw Error("팔레트 설정을 확인하세요.");
  const ranges = {
    size: [12, 140],
    radius: [0, 110],
    count: [4, 12],
    pairGap: [10, 160],
    edgeCopies: [1, 6],
    centerGap: [0, 60],
    small: [0.15, 1],
    cx: [-72, 72],
    cy: [-72, 72],
    anchor: [-72, 72],
  };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (v.unitRecipe[key] === undefined)
      v.unitRecipe[key] = base.unitRecipe[key];
    if (v.unitRecipe[key] < min || v.unitRecipe[key] > max)
      throw Error("조형 설정이 지원 범위를 벗어났습니다.");
  }
  if (
    v.appearance.grain < 0 ||
    v.appearance.grain > 1 ||
    v.appearance.grainSize < 1 ||
    v.appearance.grainSize > 8 ||
    v.appearance.soft < 0 ||
    v.appearance.soft > 24
  )
    throw Error("효과 설정을 확인하세요.");
  if (
    v.layoutRecipe.gap < 0 ||
    v.layoutRecipe.gap > 80 ||
    v.layoutRecipe.stagger < 0 ||
    v.layoutRecipe.stagger > 1 ||
    v.motion.duration > 20 ||
    ![1, -1].includes(v.motion.direction) ||
    v.motion.amount < 0 ||
    v.motion.amount > 2 ||
    v.motion.speed < 0.25 ||
    v.motion.speed > 3
  )
    throw Error("배열 또는 모션 설정이 지원 범위를 벗어났습니다.");
  if (v.motion.keyStates) {
    for (const key of ["start", "end"]) {
      const st = v.motion.keyStates[key];
      if (st) {
        const test = structuredClone(v);
        test.unitRecipe = st.unitRecipe;
        test.layoutRecipe = st.layoutRecipe;
        test.appearance = st.appearance;
        delete test.motion.keyStates;
        validate(test);
      }
    }
  }
  if (v.source.kind === "svg") {
    v.source.markup = sanitize(v.source.markup, true);
    if (v.source.originalMarkup)
      v.source.originalMarkup = sanitize(v.source.originalMarkup, true);
  } else if (
    v.source.kind === "png" &&
    !/^<image x="-?[0-9.]+" y="-?[0-9.]+" width="[0-9.]+" height="[0-9.]+" href="data:image\/png;base64,[A-Za-z0-9+/=]+"\/>$/.test(
      v.source.markup,
    )
  )
    throw Error("지원하지 않는 이미지입니다.");
  return v;
}
function persist() {
  try {
    localStorage.setItem("ftp-project", JSON.stringify(state));
    $("#save-state").textContent = "로컬에 자동 저장됨";
  } catch {
    $("#save-state").textContent = "저장 공간 부족 · JSON으로 저장하세요";
  }
}
function change(fn, rerender = true) {
  const previous = JSON.stringify(state);
  fn(state);
  if (previous === JSON.stringify(state)) return;
  history.push(previous);
  if (history.length > 60) history.shift();
  future = [];
  persist();
  if (rerender) draw();
  else paint();
}
function toast(msg) {
  $("#toast").textContent = msg;
  $("#toast").classList.add("visible");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    3800,
  );
}
function slider(label, group, key, min, max, step = 1, suffix = "") {
  const value = state[group][key];
  return `<label class="control"><span>${label}<span class="number-wrap"><input type="number" data-group="${group}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label} 숫자"/>${suffix}</span></span><input type="range" data-group="${group}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"/></label>`;
}
function select(label, group, key, options) {
  return `<label class="select-control"><span>${label}</span><select data-group="${group}" data-key="${key}">${options.map(([value, name]) => `<option value="${value}" ${state[group][key] === value ? "selected" : ""}>${name}</option>`).join("")}</select></label>`;
}
function color(label, key) {
  return `<label class="color-control"><span>${label}</span><span><input type="color" data-group="appearance" data-key="${key}" value="${state.appearance[key]}"/><code>${state.appearance[key].toUpperCase()}</code></span></label>`;
}
function paletteEditor() {
  const a = state.appearance;
  return `<div class="custom-palette"><div class="section-label">나만의 팔레트 <span>4–6 COLORS</span></div><label class="checkbox"><input id="palette-enabled" type="checkbox" ${a.paletteEnabled ? "checked" : ""}/> 다색 팔레트 적용</label><label class="select-control">색상 수<select id="palette-count" aria-label="팔레트 색상 수">${[4, 5, 6].map((n) => `<option value="${n}" ${a.palette.length === n ? "selected" : ""}>${n}색</option>`).join("")}</select></label><div class="custom-swatches">${a.palette.map((c, i) => `<label><span>색상 ${i + 1}</span><input type="color" data-swatch="${i}" value="${c}" aria-label="색상 ${i + 1}"/><input type="text" data-hex="${i}" value="${c.toUpperCase()}" aria-label="색상 ${i + 1} HEX" maxlength="7" spellcheck="false"/></label>`).join("")}</div><button id="random-palette" class="wide-button">${icon("shuffle", 14)} 랜덤 팔레트 만들기</button><p class="hint">조형·배열·배경을 유지하며 색상만 바꿉니다. 색상은 격자 위치와 내부 조형에 따라 고정됩니다.</p>${a.original ? '<p class="hint">원본 색 유지가 켜져 있습니다. 팔레트를 수정하면 단색 원본으로 전환합니다.</p>' : ""}<p class="hint">PNG 원본은 재색상화하지 않습니다.</p></div>`;
}
function usePalette(s) {
  s.appearance.paletteEnabled = true;
  s.appearance.original = false;
  if (s.source.originalMarkup)
    s.source.markup = monochrome(s.source.originalMarkup);
}
function rightPanel() {
  let s = state;
  return `<div class="panel-heading"><span>속성</span><button id="reset" title="현재 프리셋 기본값 복원">${icon("rotate-ccw", 14)}</button></div><div class="property-tabs">${[
    ["shape", "조형"],
    ["unit", "유닛"],
    ["layout", "배열"],
    ["color", "색·효과"],
  ]
    .map(
      ([id, name]) =>
        `<button data-tab="${id}" class="${tab === id ? "active" : ""}">${name}</button>`,
    )
    .join(
      "",
    )}</div><div class="property-body">${tab === "shape" ? `<div class="section-label">SOURCE TRANSFORM</div>${slider("조형 크기", "unitRecipe", "size", 12, 140, 1, "px")}${slider("원본 방향 보정", "unitRecipe", "orientation", -180, 180, 1, "°")}<p class="hint">원본 종횡비와 내부 구멍을 유지합니다.</p><div class="section-label">회전 중심 · 연결 기준점</div>${slider("중심 X", "unitRecipe", "cx", -72, 72)}${slider("중심 Y", "unitRecipe", "cy", -72, 72)}${slider("연결 기준점", "unitRecipe", "anchor", -72, 72)}<button class="wide-button" id="original-color">${icon(s.appearance.original ? "check-square" : "square")} 원본 색 유지</button><p class="hint">PNG는 원본 픽셀을 유지합니다. 색상 역할과 외곽선은 벡터 입력에서 적용됩니다.</p>` : ""}${
    tab === "unit"
      ? `<div class="section-label">UNIT COMPOSITION <span>01</span></div><div class="unit-preview" id="unit-preview"></div><div class="unit-caption">${presets.find((x) => x[0] === s.layoutRecipe.preset)[1]} <span>복합 유닛</span></div>${slider("조형 크기", "unitRecipe", "size", 12, 140, 1, "px")}${slider("방사 반경", "unitRecipe", "radius", 0, 110, 1, "px")}${select(
          "방향 수",
          "unitRecipe",
          "count",
          [
            [4, "4방향 · 90°"],
            [8, "8방향 · 45°"],
            [6, "6방향 · 실험"],
            [12, "12방향 · 실험"],
          ],
        )}${slider("시작각", "unitRecipe", "angle", 0, 360, 1, "°")}${slider("유닛 전체 회전", "unitRecipe", "rotation", 0, 360, 1, "°")}<details><summary>고급 유닛 설정 ${icon("chevron-down", 13)}</summary>${slider("조형 자체 기울기", "unitRecipe", "orientation", -180, 180, 1, "°")}${slider("직렬쌍 간격", "unitRecipe", "pairGap", 10, 160)}${slider("변별 복제 수", "unitRecipe", "edgeCopies", 1, 6)}${slider("중심 여백", "unitRecipe", "centerGap", 0, 60)}${slider("작은 유닛 비율", "unitRecipe", "small", 0.15, 1, 0.01)}</details>`
      : ""
  }${
    tab === "layout"
      ? `<div class="section-label">REPETITION & SPACE</div>${slider("밀도", "layoutRecipe", "density", 2, 12, 1)}<p class="hint">캔버스를 유지하면서 셀 크기와 반복 개수를 함께 조절합니다.</p>${slider("셀 간격", "layoutRecipe", "gap", 0, 80, 1, "px")}${slider("엇갈림 비율", "layoutRecipe", "stagger", 0, 1, 0.05)}${slider("크롭 위치 X", "layoutRecipe", "offsetX", -200, 200)}${slider("크롭 위치 Y", "layoutRecipe", "offsetY", -200, 200)}${select(
          "캔버스",
          "canvas",
          "format",
          [
            ["square", "1080 × 1080"],
            ["landscape", "1920 × 1080"],
            ["portrait", "1080 × 1920"],
            ["custom", "사용자 지정"],
          ],
        )}${slider("출력 너비", "canvas", "width", 64, 4096, 1, "px")}${slider("출력 높이", "canvas", "height", 64, 4096, 1, "px")}<button id="tile" class="wide-button ${s.canvas.tile ? "selected" : ""}">${icon("grid-3x3")} 타일 3 × 3 미리보기</button><p class="hint">정지 패턴의 상위 반복 셀을 연결합니다. 모션의 공간 반복은 보장하지 않습니다.</p>`
      : ""
  }${
    tab === "color"
      ? `<div class="section-label">PALETTE & MATERIAL</div><div class="palettes">${[
          ["#F2F0E9", "#FF471A", "#6F92B8"],
          ["#161616", "#B6975B", "#F2F2F2"],
          ["#6F92B8", "#FF471A", "#F2F2F2"],
          ["#B6975B", "#6F92B8", "#F2F2F2"],
        ]
          .map(
            (c, i) =>
              `<button data-palette="${i}" title="팔레트 ${i + 1}">${c.map((v) => `<span style="background:${v}"></span>`).join("")}</button>`,
          )
          .join(
            "",
          )}</div>${paletteEditor()}${color("배경", "background")}${color("주 조형 · 중앙", "primary")}${color("보조 조형 · 프레임", "secondary")}${color("외곽선", "stroke")}${slider("외곽선 두께", "appearance", "strokeWidth", 0, 12, 0.5)}<div class="section-label">TEXTURE <span>실험</span></div>${select(
          "효과 적용 대상",
          "appearance",
          "effectRole",
          [
            ["all", "전체 조형"],
            ["primary", "주 조형만"],
            ["secondary", "보조 조형만"],
          ],
        )}<label class="checkbox effect-toggle"><input type="checkbox" data-effect="grainEnabled" ${s.appearance.grainEnabled ? "checked" : ""}/> 그레인 켜기</label>${slider("그레인 강도", "appearance", "grain", 0, 1, 0.05)}${slider("입자 크기", "appearance", "grainSize", 1, 8, 0.5)}${slider("내부 밝기", "appearance", "light", 0, 1, 0.05)}<label class="checkbox effect-toggle"><input type="checkbox" data-effect="blurEnabled" ${s.appearance.blurEnabled ? "checked" : ""}/> 블러 켜기</label>${slider("블러 강도", "appearance", "soft", 0, 24, 0.5)}<p class="hint">그레인은 블러 위에 적용됩니다. 입자가 작게 보이면 입자 크기와 강도를 높여 보세요. 시드로 고정됩니다. SVG 필터는 편집 프로그램에 따라 다르게 보일 수 있습니다.</p>`
      : ""
  }<div class="panel-note">${icon("info", 14)}<p>정지 자료에서 관찰한 규칙의 재구성입니다. 수치는 조절 가능한 추정값입니다.</p></div></div>`;
}
function draw() {
  const rightScroll = $(".right-panel")?.scrollTop || 0;
  const leftScroll = $(".left-panel")?.scrollTop || 0;
  const p = presets.find((x) => x[0] === state.layoutRecipe.preset);
  $("#app").innerHTML =
    `<header><a class="brand" href="#" aria-label="Form to Pattern">${icon("asterisk", 27)}<span>FORM TO PATTERN<small>GENERATIVE DESIGN STUDIO</small></span></a><div class="mode-tabs">${[
      ["pattern", "패턴"],
      ["motion", "모션"],
      ["compare", "비교"],
    ]
      .map(
        ([id, name]) =>
          `<button data-mode="${id}" class="${mode === id ? "active" : ""}">${name}</button>`,
      )
      .join(
        "",
      )}</div><div class="header-actions">${button("undo", "undo-2", "실행 취소")}${button("redo", "redo-2", "다시 실행")}<span class="divider"></span><button id="save-project" class="text-button">${icon("save")} 저장</button><button id="export" class="primary-button">${icon("arrow-up-right")} 내보내기</button></div></header><div class="workspace ${panels ? "" : "panels-hidden"}"><aside class="left-panel"><div class="panel-heading">프로젝트 <span class="tiny-badge">LOCAL</span></div><div class="project-title"><input id="project-title" aria-label="프로젝트 이름" maxlength="50"/><span>01</span></div><div class="section-label">원본 조형 <span>원본 1개</span></div><div class="source-card" id="dropzone"><div id="source-preview"></div><div class="source-meta"><span id="source-name"></span><span class="svg-badge">${state.source.kind.toUpperCase()}</span></div></div><button id="upload" class="wide-button upload">${icon("upload", 14)} 조형 불러오기 <span>SVG / PNG</span></button><p class="source-note" id="source-note"></p><div class="preset-heading"><span>패턴 프리셋</span><span>06</span></div><div class="preset-list">${presets.map((pr, i) => `<button class="preset ${pr[0] === p[0] ? "active" : ""}" data-preset="${pr[0]}"><div class="preset-thumb" id="thumb-${pr[0]}"></div><span><b>${pr[1]}</b><small>${pr[3]} · ${pr[0] === "F" ? "관찰 기반 재구성" : "레퍼런스 기반"}</small></span><span class="preset-letter">${pr[0]}</span></button>`).join("")}</div><div class="left-bottom"><button id="open-project">${icon("folder-open", 15)} 프로젝트 열기</button><p>하나의 조형, 무한한 가능성.</p></div></aside><main><div class="canvas-toolbar"><div class="breadcrumb">워크스페이스 <span>/</span> <b>${p[1]}</b><span class="live-dot"></span></div><div>${button("structure", "scan-line", "구조만 보기", structure ? "selected" : "")}${button("guides", "crosshair", "가이드", guides ? "selected" : "")}${button("panels", "panel-left-close", "패널 접기")}${button("fullscreen", "maximize", "전체 화면")}</div></div><div class="stage" id="stage"><div class="stage-tag">${mode === "motion" ? "MOTION STUDY" : mode === "compare" ? "COMPARISON" : "PATTERN EXPLORATION"}<span>${p[0]} / ${p[3]}</span></div><div class="artwork-wrap" id="artwork-wrap"><div id="artwork"></div></div><div class="canvas-meta"><span>${icon("scan", 13)} ${state.canvas.width} × ${state.canvas.height} px <span>·</span> ${state.source.kind === "png" ? "RASTER SOURCE" : "VECTOR SOURCE"}</span><span>SEED ${state.seed}</span></div><div class="zoom-toolbar">${button("zoom-out", "minus", "축소")}<span id="zoom-label">${Math.round(zoom * 100)}%</span>${button("zoom-in", "plus", "확대")}<span class="divider"></span><button id="fit">화면 맞춤</button>${button("tile-preview", "grid-2x2", "3×3 타일 미리보기")}</div></div>${mode === "motion" ? motionPanel() : mode === "compare" ? comparePanel() : `<section class="process"><div class="process-title"><span>형태가 패턴이 되는 과정</span><small>FORM → UNIT → PATTERN</small></div><div class="process-steps"><div class="process-step"><div id="step-source"></div><span><small>01 / SOURCE</small><b>원본 조형</b></span></div><span class="step-arrow">${icon("arrow-right")}</span><div class="process-step"><div id="step-unit"></div><span><small>02 / COMPOSITION</small><b>복합 유닛</b></span></div><span class="step-arrow">${icon("arrow-right")}</span><div class="process-step"><div id="step-pattern"></div><span><small>03 / REPETITION</small><b>반복 패턴</b></span></div><button id="formation" class="process-play">${icon("play", 14)} 과정 재생</button></div></section>`}</main><aside class="right-panel">${rightPanel()}</aside></div><footer><span><span class="status-dot"></span><span id="save-state">로컬에 자동 저장됨</span></span><span>규칙을 만들고, 가능성을 발견하세요.</span><span>FORM TO PATTERN <b>v.01</b></span></footer><input id="source-file" type="file" accept=".svg,.png,image/svg+xml,image/png" hidden/><input id="project-file" type="file" accept=".json,application/json" hidden/><div id="toast" role="status"></div><dialog id="export-dialog"></dialog>`;
  $("#project-title").value = state.title || "이름 없는 실험";
  $("#source-name").textContent = state.source.name;
  $("#source-note").textContent = state.source.note;
  paint();
  events();
  createIcons({ icons });
  $("#undo").disabled = !history.length;
  $("#redo").disabled = !future.length;
  $(".right-panel").scrollTop = rightScroll;
  $(".left-panel").scrollTop = leftScroll;
}
function motionPanel() {
  return `<section class="motion-panel"><div class="motion-top"><button id="play" class="play-button">${icon(playing ? "pause" : "play", 15)}</button>${button("rewind", "skip-back", "처음으로")}${button("prev-frame", "chevron-left", "이전 프레임")}${button("next-frame", "chevron-right", "다음 프레임")}<span id="time-label">${time.toFixed(2)} / ${state.motion.duration}s</span><select id="motion-type">${[
    ["rotate", "유닛 회전"],
    ["internal", "내부 조형 회전"],
    ["breathe", "펼침과 모임"],
    ["density", "밀도 변화"],
    ["wave", "파동"],
    ["flow", "패턴 흐름"],
    ["color", "색상 순환"],
    ["states", "저장 상태 사이 이동"],
    ["formation", "형성 과정"],
  ]
    .map(
      ([v, n]) =>
        `<option value="${v}" ${(state.motion.formation ? v === "formation" : v === state.motion.type) ? "selected" : ""}>${n}</option>`,
    )
    .join(
      "",
    )}</select></div><input id="timeline" type="range" min="0" max="${state.motion.duration}" step="${1 / state.motion.fps}" value="${time}" aria-label="타임라인"/><div class="motion-settings">${slider("길이", "motion", "duration", 1, 20, 1, "s")}${slider("FPS", "motion", "fps", 1, 60)}${slider("변화량", "motion", "amount", 0, 2, 0.1)}${slider("시차", "motion", "stagger", 0, 1, 0.05)}${slider("미리보기 속도", "motion", "speed", 0.25, 3, 0.25)}${select(
    "방향",
    "motion",
    "direction",
    [
      [1, "정방향"],
      [-1, "역방향"],
    ],
  )}<button id="pingpong" class="text-button">${state.motion.pingpong ? "✓ " : ""}펼친 뒤 모이기</button></div><div class="motion-key-states"><span>상태 저장</span><button id="save-start" class="text-button">${state.motion.keyStates?.start ? "✓ " : ""}시작 상태</button><button id="save-end" class="text-button">${state.motion.keyStates?.end ? "✓ " : ""}끝 상태</button><span>연속 속성을 보간합니다 · ‘저장 상태 사이 이동’ 선택</span></div></section>`;
}
function comparePanel() {
  return `<section class="compare-panel"><button id="capture" class="wide-button">${icon("copy")} 현재 설정 비교에 고정</button><button id="density" class="wide-button">${icon("layers")} 밀도 5단계 만들기</button><button id="variation" class="wide-button">${icon("shuffle")} 규칙 안에서 변주</button><label class="seed-control">시드 <input id="seed" type="number" value="${state.seed}"/></label><div class="locks">${[
    ["unit", "유닛"],
    ["layout", "배열"],
    ["color", "색상"],
  ]
    .map(
      ([id, n]) =>
        `<button data-lock="${id}" class="${locks[id] ? "selected" : ""}">${icon(locks[id] ? "lock" : "unlock", 12)} ${n}</button>`,
    )
    .join(
      "",
    )}</div><div class="variant-list">${variants.map((v, i) => `<button data-variant="${i}" title="시안 ${i + 1} 편집값 불러오기">${renderSVG(v, 0, { width: 160, height: 160, namespace: "variant-" + i })}<span>시안 ${i + 1} · 밀도 ${v.layoutRecipe.density}</span></button>`).join("")}</div></section>`;
}
function paint(animated = false) {
  let options = { guides, structure, motionEnabled: mode === "motion" };
  let svg = renderSVG(state, mode === "motion" ? time : 0, options);
  if (state.canvas.tile) {
    const tileState = tileRecipe(state);
    const tw = tileState.canvas.width;
    svg = renderSVG(tileState, 0, {
      width: tw,
      height: tw,
      structure,
      motionEnabled: false,
    });
    $("#artwork").innerHTML =
      `<div class="tile-grid">${Array.from({ length: 9 }, (_, i) => svg.replaceAll("pattern-", `tile-${i}-`)).join("")}</div>`;
  } else if (mode === "compare" && compare) {
    $("#artwork").innerHTML =
      `<div class="comparison"><div>${renderSVG(compare, 0, { namespace: "compare", motionEnabled: false })}<span>고정한 시안</span></div><div>${svg}<span>현재 편집</span></div></div>`;
  } else $("#artwork").innerHTML = svg;
  $("#artwork-wrap").style.transform = `scale(${zoom})`;
  $("#artwork-wrap").style.aspectRatio =
    `${state.canvas.width}/${state.canvas.height}`;
  if (animated) return;
  for (const [id, opt] of [
    ["source-preview", { sourceOnly: true, width: 210, height: 155 }],
    ["unit-preview", { unitOnly: true, width: 240, height: 166 }],
    ["step-source", { sourceOnly: true, width: 160, height: 100 }],
    ["step-unit", { unitOnly: true, width: 160, height: 100 }],
    ["step-pattern", { width: 160, height: 100 }],
  ]) {
    if ($("#" + id)) {
      let clone = structuredClone(state);
      clone.unitRecipe.size =
        id === "source-preview" ? 42 : id.startsWith("step") ? 20 : 36;
      clone.unitRecipe.radius = id.startsWith("step") ? 22 : 38;
      clone.layoutRecipe.density = 3;
      $("#" + id).innerHTML = renderSVG(clone, 0, {
        ...opt,
        namespace: id,
        motionEnabled: false,
      });
    }
  }
  for (const p of presets) {
    let el = $("#thumb-" + p[0]);
    if (el && !el.innerHTML) {
      let clone = initial();
      clone.layoutRecipe.preset = p[0];
      clone.layoutRecipe.density = 2;
      clone.unitRecipe.size = 11;
      clone.unitRecipe.radius = 12;
      clone.unitRecipe.pairGap = 11;
      clone.layoutRecipe.gap = 0;
      clone.appearance.primary = clone.appearance.secondary = "#474943";
      clone.appearance.background = "#eeede7";
      el.innerHTML = renderSVG(clone, 0, {
        width: 64,
        height: 64,
        namespace: "thumb-" + p[0],
      });
    }
  }
}
function bind(id, fn) {
  const el = $("#" + id);
  if (el) el.onclick = fn;
}
function events() {
  bind("palette-enabled", () =>
    change((s) => {
      if (s.appearance.paletteEnabled) s.appearance.paletteEnabled = false;
      else usePalette(s);
    }),
  );
  if ($("#palette-count"))
    $("#palette-count").onchange = (e) =>
      change((s) => {
        const n = Number(e.target.value),
          extra = generatePalette(6, s.appearance.paletteSeed);
        s.appearance.palette = Array.from(
          { length: n },
          (_, i) => s.appearance.palette[i] || extra[i],
        );
        usePalette(s);
      });
  document.querySelectorAll("[data-swatch], [data-hex]").forEach(
    (el) =>
      (el.onchange = () => {
        const v = el.value.trim();
        if (!/^#[0-9a-f]{6}$/i.test(v)) {
          toast("HEX 색상은 #FF471A 형식으로 입력하세요.");
          el.value =
            state.appearance.palette[
              Number(el.dataset.swatch ?? el.dataset.hex)
            ];
          return;
        }
        change((s) => {
          s.appearance.palette[Number(el.dataset.swatch ?? el.dataset.hex)] =
            v.toUpperCase();
          usePalette(s);
        });
      }),
  );
  bind("random-palette", () =>
    change((s) => {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      s.appearance.paletteSeed = seed;
      s.appearance.palette = generatePalette(s.appearance.palette.length, seed);
      usePalette(s);
    }),
  );
  document.querySelectorAll("[data-effect]").forEach(
    (el) =>
      (el.onchange = () =>
        change((s) => {
          s.appearance[el.dataset.effect] = el.checked;
          if (el.checked) {
            const key = el.dataset.effect === "blurEnabled" ? "soft" : "grain";
            if (!s.appearance[key])
              s.appearance[key] = key === "soft" ? 8 : 0.35;
          }
        })),
  );

  $("#project-title").onchange = (e) =>
    change((s) => (s.title = e.target.value || "이름 없는 실험"));
  document.querySelectorAll("[data-mode]").forEach(
    (el) =>
      (el.onclick = () => {
        mode = el.dataset.mode;
        playing = false;
        draw();
      }),
  );
  document.querySelectorAll("[data-tab]").forEach(
    (el) =>
      (el.onclick = () => {
        tab = el.dataset.tab;
        draw();
      }),
  );
  document.querySelectorAll("[data-preset]").forEach(
    (el) =>
      (el.onclick = () =>
        change((s) => {
          s.layoutRecipe.preset = el.dataset.preset;
          time = 0;
        })),
  );
  document.querySelectorAll("[data-group]").forEach((el) => {
    el.onchange = () => {
      const g = el.dataset.group,
        k = el.dataset.key;
      let val = el.value;
      if (el.type === "number" || el.type === "range")
        val = Math.min(Number(el.max), Math.max(Number(el.min), Number(val)));
      if (k === "count" || k === "direction") val = Number(val);
      change((s) => {
        s[g][k] = val;
        if (k === "soft") s.appearance.blurEnabled = val > 0;
        if (k === "grain") s.appearance.grainEnabled = val > 0;
        if (k === "format") {
          [s.canvas.width, s.canvas.height] =
            val === "landscape"
              ? [1920, 1080]
              : val === "portrait"
                ? [1080, 1920]
                : [1080, 1080];
        }
        time = Math.min(time, s.motion.duration);
      });
    };
    el.oninput = () => {
      if (el.type === "range") {
        const n = el.closest("label").querySelector("input[type=number]");
        if (n) n.value = el.value;
      }
    };
  });
  bind("undo", () => {
    if (history.length) {
      future.push(JSON.stringify(state));
      state = JSON.parse(history.pop());
      persist();
      draw();
    }
  });
  bind("redo", () => {
    if (future.length) {
      history.push(JSON.stringify(state));
      state = JSON.parse(future.pop());
      persist();
      draw();
    }
  });
  bind("reset", () =>
    change((s) => {
      const def = initial();
      s.unitRecipe = def.unitRecipe;
      s.layoutRecipe = { ...def.layoutRecipe, preset: s.layoutRecipe.preset };
    }),
  );
  bind("structure", () => {
    structure = !structure;
    draw();
  });
  bind("guides", () => {
    guides = !guides;
    draw();
  });
  bind("panels", () => {
    panels = !panels;
    draw();
  });
  bind("fullscreen", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $("#stage").requestFullscreen();
    } catch {
      toast("이 브라우저는 전체 화면을 지원하지 않습니다.");
    }
  });
  bind("zoom-in", () => {
    zoom = Math.min(2, zoom + 0.1);
    draw();
  });
  bind("zoom-out", () => {
    zoom = Math.max(0.3, zoom - 0.1);
    draw();
  });
  bind("fit", () => {
    zoom = 1;
    draw();
  });
  for (const id of ["tile", "tile-preview"])
    bind(id, () => change((s) => (s.canvas.tile = !s.canvas.tile)));
  bind("upload", () => $("#source-file").click());
  $("#source-file").onchange = (e) => loadSource(e.target.files[0]);
  bind("open-project", () => $("#project-file").click());
  $("#project-file").onchange = async (e) => {
    try {
      const project = validate(JSON.parse(await e.target.files[0].text()));
      change(() => (state = project));
      toast("프로젝트를 불러왔습니다.");
    } catch (err) {
      toast(err.message);
    }
  };
  const drop = $("#dropzone");
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("dragging");
  };
  drop.ondragleave = () => drop.classList.remove("dragging");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("dragging");
    loadSource(e.dataTransfer.files[0]);
  };
  bind("save-project", () =>
    download(
      JSON.stringify(state, null, 2),
      "form-to-pattern.json",
      "application/json",
    ),
  );
  bind("export", openExport);
  bind("formation", () => {
    mode = "motion";
    change((s) => (s.motion.formation = true));
    time = 0;
    playing = true;
    draw();
  });
  bind("play", () => {
    if (time >= state.motion.duration) time = 0;
    playing = !playing;
    draw();
  });
  bind("rewind", () => {
    time = 0;
    paint();
  });
  bind("prev-frame", () => {
    playing = false;
    time = Math.max(0, time - 1 / state.motion.fps);
    draw();
  });
  bind("next-frame", () => {
    playing = false;
    time = Math.min(state.motion.duration, time + 1 / state.motion.fps);
    draw();
  });
  if ($("#timeline"))
    $("#timeline").oninput = (e) => {
      playing = false;
      time = Number(e.target.value);
      $("#time-label").textContent =
        `${time.toFixed(2)} / ${state.motion.duration}s`;
      paint();
    };
  if ($("#motion-type"))
    $("#motion-type").onchange = (e) =>
      change((s) => {
        s.motion.formation = e.target.value === "formation";
        if (!s.motion.formation) s.motion.type = e.target.value;
        time = 0;
      });
  for (const key of ["start", "end"])
    bind("save-" + key, () =>
      change((s) => {
        s.motion.keyStates ||= {};
        s.motion.keyStates[key] = {
          unitRecipe: structuredClone(s.unitRecipe),
          layoutRecipe: structuredClone(s.layoutRecipe),
          appearance: structuredClone(s.appearance),
        };
      }),
    );
  bind("pingpong", () =>
    change((s) => (s.motion.pingpong = !s.motion.pingpong)),
  );
  bind("capture", () => {
    compare = structuredClone(state);
    draw();
  });
  bind("density", () => {
    variants = Array.from({ length: 5 }, (_, i) => {
      const v = structuredClone(state);
      v.layoutRecipe.density = i + 2;
      return v;
    });
    draw();
  });
  bind("variation", () => {
    variants = Array.from({ length: 5 }, (_, i) =>
      randomize({ ...state, seed: state.seed + i }, locks),
    );
    draw();
  });
  if ($("#seed"))
    $("#seed").onchange = (e) =>
      change((s) => (s.seed = Math.max(0, Number(e.target.value) || 0)));
  document.querySelectorAll("[data-lock]").forEach(
    (el) =>
      (el.onclick = () => {
        locks[el.dataset.lock] = !locks[el.dataset.lock];
        draw();
      }),
  );
  document
    .querySelectorAll("[data-variant]")
    .forEach(
      (el) =>
        (el.onclick = () =>
          change(
            () =>
              (state = structuredClone(variants[Number(el.dataset.variant)])),
          )),
    );
  bind("original-color", () =>
    change((s) => {
      s.appearance.original = !s.appearance.original;
      if (s.source.originalMarkup)
        s.source.markup = s.appearance.original
          ? s.source.originalMarkup
          : monochrome(s.source.originalMarkup);
    }),
  );
  document.querySelectorAll("[data-palette]").forEach(
    (el) =>
      (el.onclick = () =>
        change((s) => {
          s.appearance.paletteEnabled = false;
          const pals = [
            ["#F2F0E9", "#FF471A", "#6F92B8"],
            ["#161616", "#B6975B", "#F2F2F2"],
            ["#6F92B8", "#FF471A", "#F2F2F2"],
            ["#B6975B", "#6F92B8", "#F2F2F2"],
          ];
          [
            s.appearance.background,
            s.appearance.primary,
            s.appearance.secondary,
          ] = pals[Number(el.dataset.palette)];
        })),
  );
}
function sanitize(text, fragment = false) {
  const doc = new DOMParser().parseFromString(
    fragment ? `<svg xmlns="http://www.w3.org/2000/svg">${text}</svg>` : text,
    "image/svg+xml",
  );
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "svg"
  )
    throw Error("올바른 SVG 파일이 아닙니다.");
  const allowed = new Set([
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "defs",
    "linearGradient",
    "radialGradient",
    "stop",
    "clipPath",
    "mask",
    "use",
    "title",
    "desc",
  ]);
  doc.querySelectorAll("*").forEach((el) => {
    if (!allowed.has(el.localName)) {
      el.remove();
      return;
    }
    for (const attr of [...el.attributes]) {
      const v = attr.value;
      if (attr.name === "style") {
        const safe = [
          "fill",
          "stroke",
          "stroke-width",
          "fill-rule",
          "clip-rule",
          "opacity",
          "fill-opacity",
          "stroke-opacity",
          "stroke-linecap",
          "stroke-linejoin",
        ];
        for (const k of safe) {
          const val = el.style.getPropertyValue(k);
          if (val && !/url\(|[<>]/i.test(val)) el.setAttribute(k, val);
        }
      }
      if (
        /^on/i.test(attr.name) ||
        ["style", "class"].includes(attr.name) ||
        (/href$/i.test(attr.name) && !v.startsWith("#")) ||
        (/url\(/i.test(v) && !/^(?:url\(#[\w-]+\))$/.test(v))
      )
        el.removeAttribute(attr.name);
    }
  });
  if (!fragment) {
    let ids = new Map();
    doc.querySelectorAll("[id]").forEach((el, i) => {
      ids.set(el.id, `user-${i}`);
      el.id = `user-${i}`;
    });
    doc.querySelectorAll("*").forEach((el) => {
      for (const a of [...el.attributes]) {
        let v = a.value;
        ids.forEach((n, o) => {
          if (v === `#${o}`) v = `#${n}`;
          v = v.split(`url(#${o})`).join(`url(#${n})`);
        });
        el.setAttribute(a.name, v);
      }
    });
  }
  return fragment
    ? doc.documentElement.innerHTML
    : doc.documentElement.outerHTML;
}
function monochrome(markup) {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
    "image/svg+xml",
  );
  doc.querySelectorAll("*").forEach((el) => {
    for (const key of ["fill", "stroke"]) {
      const value = el.getAttribute(key);
      if (value && value !== "none" && !el.closest("defs,mask,clipPath"))
        el.removeAttribute(key);
    }
  });
  return doc.documentElement.innerHTML;
}
async function loadSource(file) {
  if (!file) return;
  try {
    if (file.size > 6 * 1024 * 1024)
      throw Error("6MB 이하의 SVG 또는 투명 PNG를 사용하세요.");
    let source;
    if (file.name.toLowerCase().endsWith(".svg")) {
      const clean = sanitize(await file.text());
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-10000px;visibility:hidden";
      host.innerHTML = clean;
      document.body.append(host);
      let svg = host.querySelector("svg");
      let b = svg.getBBox();
      if (!b.width || !b.height) {
        host.remove();
        throw Error(
          "SVG에서 보이는 도형을 찾지 못했습니다. 외부 참조는 지원하지 않습니다.",
        );
      }
      const scale = 144 / Math.max(b.width, b.height);
      const rootAttrs = [...svg.attributes]
        .filter((a) =>
          [
            "fill",
            "stroke",
            "stroke-width",
            "fill-rule",
            "clip-rule",
            "opacity",
          ].includes(a.name),
        )
        .map(
          (a) =>
            `${a.name}="${a.value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}"`,
        )
        .join(" ");
      const markup = `<g transform="scale(${scale}) translate(${-b.x - b.width / 2} ${-b.y - b.height / 2})"><g ${rootAttrs}>${svg.innerHTML}</g></g>`;
      host.remove();
      source = {
        kind: "svg",
        name: file.name,
        originalMarkup: markup,
        markup: state.appearance.original ? markup : monochrome(markup),
        note: "경계 중심 정규화 · 비율 유지 · 외부 참조 제외",
      };
    } else if (file.type === "image/png") {
      const data = await new Promise((res, rej) => {
        let r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      let img = new Image();
      img.src = data;
      await img.decode();
      if (img.width * img.height > 16777216)
        throw Error("PNG 원본은 1,600만 픽셀 이하로 불러오세요.");
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      cv.getContext("2d").drawImage(img, 0, 0);
      const pixels = cv
        .getContext("2d")
        .getImageData(0, 0, img.width, img.height).data;
      let minX = img.width,
        minY = img.height,
        maxX = -1,
        maxY = -1;
      for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++)
          if (pixels[(y * img.width + x) * 4 + 3] > 0) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
      if (maxX < 0) throw Error("PNG에 보이는 픽셀이 없습니다.");
      const sc = 144 / Math.max(maxX - minX + 1, maxY - minY + 1);
      const pcx = (minX + maxX + 1) / 2,
        pcy = (minY + maxY + 1) / 2;
      source = {
        kind: "png",
        name: file.name,
        markup: `<image x="${-pcx * sc}" y="${-pcy * sc}" width="${img.width * sc}" height="${img.height * sc}" href="${data}"/>`,
        note: "래스터 원본 · SVG 출력에도 PNG가 포함됩니다.",
      };
    } else throw Error("SVG 또는 PNG 파일을 선택하세요.");
    change((s) => (s.source = source));
    toast("모든 유닛과 패턴에 새 조형을 적용했습니다.");
  } catch (err) {
    toast(err.message);
  }
}
function download(data, name, type) {
  const url = URL.createObjectURL(
    data instanceof Blob ? data : new Blob([data], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function png(svg, width, height) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    img.src = url;
    await img.decode();
    let canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    return await new Promise((res, rej) =>
      canvas.toBlob(
        (b) => (b ? res(b) : rej(Error("PNG 변환 실패"))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
function openExport() {
  const d = $("#export-dialog");
  d.innerHTML = `<div class="dialog-title"><span>작업 내보내기</span><button id="close-export">${icon("x")}</button></div><p>현재 설정과 타임라인의 시점을 출력합니다.</p><label class="select-control">형식<select id="export-format"><option value="svg">SVG · 벡터 / 포함된 래스터</option><option value="png">PNG · 정지 이미지</option><option value="tile">PNG · 반복 타일</option><option value="process">PNG · 원본 / 유닛 / 패턴</option><option value="frames">PNG 시퀀스 · ZIP</option></select></label><label class="select-control">출력 크기<select id="export-size"><option value="1080">1080 px</option><option value="1920">1920 px</option><option value="540">540 px</option><option value="custom">현재 캔버스 크기</option></select></label><label class="checkbox"><input type="checkbox" id="transparent"/> 투명 배경</label><p class="hint">${state.source.kind === "png" ? "PNG 원본은 벡터로 변환되지 않습니다. " : ""}SVG 질감은 필터를 사용합니다. MP4 / GIF 인코더는 연결되지 않아 제공하지 않습니다. 모션은 시간상 루프이며 공간 타일 반복을 보장하지 않습니다.</p><progress id="export-progress" value="0" max="1" hidden></progress><div class="dialog-actions"><button id="cancel-export" class="text-button">취소</button><button id="do-export" class="primary-button">${icon("download", 15)} 내보내기</button></div>`;
  d.showModal();
  createIcons({ icons });
  cancelled = false;
  bind("close-export", () => {
    cancelled = true;
    d.close();
  });
  bind("cancel-export", () => {
    cancelled = true;
    d.close();
  });
  bind("do-export", async () => {
    const btn = $("#do-export");
    btn.disabled = true;
    try {
      const format = $("#export-format").value,
        size = $("#export-size").value;
      const width = size === "custom" ? state.canvas.width : Number(size),
        height = Math.round((width * state.canvas.height) / state.canvas.width);
      const transparent = $("#transparent").checked;
      let opt = {
        width: state.canvas.width,
        height: state.canvas.height,
        transparent,
        motionEnabled: mode === "motion",
      };
      let svg = renderSVG(state, time, opt).replace(
        `width="${state.canvas.width}" height="${state.canvas.height}"`,
        `width="${width}" height="${height}"`,
      );
      if (format === "svg") download(svg, "pattern.svg", "image/svg+xml");
      if (format === "png")
        download(await png(svg, width, height), "pattern.png");
      if (format === "tile") {
        const tileState = tileRecipe(state);
        const tw = tileState.canvas.width;
        svg = renderSVG(tileState, 0, {
          width: tw,
          height: tw,
          transparent,
          motionEnabled: false,
        });
        download(await png(svg, width, width), "pattern-tile.png");
      }
      if (format === "process") {
        const ss = structuredClone(state);
        ss.unitRecipe.size = 45;
        ss.unitRecipe.radius = 52;
        const strip = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 3}" height="${height}">${renderSVG(ss, 0, { width, height, transparent, sourceOnly: true, namespace: "process-source", motionEnabled: false })}<g transform="translate(${width} 0)">${renderSVG(ss, 0, { width, height, transparent, unitOnly: true, namespace: "process-unit", motionEnabled: false })}</g><g transform="translate(${width * 2} 0)">${svg}</g></svg>`;
        download(await png(strip, width * 3, height), "form-unit-pattern.png");
      }
      if (format === "frames") {
        const n = Math.round(state.motion.duration * state.motion.fps);
        if (width * height * n > 900000000)
          throw Error("출력 메모리 보호: 크기·길이·FPS를 줄여 주세요.");
        let files = {};
        $("#export-progress").hidden = false;
        const snapshot = structuredClone(state);
        for (let k = 0; k < n; k++) {
          if (cancelled) return;
          const blob = await png(
            renderSVG(snapshot, (k / n) * snapshot.motion.duration, {
              ...opt,
              motionEnabled: true,
            }),
            width,
            height,
          );
          files[`frame-${String(k).padStart(5, "0")}.png`] = new Uint8Array(
            await blob.arrayBuffer(),
          );
          $("#export-progress").value = (k + 1) / n;
          await new Promise((r) => setTimeout(r, 0));
        }
        files["project.json"] = strToU8(JSON.stringify(snapshot));
        download(
          zipSync(files, { level: 0 }),
          "pattern-frames.zip",
          "application/zip",
        );
      }
      if (!cancelled) {
        d.close();
        toast("결과물을 내보냈습니다.");
      }
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
    }
  });
}
function tick(now) {
  if (playing) {
    const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
    time += delta * state.motion.speed;
    if (time >= state.motion.duration) {
      if (state.motion.formation && !state.motion.pingpong) {
        time = state.motion.duration;
        playing = false;
        draw();
      } else time %= state.motion.duration;
    }
    if (mode === "motion") {
      paint(true);
      if ($("#timeline")) $("#timeline").value = time;
      if ($("#time-label"))
        $("#time-label").textContent =
          `${time.toFixed(2)} / ${state.motion.duration}s`;
    }
  }
  last = now;
  requestAnimationFrame(tick);
}
document.addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    e.preventDefault();
    $(e.shiftKey ? "#redo" : "#undo")?.click();
  }
  if (e.code === "Space" && mode === "motion") {
    e.preventDefault();
    $("#play")?.click();
  }
});
draw();
requestAnimationFrame(tick);

#!/usr/bin/env node
/* pixelfx를 vfxgo가 쓰는 단일 브라우저 스크립트(vendor/pixelfx.js)로 묶는다.
 *
 *   node tools/build-pixelfx.mjs <pixelfx 체크아웃 경로>
 *
 * 예: git clone https://github.com/mecagun8/pixelfx ../pixelfx
 *     (cd ../pixelfx && npm ci)
 *     node tools/build-pixelfx.mjs ../pixelfx
 *
 * 결과물은 전역 window.PixelFX 하나만 만든다(일반 <script>라 file://로 열어도 동작).
 * esbuild는 pixelfx 쪽 node_modules의 것을 그대로 쓰므로 vfxgo에는 의존성이 생기지 않는다. */

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) {
  console.error("usage: node tools/build-pixelfx.mjs <pixelfx 체크아웃 경로>");
  process.exit(1);
}
const PFX = resolve(src);
const HERE = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(HERE, "vendor");

let esbuild;
try {
  esbuild = createRequire(join(PFX, "package.json"))("esbuild");
} catch {
  console.error(`esbuild를 찾을 수 없습니다. 먼저 (cd ${PFX} && npm ci) 를 실행하세요.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(PFX, "package.json"), "utf8"));
let commit = "";
try {
  const head = readFileSync(join(PFX, ".git", "HEAD"), "utf8").trim();
  commit = head.startsWith("ref: ")
    ? readFileSync(join(PFX, ".git", head.slice(5)), "utf8").trim()
    : head;
} catch { /* git 정보가 없어도 빌드는 한다 */ }

const entry = `
export { effects, categories } from "./src/fx/index.js";
export { createFx, createFrame, clearFrame, composite, painterFor,
         drawActor, actorAlphaOf, stockActor,
         Particles, Lights, Bits, Blazes, P } from "./src/core/index.js";   // 부품 조절(가로채기)용
export const version = ${JSON.stringify(pkg.version)};
export const commit = ${JSON.stringify(commit.slice(0, 7))};
`;

const banner = `/*! pixelfx ${pkg.version}${commit ? " (" + commit.slice(0, 7) + ")" : ""} — bundled for vfxgo by tools/build-pixelfx.mjs.
 * MIT License. Copyright (c) 2026 Patch, Copyright (c) 2026 Hugo Duprez.
 * Includes code adapted from Sprite Fusion (Hugo Duprez, MIT) and Hollow Crown (rehan-remade, MIT).
 * Full text: vendor/pixelfx.LICENSE */`;

mkdirSync(OUT, { recursive: true });
const r = await esbuild.build({
  stdin: { contents: entry, resolveDir: PFX, sourcefile: "pixelfx-vfxgo-entry.js", loader: "js" },
  bundle: true,
  format: "iife",
  globalName: "PixelFX",
  minify: true,
  legalComments: "none",
  banner: { js: banner },
  target: "es2020",
  write: false,
});
writeFileSync(join(OUT, "pixelfx.js"), r.outputFiles[0].contents);

const notice = readFileSync(join(PFX, "NOTICE.md"), "utf8");
writeFileSync(
  join(OUT, "pixelfx.LICENSE"),
  readFileSync(join(PFX, "LICENSE"), "utf8").trim() + "\n\n----\n\n" + notice.trim() + "\n",
);
console.log(`vendor/pixelfx.js (${(r.outputFiles[0].contents.length / 1024).toFixed(0)} KB), pixelfx ${pkg.version} ${commit.slice(0, 7)}`);

/* ---------------------------------------------------------------------
 * 구성 카드용 분석: 이펙트 소스를 읽어 어떤 부품을 쓰는지 뽑는다 → vendor/pixelfx-guide.js
 * 정적 분석이라 "코드에 등장하는 부품"이지 실행 중 개수는 아니다.
 *   type  sim(시뮬레이션형) | pure(순수형) | chain(이펙트를 이어 붙인 합성)
 *   back  뒤 레이어(drawBack) 사용   act  캐릭터 연기   body  캐릭터 실루엣을 읽음
 *   parts 이펙트 파일에 직접 쓰인 부품   lib  같은 카테고리 _lib.js의 도우미를 거쳐 쓰인 부품
 *   uses  합성에 쓰인 다른 이펙트 id
 * --------------------------------------------------------------------- */
const FX = join(PFX, "src", "fx");
const PARTICLES = ["SPARK", "MOTE", "STREAK", "FLAKE", "VAPOUR", "DUST", "SMOKE", "FIRE", "BRAND", "GRIT", "EMBER", "STAR"];
const HELPERS = ["sparkle", "flare", "band", "crystal", "cycle", "fly", "flyV", "burst", "stream", "loopNoise", "tileNoise",
  "tileFbm", "fbm", "noise", "noise2", "bolt", "forks", "trail", "star", "ngon"];
const PAINTER = {
  glow: "glow", glowLine: "glow", glowRing: "glow", light: "glow",
  disc: "disc", blend: "blend", blendPx: "blend", dot: "dot", px: "dot",
  circle: "circle", ellipse: "circle", ring: "ring", arc: "ring",
  line: "line", polyline: "line", beam: "beam", rect: "poly", poly: "poly", tri: "poly",
  shade: "shade", sprite: "sprite", text: "text", mask: "mask", outline: "mask",
};

function scan(code, coreNames) {
  const found = new Set();
  for (const k of PARTICLES) if (new RegExp(`\\bP\\.${k}\\b`).test(code)) found.add("P." + k);
  if (/\bnew Bits\b/.test(code)) found.add("Bits");
  if (/\bnew Lights\b/.test(code)) found.add("Lights");
  if (/\bnew Blazes\b/.test(code)) found.add("Blazes");
  for (const h of HELPERS) if (coreNames.has(h) && new RegExp(`\\b${h}\\(`).test(code)) found.add(h);
  for (const [m, key] of Object.entries(PAINTER)) if (new RegExp(`\\b\\w+\\.${m}\\(`).test(code)) found.add("p." + key);
  return found;
}
const importsFrom = (code, re) => {
  const out = [];
  for (const m of code.matchAll(/import\s*(\*\s*as\s+\w+|\{[^}]*\})\s*from\s*"([^"]+)"/g)) if (re.test(m[2])) out.push(m);
  return out;
};
const names = (m) => new Set((m[1].match(/\w+/g) || []).filter((n) => n !== "as"));
// 도우미 함수 하나의 본문: 그 함수 선언부터 다음 최상위 선언 직전까지
function fnBody(lib, name) {
  const re = new RegExp(`^(export\\s+)?(function\\s+${name}\\b|const\\s+${name}\\b)`, "m"), m = re.exec(lib);
  if (!m) return "";
  const rest = lib.slice(m.index + 1), end = rest.search(/^(export\s+)?(function|const|let|class)\s/m);
  return lib.slice(m.index, end < 0 ? undefined : m.index + 1 + end);
}

const guide = {};
for (const cat of readdirSync(FX, { withFileTypes: true })) {
  if (!cat.isDirectory()) continue;
  for (const f of readdirSync(join(FX, cat.name))) {
    if (!f.endsWith(".js") || f.startsWith("_")) continue;
    const id = `${cat.name}/${f.slice(0, -3)}`, code = readFileSync(join(FX, cat.name, f), "utf8");
    const core = new Set(importsFrom(code, /core\/index\.js$/).flatMap((m) => [...names(m)]));
    const parts = scan(code, core), lib = new Set(), uses = [];
    for (const m of importsFrom(code, /\/_lib\.js$/)) {
      const libCode = readFileSync(join(FX, cat.name, m[2]), "utf8");
      const libCore = new Set(importsFrom(libCode, /core\/index\.js$/).flatMap((x) => [...names(x)]));
      for (const n of names(m)) for (const k of scan(fnBody(libCode, n), libCore)) if (!parts.has(k)) lib.add(k);
    }
    for (const m of importsFrom(code, /^\.\.?\/(\.\.\/)?[\w-]+\/[\w-]+\.js$|^\.\/[\w-]+\.js$/)) {
      if (m[2].endsWith("_lib.js") || m[2].includes("core/")) continue;
      const p = m[2].replace(/^\.\//, `${cat.name}/`).replace(/^\.\.\//, "").replace(/\.js$/, "");
      uses.push(p);
    }
    const chained = /\bchain\(/.test(code) && core.has("chain");
    guide[id] = {
      type: chained ? "chain" : /export\s+(function|const)\s+create\b/.test(code) ? "sim" : "pure",
      back: /\bdrawBack\b/.test(code),
      act: /export\s+const\s+act\b/.test(code),
      body: /\bo\.actor\b|\bactorAlpha\b/.test(code),
      parts: [...parts],
      lib: [...lib],
      uses,
    };
  }
}
writeFileSync(join(OUT, "pixelfx-guide.js"),
  `/*! pixelfx ${pkg.version} 구성 분석 — tools/build-pixelfx.mjs가 생성. 직접 고치지 마세요. */\n` +
  `window.PixelFXGuide = ${JSON.stringify(guide)};\n`);
console.log(`vendor/pixelfx-guide.js (${Object.keys(guide).length}개 이펙트 분석)`);

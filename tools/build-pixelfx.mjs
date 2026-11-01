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
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
         drawActor, actorAlphaOf, stockActor } from "./src/core/index.js";
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

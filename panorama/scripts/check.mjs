#!/usr/bin/env node
/**
 * 校验 *.pano / *.panorama 数据文件是否符合 numas 全景图插件的格式。
 *
 * 用法（在本仓库根目录执行）：
 *   node skills/panorama/scripts/check.mjs <file.pano>
 *
 * 判定：PASS 退出码 0；FAIL 退出码 1；只有警告退出码 0。
 *
 * 只做「能不能被插件正确渲染」的结构校验，不做审美判断；
 * 布线是否正交由编辑器运行时保证（它会重算路径）。
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** js-yaml 3.15.2（MIT）随本脚本内置在 vendor/，不跨仓库取用。 */
const loadYaml = () => {
  const path = resolve(here, "vendor/yaml.min.js");
  if (!existsSync(path)) {
    console.error(`[check] 找不到内置的 yaml 解析库：${path}`);
    process.exit(1);
  }
  return require(path);
};

const SIDES = new Set(["top", "right", "bottom", "left"]);
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const target = process.argv[2];
if (!target) {
  console.error("用法：node skills/panorama/scripts/check.mjs <file.pano>");
  process.exit(1);
}

const file = resolve(process.cwd(), target);
if (!existsSync(file)) {
  console.error(`[check] 文件不存在：${file}`);
  process.exit(1);
}

const yaml = loadYaml();
const raw = readFileSync(file, "utf8").trim();
let doc;
try {
  doc = raw.startsWith("{") || raw.startsWith("[") ? JSON.parse(raw) : yaml.safeLoad(raw);
} catch (e) {
  console.error(`[check] 解析失败：${e.message}`);
  process.exit(1);
}

if (!doc || typeof doc !== "object") {
  console.error("[check] 顶层不是对象");
  process.exit(1);
}

/* ---------- 根字段 ---------- */
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const canvas = doc.canvas || {};
if (!isNum(canvas.w) || !isNum(canvas.h) || canvas.w <= 0 || canvas.h <= 0) {
  fail("canvas.w / canvas.h 缺失或非正数");
}
if (doc.nodeHeight != null && (!isNum(doc.nodeHeight) || doc.nodeHeight <= 0)) {
  warn("nodeHeight 非正数，插件会回退到 72");
}

/* ---------- bands ---------- */
const bands = Array.isArray(doc.bands) ? doc.bands : [];
if (bands.length === 0) fail("bands 为空：节点会没有颜色、图例为空");
const bandIds = new Set();
for (const [i, b] of bands.entries()) {
  if (!b || typeof b !== "object") {
    fail(`bands[${i}] 不是对象`);
    continue;
  }
  if (!b.id) fail(`bands[${i}] 缺 id`);
  else if (bandIds.has(b.id)) fail(`band id 重复：${b.id}`);
  else bandIds.add(b.id);
  if (!b.label) warn(`band ${b.id || i} 缺 label，图例项没有文字`);
  if (!/^#[0-9a-fA-F]{6}$/.test(String(b.color || ""))) {
    fail(`band ${b.id || i} 的 color 不是 #rrggbb：${b.color}`);
  }
}

/* ---------- nodes ---------- */
const nodes = Array.isArray(doc.nodes) ? doc.nodes : [];
if (nodes.length === 0) warn("nodes 为空：图会是空画布");
const nodeById = new Map();
const rects = [];
for (const [i, n] of nodes.entries()) {
  const at = `nodes[${i}]${n && n.id ? `(${n.id})` : ""}`;
  if (!n || typeof n !== "object") {
    fail(`${at} 不是对象`);
    continue;
  }
  if (!n.id) fail(`${at} 缺 id`);
  else if (nodeById.has(n.id)) fail(`node id 重复：${n.id}`);
  if (n.band && !bandIds.has(n.band)) fail(`${at} 的 band 未定义：${n.band}`);
  if (!n.band) fail(`${at} 缺 band`);
  if (n.title == null) fail(`${at} 缺 title`);
  for (const k of ["x", "y", "w", "h"]) {
    if (!isNum(n[k])) fail(`${at} 的 ${k} 不是数字：${n[k]}`);
  }
  if (isNum(n.w) && n.w <= 0) fail(`${at} 的 w<=0`);
  if (isNum(n.h) && n.h <= 0) fail(`${at} 的 h<=0`);

  if (isNum(n.x) && isNum(n.y) && isNum(n.w) && isNum(n.h)) {
    nodeById.set(n.id, { ...n });
    rects.push({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h });
    if (isNum(canvas.w) && isNum(canvas.h)) {
      if (n.x < 0 || n.y < 0 || n.x + n.w > canvas.w || n.y + n.h > canvas.h) {
        warn(`${at} 超出画布 ${canvas.w}×${canvas.h}（x=${n.x}, y=${n.y}, w=${n.w}, h=${n.h}）`);
      }
    }
  }
}

/* 节点重叠：只警告，重叠有时是有意的（如叠层） */
for (let i = 0; i < rects.length; i += 1) {
  for (let j = i + 1; j < rects.length; j += 1) {
    const a = rects[i];
    const b = rects[j];
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (overlapX > 0 && overlapY > 0) {
      warn(`节点重叠：${a.id} 与 ${b.id}（交叠 ${overlapX}×${overlapY}）`);
    }
  }
}

/* ---------- edges ---------- */
const edges = Array.isArray(doc.edges) ? doc.edges : [];
for (const [i, e] of edges.entries()) {
  const at = `edges[${i}]${e && e.from ? `(${e.from}→${e.to})` : ""}`;
  if (!e || typeof e !== "object") {
    fail(`${at} 不是对象`);
    continue;
  }
  if (!e.from || !nodeById.has(e.from)) fail(`${at} 的 from 指向不存在的节点：${e.from}`);
  if (!e.to || !nodeById.has(e.to)) fail(`${at} 的 to 指向不存在的节点：${e.to}`);
  if (e.from && e.from === e.to) fail(`${at} 是自环`);
  for (const k of ["sSide", "tSide"]) {
    if (e[k] != null && !SIDES.has(e[k])) {
      fail(`${at} 的 ${k} 不合法：${e[k]}（只能是 top/right/bottom/left）`);
    }
  }
  for (const k of ["sRatio", "tRatio"]) {
    if (e[k] != null && (!isNum(e[k]) || e[k] < 0 || e[k] > 1)) {
      fail(`${at} 的 ${k} 应在 0–1：${e[k]}`);
    }
  }
  if (e.arrow != null && typeof e.arrow !== "boolean") fail(`${at} 的 arrow 应为布尔`);
  if (e.dashed != null && typeof e.dashed !== "boolean") fail(`${at} 的 dashed 应为布尔`);
  if (e.url != null && typeof e.url !== "string") warn(`${at} 的 url 应为字符串（连线标注）`);
}

/* ---------- 输出 ---------- */
const counts = `bands=${bands.length} nodes=${nodes.length} edges=${edges.length}`;
for (const w of warnings) console.log(`[warn] ${w}`);
for (const e of errors) console.log(`[error] ${e}`);

if (errors.length > 0) {
  console.log(`\nFAIL (${counts}) — ${errors.length} 个错误，${warnings.length} 个警告`);
  process.exit(1);
}
console.log(`\nPASS (${counts})${warnings.length ? ` — ${warnings.length} 个警告` : ""}`);

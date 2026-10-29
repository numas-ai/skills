#!/usr/bin/env node
/**
 * pano 几何质量门。
 *
 * 结构检查由 check.mjs 负责；本脚本只检查已经写入数据的几何约束。
 * 未写坐标 / points 的字段交给插件运行时布局，不凭空替 AI 预测结果。
 * PASS 退出码 0，FAIL 退出码 1。
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const yaml = require(resolve(here, "vendor/yaml.min.js"));
const target = process.argv[2];

if (!target) {
  console.error("用法：node <技能目录>/scripts/quality.mjs <file.pano>");
  process.exit(1);
}

const file = resolve(process.cwd(), target);
if (!existsSync(file)) {
  console.error(`[quality] 文件不存在：${file}`);
  process.exit(1);
}

let doc;
try {
  const raw = readFileSync(file, "utf8");
  doc = raw.trim().startsWith("{") ? JSON.parse(raw) : yaml.safeLoad(raw);
} catch (error) {
  console.error(`[quality] 解析失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const nodes = Array.isArray(doc?.nodes) ? doc.nodes : [];
const edges = Array.isArray(doc?.edges) ? doc.edges : [];
const rects = new Map();

for (const node of nodes) {
  if (!node || typeof node.id !== "string") continue;
  if (![node.x, node.y, node.w, node.h].every(isNumber)) {
    warn(`节点 ${node.id} 未写完整坐标，尺寸与位置交给插件运行时布局`);
    continue;
  }
  if (node.w < 118) warn(`节点 ${node.id} 宽度 ${node.w} 小于默认可读宽度 118`);
  rects.set(node.id, { x0: node.x, y0: node.y, x1: node.x + node.w, y1: node.y + node.h });
}

const intersects = (a, b, padding = 0) =>
  a.x0 < b.x1 + padding && a.x1 > b.x0 - padding && a.y0 < b.y1 + padding && a.y1 > b.y0 - padding;

const segmentHitsRect = (a, b, rect, padding = 0) => {
  const horizontal = Math.abs(a.y - b.y) < 0.5;
  const vertical = Math.abs(a.x - b.x) < 0.5;
  if (!horizontal && !vertical) return true;
  if (horizontal) {
    const y = a.y;
    return y > rect.y0 - padding && y < rect.y1 + padding &&
      Math.max(Math.min(a.x, b.x), rect.x0 - padding) < Math.min(Math.max(a.x, b.x), rect.x1 + padding);
  }
  const x = a.x;
  return x > rect.x0 - padding && x < rect.x1 + padding &&
    Math.max(Math.min(a.y, b.y), rect.y0 - padding) < Math.min(Math.max(a.y, b.y), rect.y1 + padding);
};

const segments = [];
for (const [index, edge] of edges.entries()) {
  if (!edge?.points || !Array.isArray(edge.points) || edge.points.length === 0) continue;
  const from = rects.get(edge.from);
  const to = rects.get(edge.to);
  const points = edge.points.filter((p) => isNumber(p?.x) && isNumber(p?.y));
  if (points.length !== edge.points.length) {
    fail(`边 ${edge.from}→${edge.to} 的 points 含非法点`);
    continue;
  }
  if (points.length < 1) continue;
  const path = points;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    if (Math.abs(a.x - b.x) >= 0.5 && Math.abs(a.y - b.y) >= 0.5) {
      fail(`边 ${edge.from}→${edge.to} 的 points[${i}]→points[${i + 1}] 不是水平/垂直线`);
    }
    segments.push({ edge: index, a, b });
    for (const [id, rect] of rects) {
      if (id !== edge.from && id !== edge.to && segmentHitsRect(a, b, rect, 6)) {
        fail(`边 ${edge.from}→${edge.to} 穿过节点 ${id}`);
      }
    }
  }
}

for (let i = 0; i < segments.length; i += 1) {
  for (let j = i + 1; j < segments.length; j += 1) {
    const a = segments[i];
    const b = segments[j];
    if (a.edge === b.edge) continue;
    const ah = Math.abs(a.a.y - a.b.y) < 0.5;
    const bh = Math.abs(b.a.y - b.b.y) < 0.5;
    if (ah === bh) continue;
    const h = ah ? a : b;
    const v = ah ? b : a;
    const cross = Math.min(h.a.x, h.b.x) < v.a.x && v.a.x < Math.max(h.a.x, h.b.x) &&
      Math.min(v.a.y, v.b.y) < h.a.y && h.a.y < Math.max(v.a.y, v.b.y);
    if (cross) warn(`显式折线 edge[${a.edge}] 与 edge[${b.edge}] 交叉`);
  }
}

for (const [a, b] of [...rects.entries()]) {
  for (const [c, d] of [...rects.entries()]) {
    if (a[0] >= c[0]) continue;
    if (intersects(a[1], c[1], 12)) warn(`节点 ${a[0]} 与 ${c[0]} 间距不足 12px`);
  }
}

for (const message of warnings) console.log(`[warn] ${message}`);
for (const message of errors) console.log(`[error] ${message}`);
if (errors.length > 0) {
  console.log(`\nFAIL (nodes=${nodes.length} edges=${edges.length}) — ${errors.length} 个错误，${warnings.length} 个警告`);
  process.exit(1);
}
console.log(`\nPASS (nodes=${nodes.length} edges=${edges.length})${warnings.length ? ` — ${warnings.length} 个警告` : ""}`);

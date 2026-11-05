#!/usr/bin/env node
/**
 * UI 质感自查：把 SKILL.md 里能量化的几条，跑成一份「可能需要注意」的提示清单。
 *
 * 用法：
 *   node skills/skills/ui-designer/scripts/selfcheck.mjs <URL> [--dark] [--json]
 *
 * 检查项（对应 SKILL.md 第四节（光学）与第六节（动效）里"机器能查"的部分）：
 *   1. 分层不靠深色 1px 边框        —— 统计深色描边元素（亮色主题下）
 *   2. 数字等宽                    —— 样式表里是否出现 tabular-nums，且计时类元素生效
 *   3. 动效时长在档位内            —— transition/animation 时长必须落在允许集合
 *   4. prefers-reduced-motion 降级 —— 样式表里必须有该媒体查询
 *   5. 行内 svg 光学对齐           —— 文本里的 svg 不能是默认 baseline
 *
 * 输出定位：**提示清单**，不是门禁 —— 永远退出 0，怎么用由读的人判断。
 * 第三方组件库（ant-* / kt_* / monaco 等）不参与：它们不归我们管。
 *
 * 依赖 playwright：脚本不自动安装，缺了会打印安装命令。
 */
import process from "node:process";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const dark = args.includes("--dark");
const asJson = args.includes("--json");

if (!url) {
  console.error("用法: node selfcheck.mjs <URL> [--dark] [--json]");
  process.exit(2);
}

/*
 * 优先用完整 playwright（自带 chromium）；只装了 playwright-core 时，退回系统 Chrome。
 * 两者都没有就提示安装命令，不自动装依赖。
 */
let chromium;
let launchOptions = {};
try {
  ({ chromium } = await import("playwright"));
} catch {
  try {
    ({ chromium } = await import("./node_modules/playwright-core/index.mjs"));
    launchOptions = { channel: "chrome" };
  } catch {
    console.error("需要 playwright 或 playwright-core（本目录已带后者）：node scripts/audit.mjs <URL>");
    process.exit(2);
  }
}

/* 动效不设白名单：档位数由"这套界面有几级重量"决定，不由固定表决定。
   这里只判断"是不是成了体系"——值太散说明每处都在随手给。 */
const MAX_MOTION_TIERS = 5;

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage();
let report;
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  if (dark) {
    // 尝试切暗色：优先 data 属性，其次 prefers-color-scheme
    await page.emulateMedia({ colorScheme: "dark" }).catch(() => {});
  }
  await page.waitForTimeout(600);

  report = await page.evaluate(({ isDark, maxTiers }) => {
    const issues = [];

    /* 1) 深色 1px 边框做分层（亮色主题下才算问题） */
    const darkBorders = [];
    if (!isDark) {
      const thirdParty = (el) => /^(ant-|kt_|kt-|monaco|opensumi)/i.test((el.className || "").toString());
      for (const el of document.querySelectorAll("body *")) {
        if (thirdParty(el)) continue;
        const s = getComputedStyle(el);
        const w = parseFloat(s.borderTopWidth) || 0;
        if (w <= 0 || w > 1.5) continue;
        if (s.borderTopStyle === "none") continue;
        const m = s.borderTopColor.match(/rgba?\(([^)]+)\)/);
        if (!m) continue;
        const [r, g, b] = m[1].split(",").map((v) => parseFloat(v));
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const rect = el.getBoundingClientRect();
        const bigEnough = rect.width > 240 && rect.height > 80; /* 只有大块容器才谈"用边框分层" */
        if (luma < 0.45 && bigEnough) darkBorders.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`);
      }
    }
    if (darkBorders.length > 0) {
      issues.push({ id: "border-layering", level: "info", detail: `深色 1px 描边 ${darkBorders.length} 处（示例：${darkBorders.slice(0, 3).join(", ")}）` });
    }

    /* 2) tabular-nums */
    let hasTabular = false;
    const expectTabular = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of rules) {
        if (rule.cssText && rule.cssText.includes("tabular-nums")) hasTabular = true;
      }
    }
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length > 0) continue;
      const text = (el.textContent || "").trim();
      if (/^\d+\s*(秒|s|ms|个|项|%)$/.test(text) || /^0?\.?\d{2,}$/.test(text)) {
        const s = getComputedStyle(el);
        if (!/tabular-nums/.test(s.fontVariantNumeric)) {
          expectTabular.push(text.slice(0, 12));
        }
      }
    }
    if (!hasTabular && expectTabular.length > 0) {
      issues.push({ id: "tabular-nums", level: "info", detail: `数值元素未用等宽数字（${expectTabular.slice(0, 3).join(" / ")}）` });
    }

    /* 3) 动效是否成体系：时长种类过多 = 每处随手给，而不是"轻/中/重"几级 */
    const durations = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      for (const raw of `${s.transitionDuration},${s.animationDuration}`.split(",")) {
        const v = raw.trim();
        if (!v) continue;
        const ms = v.endsWith("ms") ? parseFloat(v) : v.endsWith("s") ? parseFloat(v) * 1000 : NaN;
        if (Number.isNaN(ms) || ms === 0) continue;
        if (ms > 2000) continue; /* 环境动画/装饰动画不按交互档位要求 */
        durations.add(Math.round(ms));
      }
    }
    const tiers = [...durations].sort((a, b) => a - b);
    if (tiers.length > maxTiers) {
      issues.push({
        id: "motion-scale",
        level: "info",
        detail: `动效有 ${tiers.length} 个不同时长（${tiers.join(", ")}ms），看不出"轻/中/重"分级；先定几级重量，再把值收拢`,
      });
    }

    /* 4) prefers-reduced-motion */
    let hasReduced = false;
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of rules) {
        if (rule.cssText && rule.cssText.includes("prefers-reduced-motion")) hasReduced = true;
      }
    }
    if (!hasReduced) {
      issues.push({ id: "reduced-motion", level: "info", detail: "缺少 @media (prefers-reduced-motion: reduce) 降级" });
    }

    /* 5) 行内 svg 垂直对齐 */
    const badSvg = [];
    for (const svg of document.querySelectorAll("button svg, a svg, p svg, span svg, label svg")) {
      const s = getComputedStyle(svg);
      if (s.verticalAlign === "baseline" && s.display !== "block") {
        badSvg.push(svg.parentElement?.className?.toString().slice(0, 20) || svg.tagName);
      }
    }
    if (badSvg.length > 0) {
      issues.push({ id: "svg-align", level: "info", detail: `行内 svg 未做 -0.125em 光学对齐（${badSvg.length} 处）` });
    }

    return { issues };
  }, { isDark: dark, maxTiers: MAX_MOTION_TIERS });
} catch (error) {
  await browser.close();
  console.error(`打开页面失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
await browser.close();

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  if (report.issues.length === 0) {
    console.log("没有需要提示的点");
  } else {
    for (const issue of report.issues) {
      console.log(`提示  ${issue.id}: ${issue.detail}`);
    }
  }
}

process.exit(0);

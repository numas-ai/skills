/**
 * hover-check.js — 全景图「悬停效果」自检（在插件页面里运行）
 *
 * 为什么需要：悬停时的解释与流动动画是这张图的主要表达方式，
 * 但它们靠肉眼很难判定（点太小、跑太快像静止、接缝跳变、链路少一环）。
 * 这个脚本把「该亮的是否亮、点是否真在动、是否说清自己是谁」变成 PASS/FAIL。
 *
 * 用法：
 *   1) 在 IDE 里双击打开 .pano；
 *   2) 打开开发者工具控制台（View → Toggle Developer Tools）；
 *   3) 粘贴本文件全部内容，回车；
 *   4) 执行：await panoHoverCheck()
 *
 * 判定（逐节点）：
 *   dots >= 2        至少一对流动点
 *   150ms 位移 > 2px  真的在动（防"看着像静止"）
 *   maxStep <= 8×中位 没有接缝跳变
 *   亮节点 >= 2、亮边 >= 1、存在压暗节点   高亮成链且有对比
 *   弹出卡片可见且非空                     悬停时用卡片表达自己
 *   卡片含「意图」与「在模式中的位置」         讲清为什么存在、替哪个模式做什么
 *
 * 输出：{ pass, failures: [...], rows: [...] }
 */
async function panoHoverCheck() {
  const findDoc = (d, n) => {
    if (n > 5) return null;
    if (d.querySelector(".x6-graph")) return d;
    for (const f of d.querySelectorAll("iframe")) {
      try {
        const x = f.contentDocument;
        if (x) { const h = findDoc(x, n + 1); if (h) return h; }
      } catch (e) { /* 跨域忽略 */ }
    }
    return null;
  };

  const doc = findDoc(document, 0);
  if (!doc) return { pass: false, failures: ["找不到图容器（.x6-graph）——确认 .pano 已用插件打开"], rows: [] };
  const graph = doc.defaultView.__graph;
  if (!graph) return { pass: false, failures: ["页面未暴露 window.__graph"], rows: [] };

  const fire = (id, enter) => {
    const el = doc.querySelector(`.x6-node[data-cell-id="${id}"]`);
    if (!el) return;
    (enter ? ["mouseover", "mouseenter"] : ["mouseout", "mouseleave"])
      .forEach((t) => el.dispatchEvent(new MouseEvent(t, { bubbles: true })));
  };
  const snap = () => [...doc.querySelectorAll(".flow-dot")]
    .map((d) => [+d.getAttribute("cx"), +d.getAttribute("cy")]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const failures = [];
  const rows = [];

  for (const node of graph.getNodes()) {
    fire(node.id, true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const frames = [];
    for (let i = 0; i < 6; i += 1) { frames.push(snap()); await wait(150); }

    const dots = frames[0].length;
    const steps = [];
    for (let i = 1; i < frames.length; i += 1) {
      for (let j = 0; j < frames[i].length; j += 1) {
        const a = frames[i - 1][j];
        const b = frames[i][j];
        if (a && b) steps.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
    }
    const sorted = [...steps].sort((x, y) => x - y);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const maxStep = steps.length ? Math.max(...steps) : 0;

    const litNodes = graph.getNodes().filter((n) => +n.attr("body/opacity") === 1).length;
    const dimNodes = graph.getNodes().filter((n) => +n.attr("body/opacity") < 1).length;
    const litEdges = graph.getEdges().filter((e) => +e.attr("line/strokeOpacity") === 1).length;

    const pop = doc.getElementById("pano-popover");
    const popText = pop ? (pop.innerText || "").trim() : "";
    const popShown = !!pop && pop.style.opacity === "1" && popText.length > 10;

    rows.push({
      id: node.id, dots,
      medianStep: Math.round(median * 10) / 10,
      maxStep: Math.round(maxStep),
      litNodes, litEdges, popShown,
    });

    if (dots < 2) failures.push(`${node.id}: 流动点只有 ${dots} 个（应 ≥ 2）`);
    if (median <= 2) failures.push(`${node.id}: 点几乎不动（中位位移 ${median.toFixed(1)}px/150ms）`);
    if (median > 0 && maxStep > median * 8) failures.push(`${node.id}: 存在跳变（最大 ${maxStep}px vs 中位 ${median.toFixed(1)}px）`);
    if (litNodes < 2) failures.push(`${node.id}: 只亮了 ${litNodes} 个节点（链路没串起来）`);
    if (litEdges < 1) failures.push(`${node.id}: 没有亮起任何边`);
    if (dimNodes < 1) failures.push(`${node.id}: 没有节点被压暗（高亮没有对比）`);
    if (!/入口|端点|汇聚|分发|终点|中间环节|发起端/.test(popText)) failures.push(`${node.id}: 卡片里没有角色判断`);
    if (!popShown) failures.push(`${node.id}: 悬停没有弹出作用卡片（或卡片内容为空）`);
    if (popShown && !/意图/.test(popText)) failures.push(`${node.id}: 卡片只罗列结构，没讲清"为什么存在"（缺意图）`);

    fire(node.id, false);
    await wait(60);
  }

  return { pass: failures.length === 0, failures, rows };
}

if (typeof window !== "undefined") window.panoHoverCheck = panoHoverCheck;

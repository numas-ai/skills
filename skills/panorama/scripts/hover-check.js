/**
 * pano-hover-check.js — 全景图 hover 质量自检（浏览器内运行）
 *
 * 为什么需要：hover 高亮与流动动画是这张图的表达核心，出问题肉眼很难判定
 * （点太小、跑太快像静止、接缝处跳变、环路上少一个节点）。这个脚本把
 * 「该亮哪些、点该在动、动得均不均」变成可判定的 PASS/FAIL。
 *
 * 用法（二选一）：
 *   1) 在装了 panorama 插件的 IDE 里打开 .pano，F12 控制台粘贴执行：
 *        await panoHoverCheck()
 *   2) 通过 CDP / playwright 在页面上下文执行本函数体
 *
 * 判定项（每个节点）：
 *   A. 流动点存在：dots >= 2（一条链至少一对）
 *   B. 点确实在动：150ms 内位移 > 2px
 *   C. 没有跳变：相邻帧位移 <= 8 × 中位位移（接缝跳跃会远超这个倍数）
 *   D. 高亮成链：亮起的节点 >= 2、亮起的边 >= 1
 *   E. 压暗生效：至少有 1 个节点被压暗（说明不是全亮）
 *   F. 作用解释：悬停卡片给出「由结构推导」的说明（角色 / 意图 / 上下游 / 位置，
 *      正文 >= 3 段），不接受只显示标题副标题——那说明解释没生成或退化成静态文案
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
  if (!doc) return { pass: false, failures: ["找不到图容器（.x6-graph）"], rows: [] };

  const graph = doc.defaultView.__graph;
  if (!graph) return { pass: false, failures: ["页面没有暴露 window.__graph"], rows: [] };

  const fire = (id, enter) => {
    const el = doc.querySelector(`.x6-node[data-cell-id="${id}"]`);
    if (!el) return;
    const types = enter ? ["mouseover", "mouseenter"] : ["mouseout", "mouseleave"];
    types.forEach((t) => el.dispatchEvent(new MouseEvent(t, { bubbles: true })));
  };
  const snap = () =>
    [...doc.querySelectorAll(".flow-dot")].map((d) => [+d.getAttribute("cx"), +d.getAttribute("cy")]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const failures = [];
  const rows = [];

  /*
   * 等布局/缩放稳定再采样：页面刚打开时插件还在做 fit（矩阵在变），
   * 这时逐帧比对流动点会读到「整张图在动」的位移，误判成接缝跳变。
   * 判据：连续两次读到的矩阵相同即视为稳定，最多等 2s。
   */
  const matrixKey = () => {
    const m = graph.matrix();
    return `${m.a},${m.d},${m.e},${m.f}`;
  };
  const settle = async () => {
    let prev = matrixKey();
    for (let i = 0; i < 40; i += 1) {
      await wait(50);
      const cur = matrixKey();
      if (cur === prev) return true;
      prev = cur;
    }
    return false;
  };
  const settled = await settle();
  if (!settled) failures.push("缩放/布局在 2s 内没有稳定，采样结果可能不准（先点「适应」再重跑）");

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

    // 卡片按行渲染（标题 / 副标题 / 层 / 角色 / 意图 / 上下游 / 位置），
    // innerText 的换行数就是「讲了几件事」的粗略度量。
    const sections = popText.split(/\n+/).map((x) => x.trim()).filter(Boolean);

    const row = { id: node.id, dots, medianStep: Math.round(median * 10) / 10, maxStep: Math.round(maxStep), litNodes, litEdges, sections: sections.length };
    rows.push(row);

    if (dots < 2) failures.push(`${node.id}: 流动点只有 ${dots} 个（应 >= 2）`);
    if (median <= 2) failures.push(`${node.id}: 点几乎不动（中位位移 ${row.medianStep}px/150ms）`);
    if (median > 0 && maxStep > median * 8) failures.push(`${node.id}: 存在跳变（最大 ${maxStep}px vs 中位 ${row.medianStep}px）`);
    if (litNodes < 2) failures.push(`${node.id}: 只亮了 ${litNodes} 个节点（链路没串起来）`);
    if (litEdges < 1) failures.push(`${node.id}: 没有亮起任何边`);
    if (dimNodes < 1) failures.push(`${node.id}: 没有节点被压暗（高亮没有对比）`);
    if (sections.length < 3) failures.push(`${node.id}: 作用卡片讲得太少（只有 ${sections.length} 段：${popText}）`);
    if (!/入口|端点|汇聚|分发|终点|中间环节|发起端/.test(popText)) failures.push(`${node.id}: 卡片里没有角色判断`);
    if (!popShown) failures.push(`${node.id}: 悬停没有弹出作用卡片（或卡片内容为空）`);
    if (popShown && !/意图/.test(popText)) failures.push(`${node.id}: 卡片只罗列结构，没讲清"为什么存在"（缺意图）`);

    fire(node.id, false);
    await wait(60);
  }

  return { pass: failures.length === 0, failures, rows };
}

/* 控制台里直接可用 */
if (typeof window !== "undefined") window.panoHoverCheck = panoHoverCheck;

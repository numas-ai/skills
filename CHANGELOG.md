# CHANGELOG（skills）

**维护约定**：AI 在每次提交时记录一条核心变更；人审计确认后，在「审计」列改为 ✅。
按分支分组，同一分支内最新在上。只记核心变更点，不以提交标题代替。

## main

| 日期 | 提交 | 核心变更 | 影响面 | 审计 |
| --- | --- | --- | --- | --- |
| 2026-10-31 | 7a52f05 | 新增 CHANGELOG.md 骨架（按分支分组的变更记录表） | CHANGELOG.md | 待审计 |
| 2026-10-29 | dc9f05e | pano 技能要求流程路径必须走到最终承接节点 | skills/panorama/SKILL.md | 待审计 |
| 2026-10-29 | 6201a78 | pano 技能将交互流程声明为图数据，check.mjs 新增对应校验（+40 行） | skills/panorama/SKILL.md、scripts/check.mjs | 待审计 |
| 2026-10-29 | 587250b | 重写 pano 技能的语义推导与失败修正路径 | skills/panorama/SKILL.md | 待审计 |
| 2026-10-29 | b185931 | 新增 pano 几何质量门 scripts/quality.mjs（131 行），SKILL.md 与 README 同步 | skills/panorama/、README.md | 待审计 |
| 2026-10-29 | 00f4973 | 明确 pano 动态布局与连线优先级 | skills/panorama/SKILL.md | 待审计 |
| 2026-10-29 | 05100a1 | pano 技能补充节点间距与正交布线验收规则 | skills/panorama/SKILL.md | 待审计 |
| 2026-10-29 | 8b2fc24 | 明确 pano 不生成任何预览文件 | skills/panorama/SKILL.md | 待审计 |
| 2026-10-29 | 8d61f43 | pano 技能加入十分钟路径与自动布局说明，check.mjs 同步调整 | skills/panorama/SKILL.md、scripts/check.mjs | 待审计 |
| 2026-10-29 | 01b70af | pano 技能去掉 HTML 形态，补充自动使用与连线手工字段，check.mjs 增加 12 行校验 | skills/panorama/SKILL.md、scripts/check.mjs | 待审计 |
| 2026-10-29 | 8b8ad6e | 技能字段示例改为占位符，去掉可照抄内容 | skills/panorama/SKILL.md | 待审计 |
| 2026-10-29 | f9ce49a | 技能统一迁移到 skills/<name>/ 目录（distillation 与 panorama 纯移动，无内容改动） | README.md、skills/distillation/、skills/panorama/ | 待审计 |
| 2026-10-24 | 8b5a90e | panorama 技能并入分层全景图的产出方法，删除静态 HTML 模板 | README.md、panorama/SKILL.md | 待审计 |
| 2026-10-24 | 75ba0b2 | 新增 distillation 技能：捕获、晋升与周审计的说明及 distill.py 脚本 | distillation/、README.md | 待审计 |
| 2026-10-23 | 4d584a7 | panorama 技能定位改为 AI 维护 .pano 数据（而非插件使用说明），hover-check.js 同步改写 | README.md、panorama/SKILL.md、panorama/scripts/hover-check.js | 待审计 |
| 2026-10-22 | 6f09169 | 文档补充全景图全屏查看（专注态，Esc 退出） | panorama/SKILL.md | 待审计 |
| 2026-10-22 | 0961362 | 文档同步：状态栏已移除、卡片更透明、说明只由卡片承载，hover-check.js 调整 | panorama/SKILL.md、panorama/scripts/hover-check.js | 待审计 |
| 2026-10-22 | f61757a | 技能补充容器自适应、卡片半透明、主题探测优先级 | panorama/SKILL.md | 待审计 |
| 2026-10-22 | 8089e5b | 技能补充意图推导规则与两个推理坑，hover-check.js 强制卡片含意图 | panorama/SKILL.md、panorama/scripts/hover-check.js | 待审计 |
| 2026-10-22 | ba9239f | 使用线补充 popover 事实，hover-check.js 新增「卡片可见且非空」断言 | panorama/SKILL.md、panorama/scripts/hover-check.js | 待审计 |
| 2026-10-22 | 3599103 | 使用线修正：删除设计纲领、按形态区分能力、边标签降为建议、判据改为可验证项；新增 hover-check.js（105 行） | panorama/SKILL.md、panorama/scripts/check.mjs、panorama/scripts/hover-check.js | 待审计 |
| 2026-10-22 | f497623 | 技能纲领新增内容层与渲染层；check.mjs 强制数据自带语义 | panorama/SKILL.md、panorama/scripts/check.mjs | 待审计 |
| 2026-10-22 | 8fe02b0 | 能力线升级为 AI 自驱：节点语义推导规则、角色判定优先级、自检闭环与修正路径 | panorama/SKILL.md | 待审计 |
| 2026-10-22 | eea06ef | SKILL.md 新增「节点串联推导」规则（含动画质量阈值） | panorama/SKILL.md | 待审计 |
| 2026-10-22 | ebcd438 | 新增闭环/双工表达规则；check.mjs 拦截同一对节点的重复边 | panorama/SKILL.md、panorama/scripts/check.mjs | 待审计 |
| 2026-10-21 | 072cfc6 | 技能改为按需激活：README 移除常驻指针 | README.md | 待审计 |
| 2026-10-21 | d9b1295 | 技能自包含：内置 yaml 解析库 scripts/vendor/yaml.min.js，去掉跨仓取用 | README.md、panorama/SKILL.md、panorama/scripts/check.mjs、panorama/scripts/vendor/ | 待审计 |
| 2026-10-21 | a5d19fe | 技能改为面向插件使用者，移除项目内部约定 | README.md、panorama/SKILL.md | 待审计 |
| 2026-10-21 | 9f58175 | 新增 panorama 技能：SKILL.md、scripts/check.mjs 校验器与 README（提交标题所述 apps/ 路径未出现在本提交 stat 中） | README.md、panorama/ | 待审计 |

> 起点：本文件自 2026-10-31 起记录；此前历史未补录。

> 历史条目按 git commit 提炼（2026-10-31 回补）；审计由人确认。

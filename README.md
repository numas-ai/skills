# skills — 让 agent 能自主干一类活

本目录存放**一类产物的产出方法**，形式是 agent skill：一个 `SKILL.md` + 可选脚本。
读者是 **agent**：它要能按技能自己判断「什么时候该产出、内容怎么定、怎么校验、交付什么」。

技能写的是**产物本身怎么维护**（内容、语义、质量门），不是某个插件的安装 / 打开说明。
插件只是渲染与交互层：数据由 agent 维护，效果由人在插件里看。

**不常驻**：本目录不在 agent 的自动发现路径里（`.opencode/skills/` 下没有它的指针）。
需要时明确点名使用，例如「按 `skills/panorama/SKILL.md` 更新这张全景图」，或直接把该文件读入上下文。

## 目录

| 技能 | 产物（agent 维护的对象） | 渲染 / 消费方 | 自检 |
| --- | --- | --- | --- |
| [`panorama`](panorama/SKILL.md) | `*.pano` / `*.panorama` 数据文档（YAML：分层 / 节点 / 连线 / 语义标签） | numas 插件 `numas.panorama` | `node skills/panorama/scripts/check.mjs <file>` |
| [`distillation`](distillation/SKILL.md) | `.distill/inbox` 的原始捕获 → 晋升为项目规则、技能、工具或 `decisions/` 决策记录 | 项目自身的 `AGENTS.md`、技能目录、工具目录 | `python3 skills/distillation/scripts/distill.py audit` |

## 自包含约定

每个技能只依赖本仓库内的文件，不引用其它仓库的路径：

- 需要第三方库就收进技能目录（如 `panorama/scripts/vendor/yaml.min.js`，js-yaml 3.15.2 / MIT）；
- 脚本里的路径一律相对本仓库根或技能目录；
- 不出现在别的仓库里才能取到的东西（依赖、示例、数据）。

## 新增一个技能

1. 建 `skills/<技能名>/SKILL.md`，frontmatter 写 `name` + `description`（description 要写清「什么时候用」，它是唯一的触发依据）；
2. 正文回答四件事：**什么时候该产出、内容怎么推导、字段怎么落、交付前怎么校验**；
   安装 / 打开 / 界面按钮这类使用侧说明不进正文（属于消费方文档）；
3. 只写事实——字段语义、推导规则以实际实现为准，不写推测；
4. 能给自检脚本就给（`scripts/`），依赖随脚本放进 `scripts/vendor/`，判定要可复现（PASS/FAIL + 退出码）；
5. 更新上表；不要往 `.opencode/skills/` 放指针（技能按需激活，不常驻）。

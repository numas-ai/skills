# skills — 插件使用方式（供 agent 调用）

本目录存放**插件怎么用**，形式是 agent skill：一个 `SKILL.md` + 可选脚本。
读者是**使用插件的人**——只说「这个插件能做什么、怎么打开、数据长什么样、常见问题怎么解」。

**不常驻**：本目录不在 agent 的自动发现路径里（`.opencode/skills/` 下没有它的指针）。
需要时明确点名使用，例如「按 `skills/panorama/SKILL.md` 画一张全景图」，或直接把该文件读入上下文。

## 目录

| 技能 | 对应插件 | 产出物 | 自检 |
| --- | --- | --- | --- |
| [`panorama`](panorama/SKILL.md) | numas `numas.panorama` | `*.pano` / `*.panorama`（YAML 数据） | `node skills/panorama/scripts/check.mjs <file>` |

## 自包含约定

每个技能只依赖本仓库内的文件，不引用其它仓库的路径：

- 需要第三方库就收进技能目录（如 `panorama/scripts/vendor/yaml.min.js`，js-yaml 3.15.2 / MIT）；
- 脚本里的路径一律相对本仓库根或技能目录；
- 不出现在别的仓库里才能取到的东西（依赖、示例、数据）。

## 新增一个插件技能

1. 建 `skills/<插件名>/SKILL.md`，frontmatter 写 `name` + `description`（写清「什么时候用」）；
2. 正文以使用者视角写：能做什么、怎么打开、界面操作、数据格式、可直接用的骨架、常见问题；
3. 只写事实——以插件实际行为为准，不写推测；
4. 能给自检脚本就给（`scripts/`），依赖随脚本放进 `scripts/vendor/`；
5. 更新上表；不要往 `.opencode/skills/` 放指针（技能按需激活，不常驻）。

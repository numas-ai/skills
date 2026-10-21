# skills — 插件使用方式（供 agent 调用）

本目录存放**插件怎么用**，形式是 agent skill：一个 `SKILL.md` + 可选脚本。
读者是**使用插件的人**——只说「这个插件能做什么、怎么打开、数据长什么样、常见问题怎么解」。

`.opencode/skills/<同名>/` 下放指针技能，指向本目录，保证 agent 能发现。

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
5. 在 `.opencode/skills/<插件名>/SKILL.md` 放指针技能；
6. 更新上表。

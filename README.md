# skills — 插件使用方式（供 agent 调用）

本目录存放**插件怎么用**，形式是 agent skill：一个 `SKILL.md` + 可选脚本。
读者是**使用 numas 的用户**——技能只说「这个插件能做什么、怎么打开、数据长什么样、常见问题怎么解」，不写项目内部约定、不写业务流程。

`.opencode/skills/<同名>/` 下放指针技能，指向本目录，保证 agent 能发现。

## 目录

| 技能 | 对应插件 | 产出物 | 自检 |
| --- | --- | --- | --- |
| [`panorama`](panorama/SKILL.md) | numas `numas.panorama` | `*.pano` / `*.panorama`（YAML 数据） | `node skills/panorama/scripts/check.mjs <file>` |

配套示例见 [`examples/`](../examples/README.md)。

## 新增一个插件技能

1. 建 `skills/<插件名>/SKILL.md`，frontmatter 写 `name` + `description`（描述里写清「什么时候用」）；
2. 正文以**用户视角**写：能做什么、怎么打开、界面操作、数据格式、从零做一份、常见问题；
3. 只写事实——以插件源码与实测为准，不写推测；不写项目内部规范；
4. 能给自检脚本就给（`scripts/`），并在正文给出执行命令；
5. 在 `.opencode/skills/<插件名>/SKILL.md` 放指针技能；
6. 更新上表。

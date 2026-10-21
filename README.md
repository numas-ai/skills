# skills — 插件使用方式（供 agent 调用）

本目录存放**插件/工具的使用方式**，形式是 agent skill：一个 `SKILL.md` + 可选脚本。
目的是让 agent 按同一套规则产出「能直接被插件打开」的内容产物，而不是让用户手工对齐格式。

与 `apps/.opencode/skills/` 的分工：

- `apps/.opencode/skills/`：**协作流程**技能（派单、验收、文档流水线、画图规范等），服务于我们自己的开发过程；
- `apps/skills/`：**插件使用**技能，服务于「用插件产出内容」的用户场景。

`.opencode/skills/<同名>/` 下放指针技能，指向本目录，保证 agent 能发现。

## 目录

| 技能 | 对应插件 | 产出物 | 自检 |
| --- | --- | --- | --- |
| [`panorama`](panorama/SKILL.md) | numas `numas.panorama` | `*.pano` / `*.panorama`（YAML 数据） | `node skills/panorama/scripts/check.mjs <file>` |

## 新增一个插件技能

1. 建 `apps/skills/<插件名>/SKILL.md`，frontmatter 写 `name` + `description`（描述里写清「什么时候用」）；
2. 正文只写**事实**：字段表、约束、常见错误——以插件源码与实测为准，不写推测；
3. 能给自检脚本就给（放 `scripts/`），并在正文里给出执行命令；
4. 在 `.opencode/skills/<插件名>/SKILL.md` 放一个指针技能；
5. 更新上表。

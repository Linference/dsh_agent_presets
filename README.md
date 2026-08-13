# DSH Agent Presets

一套为 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH，`@deepseek-ai/dsh`）编写的**角色化 Agent 预设**集合：8 个开箱即用的专家角色，把默认的通用编码 Agent 替换为专注特定工作方式的专业角色。

> 所有预设以官方 `standard` 预设为基线（完整保留工具与能力），仅替换角色人设（persona），并按中文工作习惯撰写。

## 预设列表

| 预设 ID（目录名） | 名称 | 简介 |
| --- | --- | --- |
| `code-review` | 代码审查 | 资深代码审查员：分级挑错、给修复建议，默认只读输出审查报告 |
| `security-audit` | 安全审计 | OWASP Top 10 双重视角审计：依赖与权限风险，输出分级报告，默认只读 |
| `architecture-design` | 架构设计 | 系统级架构设计：组件划分、技术选型与 ADR 式权衡分析 |
| `requirements-analysis` | 需求分析 | 把模糊想法转化为结构化需求文档：用户故事、验收标准、风险与开放问题 |
| `task-planning` | 任务规划 | 把目标拆解为带依赖、优先级和验收标准的可执行任务计划 |
| `perf-optimization` | 性能优化 | 先测量后优化：定位真实瓶颈，给出带基准对比的优化方案 |
| `code-explainer` | 代码解释 | 带你读懂陌生代码库：模块地图、调用链与设计意图讲解，默认只读 |
| `data-review` | 数据质检 | 数据质量审查：缺失、重复、异常值与标注一致性检查，输出质量报告 |

## 快速开始

1. 克隆仓库：

   ```bash
   git clone https://github.com/Linference/dsh_agent_presets.git
   ```

2. 把需要的预设目录复制到 DSH 的用户预设根目录（`<DSH_HOME>/.agent-presets/`，其中 `DSH_HOME` 默认是 `~/.dsh`）。

   Windows（PowerShell）：

   ```powershell
   $dst = "$env:USERPROFILE\.dsh\.agent-presets"
   New-Item -ItemType Directory -Force -Path $dst | Out-Null
   Get-ChildItem -Path ".\dsh_agent_presets" -Directory |
     ForEach-Object { Copy-Item $_.FullName -Destination $dst -Recurse -Force }
   ```

   macOS / Linux：

   ```bash
   mkdir -p ~/.dsh/.agent-presets
   cp -r dsh_agent_presets/*/ ~/.dsh/.agent-presets/
   ```

3. 刷新 DSH 后，新会话即可选择这些预设（预设 ID 即目录名）；也可以在 DSH 设置里把某个预设设为默认。

## 目录结构

每个预设是一个目录，目录名即预设 ID（须匹配 `^[a-z0-9][a-z0-9-]*$`）：

```
code-review/
├── preset.yml          # 显示元数据：name（名称）、description（简介）
└── agent.cordis.yml    # Cordis 组合文件：persona + 工具/能力配置
```

- `preset.yml` 只携带选择器展示用的名称与描述，不含配置逻辑。
- `agent.cordis.yml` 是完整的 Agent 组合：角色人设、Shell、文件工具、Skills、计划模式、上下文压缩、子代理与工作流等。它以官方 `standard` 预设为基线，8 个预设之间只有 persona 段不同。

## 自定义

- **换角色**：编辑 `agent.cordis.yml` 顶部 `persona` 行的 `text` 字段即可；其中的 `{{model}}` 与 `{{cwd}}` 由 DSH 在运行时注入，无需替换。
- **改名称**：编辑 `preset.yml` 的 `name` / `description`。
- **新增预设**：复制任一目录并改名（目录名必须匹配 `^[a-z0-9][a-z0-9-]*$`）。
- **硬性只读**：部分 persona 承诺"默认只读"，但这只是提示词层面的行为约束，工具层仍开放写操作。如需严格只读，可在对应 `agent.cordis.yml` 中给写类工具行加上 `disabled: true`。

## 兼容性与升级

- 基线版本：DSH `0.1.0-rc.6`。
- `agent.cordis.yml` 是官方 `standard` 预设的完整拷贝。升级 DSH 后，官方预设可能新增工具或调整配置，建议在安装了 DSH 的工作目录里对照同步：

  ```bash
  diff code-review/agent.cordis.yml \
    node_modules/@deepseek-ai/dsh/config/agent-presets/standard/agent.cordis.yml
  ```

## 注意事项

- 修改预设后若 DSH 没有变化，请确认改的是 DSH 实际挂载的副本（`<DSH_HOME>/.agent-presets/`），而不是克隆目录——两者是独立的文件拷贝，没有自动同步。
- persona 使用中文撰写；如需英文，直接替换 `text` 内容即可。

## License

[MIT](LICENSE) © [Linference](https://github.com/Linference)

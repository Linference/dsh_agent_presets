# DSH Agent Presets

[![validate](https://github.com/Linference/dsh_agent_presets/actions/workflows/validate.yml/badge.svg)](https://github.com/Linference/dsh_agent_presets/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.1.0--rc.6-536dfe.svg)](https://www.npmjs.com/package/@deepseek-ai/dsh)

一套为 DeepSeek Harness（DSH，`@deepseek-ai/dsh`）编写的**角色化 Agent 预设**集合：16 个角色，把默认的通用编码 Agent 替换为专注特定工作方式的专业角色。

所有预设共享同一份能力基线（官方 `standard` 预设），差异只有两处：**角色人设（persona）** 与 **只读开关**。标 🔒 的预设已在工具层禁用 Shell，不是只靠提示词承诺。

## 预设列表

| 预设 ID（目录名） | 名称 | 简介 |
| --- | --- | --- |
| `code-review` 🔒 | 代码审查 | 资深代码审查员：分级挑错、给修复建议，默认只读输出审查报告 |
| `security-audit` 🔒 | 安全审计 | OWASP Top 10 (2021) 双重视角审计，输出分级风险报告，默认只读 |
| `architecture-design` | 架构设计 | 系统级架构设计：组件划分、技术选型与 ADR 式权衡分析 |
| `requirements-analysis` | 需求分析 | 把模糊想法转化为结构化需求文档：用户故事、验收标准、风险清单 |
| `task-planning` | 任务规划 | 把目标拆解为带依赖、优先级和验收标准的可执行任务计划 |
| `perf-optimization` | 性能优化 | 先测量后优化：用项目自带基准定位瓶颈，给出带数据对比的方案 |
| `code-explainer` 🔒 | 代码解释 | 带你读懂陌生代码库：模块地图、调用链与设计意图讲解，默认只读 |
| `data-review` | 数据质检 | 数据质量审查：缺失、重复、异常值与标注一致性检查，输出质量报告 |
| `code-debugger` | 调试排障 | 先复现后定位：日志、堆栈与二分法找出根因，修复前先给验证方案 |
| `code-refactor` | 安全重构 | 行为不变红线：小步机械重构、每步可测试可回退，禁止顺手改功能 |
| `test-writer` | 测试编写 | 写出能抓住回归的测试：边界、异常与并发覆盖，报告缺口与不测理由 |
| `data-analysis` | 数据分析 | 从数据里挖结论：描述统计、分布与关系探索，结论配图表与置信度 |
| `code-migration` | 迁移升级 | 安全搬家：破坏性变更评估、批次规划与回退预案，绝不一次性大改 |
| `api-designer` | 接口设计 | 稳定可演进的接口契约：schema、错误码、鉴权、限流与版本策略 |
| `documentation-writer` | 文档撰写 | 分读者分层写作：概览、快速开始、指南、参考与排障，示例真实可运行 |
| `devops-engineer` | 部署运维 | 可重复、可观测、可回滚的交付：CI/CD、容器、密钥与发布策略 |

> 🔒 = 工具层只读：bash 与 pwsh 行已 `disabled: true`；文件写入（write/edit）由会话沙箱策略裁决，persona 默认不使用。

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

```
code-review/                 # 生成产物，勿手改
├── preset.yml               # 显示元数据：name、description、order
└── agent.cordis.yml         # 完整组合：persona + 工具/能力配置

.github/
├── presets.json             # ★ 单一数据源：16 个预设的 id、元数据、人设与只读开关
├── baseline/agent.cordis.yml# 共享能力基线（官方 standard 预设的拷贝）
└── scripts/
    ├── generate.mjs         # 从上述两个来源重建全部预设目录
    └── validate.mjs         # 结构 + 只读强制 + 数据源一致性校验
```

- 预设目录**不是源文件**：改人设、改描述、加预设都只改 `.github/presets.json`，然后 `npm run generate` 重建。手改生成目录会在 CI 的可复现门禁里被揪出来。
- `preset.yml` 只携带名称、描述与 `order`（选择器排序，本仓库按常用程度排为 1-16）。
- `agent.cordis.yml` 以官方 `standard` 预设为基线；16 个预设之间只有 persona 段与只读开关不同。

## 自定义

```bash
npm install
# 编辑 .github/presets.json（换 persona、改名称、加条目、置 readOnly）
npm run generate   # 重建全部预设目录
npm test           # 校验 + 只读强制
```

- **新增预设**：在 `presets.json` 加一条（id 必须匹配 `^[a-z0-9][a-z0-9-]*$`），跑 generate 即可。
- **硬性只读**：置 `"readOnly": true`，生成器会把 bash/pwsh 行改为 `disabled: true`；校验器强制该约定，防止"只读"退回口头承诺。
- persona 中的 `{{cwd}}` 由 DSH 在运行时注入，无需替换。

## 验证与 CI

每次 push / PR，GitHub Actions（`.github/workflows/validate.yml`）执行：

1. `npm test` — 结构校验（镜像 DSH 挂载规则）+ 只读强制 + 数据源一致性；
2. `npm run generate && git diff --exit-code` — 可复现门禁：仓库里的预设必须恰好等于数据源描述的内容。

## 兼容性与升级

- 基线版本：DSH `0.1.0-rc.6`。
- 升级 DSH 后，把新版官方 `standard` 组合拷贝为 `.github/baseline/agent.cordis.yml`，跑 `npm run generate` 即同步全部 16 个预设——不需要逐个手工 diff。

## 注意事项

- 修改预设后若 DSH 没有变化，请确认改的是 DSH 实际挂载的副本（`<DSH_HOME>/.agent-presets/`），而不是克隆目录——两者是独立的文件拷贝，没有自动同步。
- 🔒 预设禁用了 Shell；write/edit 等写文件工具的可见性由 DSH 的会话沙箱策略裁决，persona 约定默认不使用，需要写时请用户明确要求。

## License

[MIT](LICENSE) © [Linference](https://github.com/Linference)

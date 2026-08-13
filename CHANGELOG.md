# Changelog

本项目的所有重要变更都会记录在此文件中。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [v1.2.0] - 2026-08-13

### 修复（质量修复，重要）

- 🔒 只读预设工具层强制：`code-review` / `security-audit` / `code-explainer` 的 bash、pwsh 行改为 `disabled: true`，不再只是提示词承诺
- 16 段 persona 重写：去除模型品牌绑定（`{{model}}`）、诚实声明能力边界、OWASP 修正为 Top 10 2021

### 变更

- 单一数据源：`.github/presets.json` + `.github/baseline/agent.cordis.yml` + 生成器（`npm run generate`），消灭 16 份复制粘贴
- CI 可复现门禁：`generate && git diff --exit-code`，手改生成产物会被拦截
- 校验器新增：只读强制、数据源一致性、非只读预设 Shell 守卫

## [v1.1.0] - 2026-08-13

### 新增

- 8 个新预设（总计 16 个）：`code-debugger` 调试排障、`code-refactor` 安全重构、`test-writer` 测试编写、`data-analysis` 数据分析、`code-migration` 迁移升级、`api-designer` 接口设计、`documentation-writer` 文档撰写、`devops-engineer` 部署运维
- 全部预设加入 `order` 排序（1-16）

## [v1.0.0] - 2026-08-13

### 新增

- 首批 8 个角色化预设：`code-review`、`security-audit`、`architecture-design`、`requirements-analysis`、`task-planning`、`perf-optimization`、`code-explainer`、`data-review`
- MIT License、README（中文）、结构校验脚本与 GitHub Actions CI

[Keep a Changelog]: https://keepachangelog.com/zh-CN/1.1.0/
[v1.2.0]: https://github.com/Linference/dsh_agent_presets/releases/tag/v1.2.0
[v1.1.0]: https://github.com/Linference/dsh_agent_presets/releases/tag/v1.1.0
[v1.0.0]: https://github.com/Linference/dsh_agent_presets/releases/tag/v1.0.0

# Release / Production Status Policy

本项目同时存在历史版本、当前 accepted production、以及可能仅完成本地/source 验证的能力或未来 candidate。公开说明必须明确区分，不能因为代码已经存在就把未完成独立生产 gate 的能力写成“已上线”。

## 状态词

### Historical

只用于解释过去设计/验证，不代表当前功能、部署或安全状态。

### Local Candidate / Locally Validated

代码、测试或本地集成已经通过，但没有完成 reference production 的独立 release/deploy/production acceptance。当前 `v0.9.0-rc.1` 本身已经完成 Reference production acceptance；但其中的独立实例 bootstrap、signed federation、mirrors/peer pull、self-host/container 相关能力只有在最新 `PROJECT_CONTINUITY.md` 明确记录对应生产/公网证据时，才能升级为“已上线的多节点/容器能力”。

当前没有比 `v0.9.0-rc.1` 更高的新 Reference runtime candidate。未来 candidate 即使已经发布到 canonical `main` 或通过 source CI，也不能自动覆盖下面的 accepted production；package/source version 与生产接受状态始终独立验证。

### Accepted Production

已经按当前 release gate 部署到 Reference Instance，并有对应 production smoke/E2E/cleanup/QA 证据。当前 accepted production baseline 为：

`v0.9.0-rc.1`

该状态来自独立的 exact-head CI/public smoke、canonical browser smoke、手动 post-deploy E2E 与 exact QA cleanup/residual=0 证据。当前事实以 `PROJECT_CONTINUITY.md` 与 `qa/v0_8/verification.json` 最新接受段为准，而不是仅看 package version 或 README 文案。

### Stable source release

对外 GitHub tag/release 可以声明“stable source release”前，至少需要：

- 版本/变更记录明确；
- CI 和相关本地/集成验证通过；
- privacy/secret/license/governance readiness 检查通过；
- release artifact 不含 runtime secrets/private data；
- 如果声称 reference production 已含该版本：必须再完成 deploy + production smoke/acceptance；
- release note 明确哪些能力是 production、self-host/local-only、experimental/unverified。

## 版本不能证明什么

相同 package version 不自动证明：

- 当前 Git worktree 已部署；
- Docker/container build 已在所有环境通过；
- 中国大陆 SLA；
- 全球所有数据完整；
- federation 已成为公网自治网络；
- 某独立实例属于官方节点。

## 发布说明最低结构

每个公开 release note 至少包含：

1. `Status`：source stable / candidate / production accepted；
2. `Reference production`：是否部署、部署证据；
3. `Independent/self-host`：可用能力和未验证项；
4. `Privacy/security boundary`：是否改变数据收集/联邦/Secrets；
5. `Evidence semantics`：是否改变证据/情绪/排名；
6. `Known gaps`；
7. `Upgrade / rollback`。

## 发布权限

Routine reversible release preparation 可由项目 Agent 完成。真正涉及第三方账号发布、域名/生产切换、身份/支付/法律签署或不可逆操作时，仍按 `AGENTS.md` 要求升级给实际账号/权利人。

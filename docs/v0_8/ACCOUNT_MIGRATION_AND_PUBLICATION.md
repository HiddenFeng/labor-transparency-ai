# v0.8.1 GitHub / Vercel 公开身份迁移与非中国云部署决策

日期：2026-09-15

## 目标

当前公开项目使用独立的项目身份 `HiddenFeng`。先前用于公开项目的 GitHub 账号/仓库已退出公开发布链，因为其账号级状态和个人隐私边界不再适合作为本项目公共入口。当前公开仓库不能继承或再次暴露旧账号链接、旧作者元数据或旧公开提交链。

这次迁移不是简单修改 remote URL，而是重新建立**隐私净化的公开历史**：只发布可公开的前后端源码、测试、Agent 治理、部署脚本、文档与证据文件；旧历史只保留在项目目录之外的本地私有恢复备份中，不属于新公开仓库 refs。

## GitHub 当前目标

- 公开仓库：`https://github.com/HiddenFeng/labor-transparency-ai`。
- SSH remote：`git@github-hiddenfeng:HiddenFeng/labor-transparency-ai.git`。
- 公开主分支：`main`。
- Git 作者：`HiddenFeng <282881322+HiddenFeng@users.noreply.github.com>`。
- 新公开历史从隐私净化快照重新开始，不向新仓库推送旧公开历史、旧远端 refs 或旧作者身份。
- 前端、后端、Cloudflare Worker/D1、EdgeOne/Vercel 部署适配、多源公司研究、测试和 Agent 合同均属于可公开源码范围。

HiddenFeng 首次隐私净化 push 已完成全量验证：GitHub Actions run `34980498310` 的 Python 3.9、Python 3.13、`web_candidate`、`cloudflare_backend` 四个 job 全部成功。新仓库随后已将 Pages source 切到 GitHub Actions；Pages run `34980498497` 重新执行后 `configure-pages`、artifact upload 与 deploy 均成功。

## Release

`v0.8.1-deployment-rc2` 将在 HiddenFeng 仓库重新生成并发布。Release asset 必须由当前 HiddenFeng 工作树重新打包，且满足：

- ZIP manifest hash 0 mismatch；
- 不含 `.git`、`.venv`、`.wrangler`、`.vercel`、`.edgeone`、D1/SQLite、生产 secrets、私钥或 runtime 数据；
- 不含先前公开账号标识；
- 下载后的远端 asset SHA-256 与本地包一致。

## Vercel

生产前端控制权已经切换到 HiddenFeng 的 Vercel 账号。当前项目为 `workermanifestfellowship`，公开别名为 `https://workermanifestfellowship.vercel.app`；外部 Vercel Sandbox 已完成同源 `/api` → Cloudflare Worker → D1 的真实公司创建/评价/CSRF/HttpOnly Cookie E2E，测试数据随后从生产 D1 清零。项目域名 `workermanifestfellowship.dpdns.org` 已完成 Vercel 所有权 TXT、apex A 记录和 Vercel `Valid Configuration` 验证。当前运行环境直连 Vercel 网络仍超时，因此该域名不能据此被宣传为中国大陆稳定入口。

迁移验证至少包含：

以上五项均已完成并通过。

## EdgeOne / 中国大陆入口

EdgeOne 的历史项目、临时预览和同源 relay 测试继续保留为**历史工程证据**：它证明过一条 `EdgeOne -> Edge Function -> Cloudflare Worker -> D1` 路径在当时测试网络可工作。该证据不等于当前生产依赖，也不等于中国大陆稳定服务。

2026-09-15 的账号迁移后续明确采用新的隐私决策：**不要求账号持有人为了本项目向腾讯云/EdgeOne 提交实名、身份材料或支付方式。** 因此 Global 自定义域实名认证门槛和 Overseas 账户信息/支付方式门槛均被归类为 `OPTIONAL_PROVIDER_GATE_NOT_REQUIRED`，不再属于 release blocker、human gate 或 NEXT_GATE。

当前 canonical production path 为：

`HiddenFeng GitHub -> Vercel static frontend/custom domain -> same-origin /api rewrite -> Cloudflare Worker -> D1`

DigitalPlat 仅负责项目域名 DNS。若未来用户主动重新选择中国大陆本地加速或其他中国云服务，必须作为新的独立决策重新评估隐私、实名、ICP、支付和监管边界；不得把历史 EdgeOne 项目自动恢复成必需项。

## 隐私边界

- 不在公共仓库、网页或 API 中记录私人账号密码、OAuth token、平台 token、历史 EdgeOne preview token 或 DNS 登录凭据。
- 不要求普通访问者知道代码托管/部署平台账号持有人的邮箱或真实姓名。
- GitHub noreply 地址属于公开提交身份的一部分；本项目当前使用 HiddenFeng 的 noreply 地址，不再使用其他公开账号作者身份。
- 第三方平台和域名服务商依法仍可能掌握账号持有人真实信息；“公开隐私”不等于规避平台身份或监管要求。
- 不能声称互联网缓存中的历史信息已经被删除；本轮保证的是当前公开仓库、当前源码和当前项目部署不继续传播旧账号身份。

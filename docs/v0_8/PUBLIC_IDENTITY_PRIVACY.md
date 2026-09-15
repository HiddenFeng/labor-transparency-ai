# 公网开发者身份与部署隐私策略

目标不是对平台/监管机构隐藏真实责任主体，而是**不在普通访问者可见的网页、API、错误信息或静态包里无必要暴露个人开发者资料**。

## 当前处理

- UI 不展示开发者个人姓名、私人邮箱、家庭位置或本机路径。
- Git 提交作者使用 `Labor Transparency AI Agent`；当前 GitHub noreply 地址包含仓库账号 handle，但不是私人邮箱。
- 静态构建执行 `scripts/deployment/privacy_audit.mjs`，检查 `/Users/...`、真实回执格式、secret 赋值、私钥和现有 GitHub noreply 邮箱模式。
- Worker 的 5xx 错误统一为通用消息；不返回 JS 堆栈、本机路径或 Wrangler 内部错误。
- Cloudflare/Vercel/EdgeOne secret 只能放在各平台 secret/env 系统或本地被忽略的受限文件。
- `.dev.vars`、`.production.secrets`、`.wrangler/`、`.vercel/`、`.edgeone/`、静态 `dist/` 不进入 Git。
- 目前公网入口使用项目化别名 `labor-transparency-public.vercel.app` 与 `labor-transparency-api.labor-transparency-public.workers.dev`；普通访问者不需要看到平台账号邮箱、账号内部 ID 或个人命名的 deployment URL。
- 历史 EdgeOne anonymous preview 的 claim token、预览 token 和项目凭据只保留在被 Git 忽略的本地运行状态；anonymous project 已完成 claim，当前正式 EdgeOne 项目名为 `labor-transparency-public`。机器 QA 不记录预览 token 或账号内部凭据。
- GitHub 公开仓库已迁移到 `HiddenFeng/labor-transparency-ai`，采用新的隐私净化历史；旧 GitHub 账号/仓库历史不再属于公开仓库 refs。Vercel 当前项目团队也已更名为 `Labor Transparency AI / labor-transparency-ai`，当前生产部署 Git 元数据使用 HiddenFeng。

## 不能承诺的“匿名”

- GitHub 公共仓库 owner 本身是公开标识；除非以后迁到独立组织账号，否则无法让仓库看起来与该账号完全无关。
- 域名注册商、Cloudflare、Vercel/EdgeOne 和支付服务会知道账户持有人。
- 使用中国大陆节点需要 ICP/内容审核时，真实备案主体必须提供给相关服务商/监管方；不得伪造或规避。

## 推荐生产主体

如希望长期减少个人身份暴露：

1. 建立项目专用组织/非营利主体（如适用）；
2. 使用项目域名和项目邮箱；
3. 使用 Cloudflare/Vercel/EdgeOne Team/Organization 账号；
4. 域名使用合法可用的 WHOIS privacy；
5. 中国大陆备案使用真实项目/组织主体，而不是把个人信息写入前端页面；
6. 公开联系入口使用项目角色邮箱，不使用私人邮箱。

不需要为 v0.8 技术候选重写已经公开的 Git 历史；历史重写属于高影响操作，且不能消除第三方已缓存的提交身份。

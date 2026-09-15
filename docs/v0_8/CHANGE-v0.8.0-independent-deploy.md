# CHANGE v0.8.0 — 独立前后端托管

## CURRENT

v0.7.2 已有完整大众化 UI 和轻量业务 API，但原候选仍以 ChatGPT Sites 为迁移目标，生产持久化接口未固定到一个独立公开运行时。

## PROPOSED

生产形态改为：静态前端（Vercel / EdgeOne / 其他静态托管）+ Cloudflare Worker API + D1，完全不依赖 ChatGPT Sites。

## PRESERVE

证据等级、热度分离、纠错暂停、独立再分发复核、匿名辅导敏感信息边界、一次性回执、聚合日报以及公司自动研究“流程完整度 != 来源覆盖度”全部保持。

## IMPLEMENTED

- `cloudflare-backend/`：Worker、D1 adapter、migration、Cron scheduled handler。
- `deploy/frontend/`：静态构建、runtime API base、Vercel rewrite/security headers。
- `scripts/deployment/`：Cloudflare/Vercel/EdgeOne 部署脚本、隐私审计、本地 Worker/D1 与 split-host 验证。
- v0.8 共享领域版本升级；Node local server 保留为参考/回归运行时。
- Cloudflare D1 写租约与 4 并发会话回归。
- Vercel 同源 `/api` proxy 模式在本地反向代理和真实 Chrome 下验证。

## BOUNDARY

平台账号登录、域名所有权、ICP、Cloudflare China Network Enterprise/内容审核属于第三方身份/合规步骤，不能通过代码伪造。没有真实大陆节点/多地区探测之前，只能说跨境 best-effort。

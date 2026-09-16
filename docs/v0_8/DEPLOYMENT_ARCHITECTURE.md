# v0.8 独立部署架构 — Cloudflare API + D1 + 可替换静态前端

日期：2026-09-15

## 目标

v0.8 不依赖 ChatGPT Sites。业务前端和后端分别部署，通过稳定的 HTTP API 通信，同时保留 v0.7.2 已验证的证据、纠错、匿名辅导、Agent 日报与再分发边界。

推荐公网结构：

```text
普通访问者
   |
   | HTTPS
   v
www.example.org  ── 静态前端（Vercel / EdgeOne / 其他静态托管）
   |
   | 方案 A：同源 /api rewrite（Vercel 推荐）
   | 方案 B：fetch https://api.example.org + credentials（共享同一注册域名）
   v
api.example.org  ── Cloudflare Worker
   |
   +── D1：公司、社区票、贡献、复核、纠错、匿名辅导、私有建议、聚合日报
   |
   +── D1：companyResearch 受限候选队列（不自动发布为公司事实）
   |
   +── Cloudflare Queue：用户创建公司后立即投递；Queue Consumer 串行执行多源研究，失败重试/DLQ
   |
   +── Cron Trigger：每 5 分钟只补投遗漏/陈旧研究任务 + 每日匿名辅导/研究刷新兜底
```

代码对应：

- `cloudflare-backend/src/worker.mjs`：Worker HTTP / Queue consumer / scheduled 入口。
- `cloudflare-backend/src/d1-store.mjs`：D1 持久化适配层。
- `cloudflare-backend/src/company-research.mjs`：线上多源公司资料候选采集；只保存待复核候选。
- `cloudflare-backend/migrations/`：D1 schema。
- `sites-app/src/domain.mjs`：跨运行时共享的 canonical 领域/隐私规则。
- `sites-app/public/`：公共前端源。
- `deploy/frontend/build.mjs`：独立静态构建和 API 运行时注入。
- `deploy/edgeone/build.mjs`：EdgeOne 静态前端 + Edge Function 同源 API relay 构建。
- `deploy/edgeone/proxy-template.mjs`：缓冲 Cloudflare 上游响应并剥离 hop-by-hop / 编码 / 长度头，防止浏览器 chunked/encoding 不一致。

## 为什么选择 D1

当前数据是小型结构化工作流，不需要维护一台数据库服务器。D1 适合当前规模，并让 Worker 与持久层保持同一 Cloudflare 权限面。v0.8 不是把整个状态塞进一条数据库记录，而是按 collection / record 独立持久化，避免单行无限增长。

写操作通过 `ltp_write_lock` 租约做应用级串行化；单次状态变更再通过 D1 batch 写入。该设计优先保留原系统“一个领域动作要么整体落地、要么失败”的语义。

## 前端通信模式

### 模式 A — Vercel 同源 API rewrite（全球默认推荐）

浏览器只访问 `https://www.example.org/api/...`，Vercel 把 `/api/*` 代理到 Cloudflare Worker。优点：

- 浏览器只看到一个 origin；
- 匿名 HttpOnly Cookie 不依赖第三方 Cookie；
- 前端代码不需要公开真实 Worker URL；
- CORS 面更窄。

构建：

```sh
LTP_PROXY_API_ORIGIN=https://api.example.org \
LTP_DEPLOYMENT_LABEL=vercel-same-origin-proxy \
node deploy/frontend/build.mjs
```

`dist/vercel.json` 会自动生成 rewrite 与安全响应头。

平台是否完整转发 `Set-Cookie` / `Origin` 仍必须在真实 Vercel preview 上复验；本地只证明前端与独立 Worker API 的跨进程通信成立。

该复验现在已经完成：生产 `https://workermanifestfellowship.vercel.app` 通过外部 Vercel Sandbox 实际得到首页、favicon 与 `/api/health` 200，并完成过公司创建、CSRF/HttpOnly 会话、research Agent、多源候选和 D1 清理。

### 模式 B — 直接调用 API 子域

适合 `www.example.org` + `api.example.org` 这种共享注册域名的配置。浏览器使用 `credentials: include`，后端只允许 `LTP_ALLOWED_ORIGINS` 中精确列出的前端 origin。

生产 Cookie 默认：`HttpOnly; Secure; SameSite=Strict`。因此不推荐用 `*.vercel.app` 直接请求 `*.workers.dev` 作为长期身份模式；二者跨站，浏览器 Cookie 行为并不稳定。使用自定义同站域名或同源代理。

### 模式 C — EdgeOne 同源 Edge Function relay（历史 PoC / 当前非生产依赖）

在当前大陆网络，`vercel.app` / `workers.dev` 直连失败，而 EdgeOne 可达。因此 v0.8.1 增加：

```text
EdgeOne static frontend
  -> /api/* Edge Function
  -> HTTPS Cloudflare Worker
  -> D1
```

构建：

```sh
LTP_EDGEONE_UPSTREAM=https://api.example.org \
LTP_DEPLOYMENT_LABEL=edgeone-production \
node deploy/edgeone/build.mjs
node deploy/edgeone/test-proxy.mjs
```

Edge Function 对非 GET/HEAD body 限制为 96 KiB；向上游发请求时不透传 `Host` / `Content-Length` / `Connection`，向浏览器返回时先完整缓冲 upstream body，并移除 `Content-Length / Transfer-Encoding / Content-Encoding / Connection / Keep-Alive`，再由 EdgeOne 重新编码响应。这样可以避免早期实测出现的 `ERR_INCOMPLETE_CHUNKED_ENCODING`。

历史匿名 preview 曾从测试网络跑通首页、API、mutation 和 Chrome；该结果只保留为架构证据。当前生产路径不再要求正式 EdgeOne 项目、自定义域、实名认证或支付信息。

## 安全边界

- 所有 mutation（除受限 advisory Agent bearer endpoint）要求：精确 Origin allowlist + CSRF token。
- CORS 只回显 allowlist 中的精确 origin，并启用 credentials。
- evidence review、redistribution review、advisory Agent 使用三套独立 server-side secret。
- company-research Agent 使用第四套独立 `LTP_RESEARCH_AGENT_TOKEN`；不能复用 advisory/review/export token。
- 5xx 不向客户端返回堆栈或内部错误详情。
- Worker 不记录匿名辅导正文；scheduled log 只记录聚合数字。
- 匿名回执明文只返回一次；D1 只保存 SHA-256 hash。
- 用户新建真实公司后会原子写入 `companyResearch: QUEUED` 并立即投递 `COMPANY_RESEARCH_QUEUE`；Queue Consumer 以单消息/单并发执行多源采集，重复投递在生命周期层幂等 ACK。5 分钟与每日 Cron 只补投遗漏/到期刷新任务。普通公司列表只返回安全研究投影（生命周期、来源状态、官方来源链接、最多 3 条字段裁剪候选预览），不返回 raw records、案件正文或后台复核材料。
- 当前依旧不接收真实姓名、私人联系方式、身份证明、详细家庭地址、健康/支付信息和敏感附件。

## 版本与回滚

- Worker 与公共前端 v0.8 使用独立 tag / release candidate。
- D1 migration 只能向前执行；部署前保留 migration 名单和数据库备份策略。
- 前端是纯静态产物，可直接回滚上一部署版本。
- Worker 使用 Cloudflare Versions/Deployments 回滚代码；回滚代码时必须确认其理解当前 D1 schema。

## 当前验证状态

本地已用真实 `wrangler dev` + 本地 D1 migration 验证：

- CORS / preflight；
- CSRF 拒绝；
- 公司、社区票、劳动线索；
- E3 复核、独立再分发、纠错暂停；
- 匿名辅导、受限 Agent、私有建议与聚合日报；
- scheduled handler；
- multi-source company research 的 restricted Agent API、D1 候选持久化和重启恢复；
- Wrangler 进程停止/重启后的 D1 持久化；
- 独立静态前端 `8791` → Worker `8790` 的真实 Chrome 交互。

Cloudflare Worker + D1 与 Vercel 全球前端现已公网生产部署。历史 EdgeOne 项目和临时 preview 的大陆动态链保留为已验证工程实验，但已从 canonical production path 移除。当前不把 EdgeOne 自定义域、实名、支付资料或大陆入口作为 release gate；中国大陆稳定访问保持未声明状态。原 EdgeOne 路线若未来重新启用，必须作为新的隐私/合规决策重新评估，并重新完成相应 DNS、ICP/服务商资格与真实网络验收。

# v0.8 部署运行手册

## 1. 本地验证

```sh
./scripts/deployment/verify_cloudflare_local.sh
./scripts/deployment/verify_cloudflare_research_live.sh
npm --prefix sites-app test
LTP_PUBLIC_API_BASE=http://127.0.0.1:8790 node deploy/frontend/build.mjs
node scripts/deployment/privacy_audit.mjs deploy/frontend/dist
LTP_EDGEONE_UPSTREAM=https://api.example.org node deploy/edgeone/build.mjs
node deploy/edgeone/test-proxy.mjs
node scripts/deployment/privacy_audit.mjs deploy/edgeone/dist
```

## 2. Cloudflare 生产后端

首次：

```sh
npx wrangler login
cp cloudflare-backend/wrangler.production.example.jsonc cloudflare-backend/wrangler.production.jsonc
./scripts/deployment/bootstrap_cloudflare.sh
./scripts/deployment/init_production_secrets.sh
```

部署：

```sh
export LTP_FRONTEND_ORIGINS='https://www.example.org'
# 每次自动研究 tick 最多处理的公司数；默认 2。新公司由 */5 Cron 优先消费，日更任务做刷新兜底
export LTP_RESEARCH_MAX_COMPANIES_PER_RUN=2
# 可选：直接绑定 Worker custom domain
export LTP_API_DOMAIN='api.example.org'
./scripts/deployment/deploy_cloudflare.sh
```

不要把 `.production.secrets` 提交到 Git。

## 3. Vercel 前端（推荐全球默认：同源 /api proxy）

```sh
vercel login
export LTP_PROXY_API_ORIGIN='https://api.example.org'
./scripts/deployment/deploy_frontend_vercel.sh
```

首个 Vercel 部署完成后，把真实前端 origin 加入 Cloudflare `LTP_ALLOWED_ORIGINS` 再重新部署后端。如果使用 preview URL，也必须精确加入测试 origin，不能用 `*`。

## 4. EdgeOne 历史/可选实验（非当前生产依赖）

```sh
export LTP_EDGEONE_UPSTREAM='https://labor-transparency-api.example.workers.dev'
export LTP_EDGEONE_PROJECT_NAME='labor-transparency-public'
export LTP_EDGEONE_AREA='global'
./scripts/deployment/deploy_edgeone.sh
```

`deploy_edgeone.sh` 会：

1. 从 `sites-app/public` 生成 EdgeOne 静态包；
2. 注入 same-origin runtime config；
3. 生成 `/edge-functions/api/[[default]].js`；
4. 将 `/api/*` 以缓冲模式转发到 Cloudflare Worker；
5. 执行静态 privacy audit；
6. 再调用 EdgeOne Makers deploy。

如仅做一次匿名 PoC：

```sh
export LTP_EDGEONE_ANONYMOUS=true
export LTP_EDGEONE_SITE=global
./scripts/deployment/deploy_edgeone.sh
```

历史 anonymous preview 有时效，只能作为网络/架构证据，不得作为稳定公开 URL。历史账号项目与默认 `edgeone.cool` 域名的 401/preview 限制继续记录，但当前生产路线不再要求继续绑定 EdgeOne 自定义域或满足其账号门槛。

历史实测：匿名 EdgeOne preview 曾完成首页 200、API 200、真实公司创建/评价 mutation，以及 Chrome 0 console/network/page errors；机器证据继续保留。根据当前隐私决策，不再要求完成腾讯云账户、实名、支付方式、自定义域或最终 EdgeOne 验收。

## 5. 发布前公网验收

必须实际验证：

- `/api/health` 200；
- 前端加载 0 console/network/page errors；
- Cookie 为 HttpOnly/Secure；
- 允许 Origin 的 CORS 正常；错误 Origin / 缺 CSRF mutation 为 403；
- 匿名辅导提交 -> Agent -> 私有建议 -> 聚合日报；
- `/api/research/status` 仅公开 queued/collecting/failed/completed 等聚合状态；`/api/research-agent/*` 必须使用独立 research token；
- 用户新建真实公司后必须立即看到 `QUEUED`，无需后台人工 enqueue；`*/5` Cron 自动消费队列；
- 自动公司研究产生候选后，普通公司 API 只能返回字段白名单的来源状态/官方链接/候选预览，不得泄露 raw candidate records、案件正文或研究 token；
- Cron 公司研究出现单一来源 403/429/网络错误时应保留其他来源结果并显式记录来源错误，不能把任务整体伪装成完整成功；
- D1 重启/新 Worker 版本后数据仍在；
- 管理 token 不出现在前端包或网络响应；
- 真实 production 静态包通过 privacy audit；
- 中国大陆只有经过多地区实际探测后才报告可达性，不以“域名能解析”替代真实访问测试。

外部可达性由 `.github/workflows/public-smoke.yml` 独立验证。该 workflow 可手动运行，并每日从 GitHub-hosted runner 做**语义级**检查，而不是只看 HTTP 200：项目自有域名与 Vercel 回退必须返回劳动透明计划页面及安全响应头；两条同源 `/api` 路径和 Worker 直连必须返回 `cloudflare-d1` health/config 契约；Session Cookie 必须保持 `HttpOnly; Secure; SameSite=Strict`；项目域名和 Vercel origin 必须被 Worker 精确允许，未知 origin 与已经退出生产链的 EdgeOne origin 必须返回 403；GitHub Pages 继续验证为只读回退。它的 PASS 只证明所测外部网络上的全球公网路径及这些安全/语义契约成立，不等于中国大陆 SLA。

## 6. 当前已上线地址与仍需人工步骤

- 主公开交互域名：`https://workermanifestfellowship.dpdns.org`
- Vercel 平台回退：`https://workermanifestfellowship.vercel.app`
- 全球 API/诊断 origin：`https://labor-transparency-api.labor-transparency-public.workers.dev`
- GitHub Pages 只读回退：`https://hiddenfeng.github.io/labor-transparency-ai/`
- EdgeOne：历史项目/PoC 证据保留，但不属于当前 production dependency 或 release gate。

Cloudflare、Vercel 与 DigitalPlat 已构成当前完整生产路径。项目域名 `workermanifestfellowship.dpdns.org` 已由 DigitalPlat 配置并通过 Vercel 验证。腾讯云/EdgeOne 的实名认证、账户补全和支付方式不再是人工待办；不得为了当前发布要求账号持有人提交这些资料。

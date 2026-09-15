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
# 每次 Cron 最多刷新的公司数；默认 2，先小规模运行再按容量调大
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

## 4. EdgeOne 大陆入口候选（同源 Edge Function relay）

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

匿名 preview 有时效，只能作为网络/架构证据，不得作为稳定公开 URL。EdgeOne 账号注册/登录与 project claim 已完成，账号下正式项目 `labor-transparency-public` 已部署。当前正式项目默认域名 `labor-transparency-public.edgeone.cool` 在大陆无平台预览授权时返回 401，因此中国大陆/全球含大陆的稳定入口仍需绑定项目拥有的自定义域名，并按实际地域满足 DNS、ICP、域名与服务商资格要求。

当前实测：匿名 EdgeOne preview 已从当前大陆网络完成首页 200、API 200、真实公司创建/评价 mutation，以及 Chrome 0 console/network/page errors；正式账号项目部署也已成功。机器证据见 `qa/v0_8/edgeone-mainland-preview-v081.json`、`qa/v0_8/public-deployment-v081.json` 与 `qa/v0_8/account-migration-v081.json`。

## 5. 发布前公网验收

必须实际验证：

- `/api/health` 200；
- 前端加载 0 console/network/page errors；
- Cookie 为 HttpOnly/Secure；
- 允许 Origin 的 CORS 正常；错误 Origin / 缺 CSRF mutation 为 403；
- 匿名辅导提交 -> Agent -> 私有建议 -> 聚合日报；
- `/api/research/status` 仅公开聚合状态；`/api/research-agent/*` 必须使用独立 research token；
- 自动公司研究产生候选后，普通公司 API 不得泄露 raw candidate、案件详情或研究 token；
- Cron 公司研究出现单一来源 403/429/网络错误时应保留其他来源结果并显式记录来源错误，不能把任务整体伪装成完整成功；
- D1 重启/新 Worker 版本后数据仍在；
- 管理 token 不出现在前端包或网络响应；
- 真实 production 静态包通过 privacy audit；
- 中国大陆只有经过多地区实际探测后才报告可达性，不以“域名能解析”替代真实访问测试。

## 6. 当前已上线地址与仍需人工步骤

- 全球前端：`https://workermanifestfellowship.vercel.app`
- 全球 API：`https://labor-transparency-api.labor-transparency-public.workers.dev`
- EdgeOne 正式账号项目：`labor-transparency-public` 已部署；默认 `edgeone.cool` 域名不作为大陆稳定入口，因为大陆无预览授权时返回 401。

Cloudflare、Vercel、EdgeOne 登录与部署均已完成，项目域名 `workermanifestfellowship.dpdns.org` 也已由 DigitalPlat 配置并通过 Vercel 验证。EdgeOne Global 项目添加自定义域要求账号实名认证；Overseas 项目已经部署并接受该域名，ownership TXT 也已生效，但最终 Verify 被腾讯云国际站“账户信息不完整”门槛拦截，要求账号持有人补全账户信息并添加支付方式。完成该账户步骤后，Agent 可继续 EdgeOne ownership、最终 CNAME/DNS、HTTPS/exact Origin 和无 preview token 验收；若最终选择包含中国大陆的加速区域，还必须满足平台实际要求的实名、ICP/服务商资格。

# 中国大陆可访问方案与不能跳过的前置条件

## 结论先行

**无 ICP / 无正式中国大陆域名与服务商资格时，不能诚实承诺“中国大陆稳定可访问”。** 当前项目进一步明确：不以提交中国云实名、身份材料或支付方式作为换取大陆加速的默认方案。 本轮已经把这一点从纸面判断推进到真实网络测试：当前大陆网络可访问 EdgeOne 网络，但直接访问 `vercel.app` / `workers.dev` 失败或超时；账号迁移前的阶段性 GitHub Pages 镜像已经退出当前公开入口。

Vercel 官方明确说明其没有中国大陆基础设施，`.vercel.app` 可能慢或不可访问，自定义域也不能形成可用性保证。因此 Vercel 适合作为全球前端，但不是“中国大陆保障”的唯一方案。

Cloudflare China Network 可以把选定服务运行到中国大陆 JD Cloud 节点，但它是 Enterprise 的独立订阅，域名必须有有效 ICP，且需要内容审核。官方 2026 文档列出的 China Network Developer Services 包含 Workers，但 D1 没有被列入可用产品清单；因此 **Worker + D1 是否能完整以内地路径运行必须通过 Cloudflare China Network PoC 实测，当前不得假设。**

## 本轮已经验证出的真实路径

Cloudflare Worker + D1 和 Vercel 全球前端已经公网部署；随后使用 EdgeOne anonymous direct-upload + Edge Function 同源代理做了一个**临时大陆路径 PoC**：

```text
当前大陆网络
  -> EdgeOne preview
  -> Edge Function /api/* buffered proxy
  -> Cloudflare Worker
  -> Cloudflare D1
```

该路径实际通过首页、`/api/health`、CSRF 会话、公司创建、社区评价和 Chrome 页面加载；最终浏览器 `console/network/page errors` 均为 0。早期 Edge Function 直接流式透传上游 body 曾产生 `ERR_INCOMPLETE_CHUNKED_ENCODING`，现已改为缓冲响应并删除 hop-by-hop / 编码 / 长度头后通过。

匿名 EdgeOne preview 有时间限制，因此它只证明**架构与当前网络可行**，不应被当成永久生产 URL。EdgeOne 正式账号、project claim 和账号下 `labor-transparency-public` 项目部署现在均已完成；当前真正剩余的是项目自定义域名/DNS，以及选择大陆或全球含大陆加速时适用的 ICP/服务商资格。默认 `edgeone.cool` 项目域名在大陆无 preview 授权时返回 401，因此也不应被当成最终无令牌大陆入口。

## 三档部署

### A. 已完成：全球生产 + 大陆 best-effort

- 全球前端：Vercel production 已上线。
- 全球 API：Cloudflare Global Worker + D1 已上线。
- 当前大陆网络直连这两个平台域名不可靠，因此仍不宣传“大陆稳定访问”。
- 账号迁移后不再依赖旧 GitHub Pages 阶段镜像；EdgeOne 临时预览已证明可作为大陆入口层，正式账号项目也已部署。

成本最低，可立即上线。

### B. 中国大陆前端加速（当前不启用）

- 历史 EdgeOne claim/项目/PoC 只作为工程证据保留。
- 当前不继续 EdgeOne 自定义域、实名、支付方式或 Mainland-inclusive acceleration 配置。
- 若未来用户主动重新开启大陆本地加速，再独立评估 ICP、实名、服务商、数据与支付隐私边界，并重新做正式域名/SLA 实测。

### C. 完整大陆稳定链路

目标：

```text
大陆用户 -> 大陆前端节点 -> 大陆/优化动态 API 路径 -> 持久数据库
```

可选路线：

1. Cloudflare Enterprise + China Network + Global Acceleration + ICP；
2. 先验证 Workers 在 China Network 的目标 Zone 行为；
3. 对 D1 binding 做 PoC。若 D1 在目标中国网络路径不可用或延迟/合规不满足，就使用 `D1StateStore` 同层级的新数据库 adapter，不改领域规则。

Cloudflare 官方称 China Network 的 Global Acceleration 可改善动态 API 响应进出中国的连接，适合动态内容；但在完成 Enterprise / ICP / PoC 前不能把这一点写成本站已具备的能力。

## ICP 与“开发者隐私”

如果选择中国大陆节点：

- ICP/内容审核会要求真实主体信息；
- 网站通常还需要展示 ICP 编号；
- 不能同时要求“对监管/服务商完全匿名”和“使用中国大陆合规节点”。

如果目标是**不向普通公众暴露个人开发者信息**，最稳妥的是使用独立项目/组织主体、项目邮箱和组织账号进行域名/托管/备案，而不是伪造身份或试图规避备案。

## 官方依据（2026-09-15 检查）

- Cloudflare China Network Overview: https://developers.cloudflare.com/china-network/
- Cloudflare China Network available products: https://developers.cloudflare.com/china-network/reference/available-products/
- Cloudflare China Network get started / ICP: https://developers.cloudflare.com/china-network/get-started/
- Cloudflare Global Acceleration: https://developers.cloudflare.com/china-network/concepts/global-acceleration/
- EdgeOne Pages deployment / custom domain / acceleration regions: https://edgeone.cloud.tencent.com/pages/document/162936836982489088
- EdgeOne CLI: https://edgeone.cloud.tencent.com/pages/document/162936923278893056
- Vercel China availability guidance: use Vercel's current official China accessibility/support documentation before launch; do not treat Vercel as a mainland SLA.

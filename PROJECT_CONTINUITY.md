# Labor Transparency / 劳动透明计划 — PROJECT_CONTINUITY

Status: `CURRENT_CANONICAL_CONTINUITY`
Continuity schema: `LTP-CONTINUITY-1`
Accepted product runtime at this continuity update: `0.8.8-rc.1`
Canonical production: `https://workermanifestfellowship.dpdns.org`
Repository: `https://github.com/HiddenFeng/labor-transparency-ai`

> 本文件是项目唯一的**当前接管/连续性摘要**。它回答“项目为什么存在、现在真实到了哪里、为什么变成现在这样、哪些东西绝不能被改坏、下一步如何选择、交接时必须更新什么”。
>
> 它不是测试结果的替代品，也不是历史白皮书的替代品。任何易变事实（Git HEAD、部署版本、生产状态、任务状态、当天运营结果）必须在接管时重新验证。旧版 README 段落、历史白皮书、`archive/`、旧 change record、旧 QA 区块和旧 handoff 只能解释历史，不能覆盖本文件指向的当前证据。

## 0. 冷启动结论

项目根目的没有改变：建设一个**非商业公益、保护劳动者、证据范围可解释、可持续运行**的劳动透明与互助平台，减少劳动信息不对称，让普通人能够：

1. **查公司**：看到社区声音、来源明确的企业/产品/关系/事件信息，以及当前未知和资料缺口；
2. **看经历 / 参与讨论**：无附件也可进行 E0 讨论、正负评价和贡献，热度与证据强度严格分离；
3. **找帮助**：使用当前已上线的匿名、非敏感辅导能力和地区权益资源，理解下一步，但平台不冒充法院、监管机构、律师、工会或正式申诉代理。

最终目标不是“抓取最多数据”或“给公司打一个好坏分”，而是让劳动者得到**可理解、可追溯、不会把猜测冒充事实、不会为了自动化牺牲隐私的实用信息和行动入口**。

当前已接受的产品基线是 `v0.8.8-rc.1`。它已经是**审计过的核心流程可用生产基线**，而不是“全球全部企业数据完成”或“中国大陆稳定访问 SLA 完成”。目前没有必须由用户立即决策的生产阻塞项。

## 1. 权威顺序：发生冲突时按这个顺序判断

1. 当前用户在本次对话中的明确要求；
2. 根目录 `AGENTS.md`；
3. 本文件 `PROJECT_CONTINUITY.md`；
4. 当前接受证据：`qa/v0_8/verification.json` 中最新接受段、当前 release/change record、当前 Git/代码/测试/真实运行证据；
5. 当前专题规范：`docs/v0_8/` 下部署、公司研究、来源注册、日常运营等文档；
6. 当前实现与测试；
7. 当天/当前任务的工作记录；
8. 历史 change record、白皮书、archive、旧 QA、旧 handoff；
9. 对话记忆或 Agent 自己的回忆。

禁止用较低层级的旧文档推翻较高层级的当前事实。尤其注意：

- 本机若存在 `HANDOFF_MANIFEST.json`，它只允许作为**指针**；旧 v0.6 完整性清单可保留在本机 `archive/HANDOFF_MANIFEST_v0_6_integrity.json`。二者都不是版本化的当前状态来源；新 clone 没有这些本机文件也不影响接管。
- `docs/完整白皮书_v0.3_含历史基线.md` 保存项目最初目标和需求演化，但其中“尚未上线/尚未实现”等阶段性句子是历史事实。
- `qa/v0_8/verification.json` 是累积证据账本，前部可包含旧候选状态；当前结论以其中最新接受段、`next_gate`、`strongest_claim` 和当前 Git/runtime 复核为准。

## 2. 用户真实意图与不可漂移的项目身份

### 2.1 根本目的

- 为劳动者降低“找公司信息、表达经历、判断资料强弱、找到求助路径”的门槛；
- 允许好评、差评、疑问、亲历、转述和公共资料共同存在，但不把它们混成一个结论；
- 公司资料可以逐步补充，资料缺失不能阻断已经开放的讨论或帮助能力；
- 公开企业关系必须说明来源、时间、关系类型和支持范围；
- 缺失信息显示“未知/本轮未找到”，不能填零、猜测或暗示不存在；
- 平台由 AI 制作、由 Agent 日常维护，但 AI 没有司法、监管、法律代理或机构授权身份。

### 2.2 商业与治理边界

项目使用 `LTP Public-Interest Source-Available License 1.0`：源码公开但**不是 OSI 开源许可证**。核心能力必须保持非商业公益，不出售排名、不付费删帖、不出售劳动者身份/私密材料、不做企业洗白、黑名单、报复、定向监控或商业模型训练用途。数据另受 `LICENSE-DATA.md` 约束。

### 2.3 绝对不能被“优化掉”的能力

- E0 低证据讨论可正常发布/传播；证据等级限制平台结论强度，不默认限制流量；
- 社区热度、参与者正负态度、证据状态、正式程序/认定是四个独立维度；
- 不生成没有校准依据的“真实性分”“企业道德总分”；
- 公司/产品/具体劳动实践的证据范围分别处理；
- 社区贡献、官方来源引用、官方关系、官方事件、自动研究候选/信号/机器参考事实分别存储与展示；
- 没有足够证据时失败关闭，而不是等待某个命名人工 reviewer 才让生产可用；
- 用户自己的纠错、撤回、申诉路径和隐私边界不能因自动化而消失；
- 私密/敏感信息不得进入公开仓库、公告、公开数据或普通公司 API。

## 3. 需求与架构为什么一步步变成现在这样

下面是**需求变化的原因链**，不是简单版本号列表。新 Agent 必须理解“为什么改”，避免退回已经被事实否定的旧方案。

### Phase A — v0.1：使命与约束基线

最初确定“以企业为索引的劳动透明与互助平台”：公司页、讨论/评价/投票、劳动条件、企业关系、求助材料与纠错。核心原则是公益、低证据正常表达、公私分域、关系不等于责任、程序记录不等于违法认定。

### Phase B — v0.2/v0.3：从“大而全再开放”改为需求驱动最小闭环

用户不希望等到全平台所有功能和全国企业资料完成才出现公共入口，因此建设顺序改为：公开计划/白皮书 → 公司/功能需求登记 → 公司空间立即可用 → 异步补资料 → 再逐步开放更多能力。v0.3 又明确“功能可提前实现和验证，但按风险分阶段开放”。

根本原因：**公司资料永远不可能一次查全；等待资料完整会让最有价值的讨论和求助永远被阻塞。**

### Phase C — v0.4：社区共建 + 公益数据再分发

加入公司/产品展示、正负社区评价、证据支持劳动实践、贡献与独立再分发审核。明确“公开显示”不等于“允许 GitHub 再分发”，E0 也可在授权/隐私审核通过后进入公益数据，但仍标未核实。

### Phase D — v0.5：真实公开资料研究必须可恢复、可核对

把“用户提交研究包就能批准”的危险路径改为来源适配器 → 持久任务 → 主体核对 → 冻结草稿 → 范围/来源复核 → 可恢复发布。根本原因：**模型或用户自己标 APPROVED 不能成为事实发布凭证。**

### Phase E — v0.6：从功能原型走向可运行、安全、可恢复

补齐调度、备份恢复、生产配置失败关闭、Host/HTTPS/Origin/CSRF/限流、安全 Cookie、附件扫描门、Caddy/launchd/ClamAV 等真实运行证据，并建立 Git/GitHub/只读公开基线。随后根据用户“非必要性就不做”要求，停止为假想未来继续堆基础设施，转向真实需求驱动。

### Phase F — v0.7：面向普通劳动者，而不是面向开发者

v0.7.1 新增匿名辅导，但严格限定为非敏感结构化内容 + 一次性回执 + 私有建议 + 聚合日报；没有真实姓名、私人联系方式、证件、健康/支付、敏感附件，也不自动向外部机构提交。v0.7.2 把工程候选 UI 改成普通劳动者能理解的“遇到什么 / 先记录什么 / 下一步怎么办”，并加入外部权益资源。

根本原因：**技术链路可运行不等于用户能使用。**

### Phase G — v0.8.0：摆脱 ChatGPT Sites 作为生产依赖

改为静态前端 + Cloudflare Worker + D1；生产主链可独立运行。证据、纠错、匿名辅导、再分发等业务语义保持不变。

### Phase H — v0.8.1：部署隐私 + 新公司即时自动研究

用户明确不接受为了中国云加速向腾讯云/EdgeOne 提交实名、身份或支付信息，所以 canonical production 固定为 GitHub + Vercel + Cloudflare Worker/D1 + 项目 DNS；EdgeOne 只保留历史 PoC，中国大陆稳定 SLA 不声明。

同时用户要求“新建公司后自动研究并显示”。生产实践证明 Cron-only 太慢且不透明，因此改为：

`POST company -> D1 QUEUED -> Cloudflare Queue -> 单并发 Consumer -> 来源结果 -> 安全公共投影`

Cron 只负责漏单/陈旧/失败/刷新重投，不再是用户触发研究的主执行器。

### Phase I — v0.8.2：取消命名人工 reviewer 的生产可用性依赖

用户要求系统无人值守。原流程采集后停在 `REVIEW_REQUIRED*`，与这个目标冲突。因此加入确定性自治信任层：严格条件满足才生成窄范围机器参考事实；程序性/劳动来源生成有 caveat 的 `SOURCE_SIGNAL`；歧义/冲突降级为候选/未知。刷新会撤回失去当前来源支持的机器输出。

根本原因：**自动化不是“让模型猜”，而是“任何不确定性都能自动失败关闭”。**

### Phase J — v0.8.3：从“队列跑完”升级到“公司资料真的可读”

技术链已通，但用户看到的是 provider/debug 细节，非美国公司还会错误运行美国来源。于是新增完整公司 dossier、地区适配 `NOT_APPLICABLE`、多语言开放知识上下文、事件时间线、明确 gaps/freshness/provenance。

根本原因：**发布门从 transport success 改成 user comprehension。**

### Phase K — v0.8.4：降低社区贡献门槛 + 建立每天无人值守维护

普通用户不应理解 evidence taxonomy、再分发授权内部字段，所以贡献页压缩为“选公司 → 选信息类型 → 写一句有用内容”，高级信息折叠。官方关系与社区关系保持独立。

同时建立北京时间 18:00 日常运营 Agent + 19:00 独立复核/续做 Agent。两次运行之间不轮询“Agent 是否还在工作”，19:00 只读取数据库/项目/测试/来源实际证据。

### Phase L — v0.8.5：China-first 调查必须来源化、不能变黑名单

中国企业页加入 `chinaInvestigation`：身份、上市/披露、产品/品牌、召回、证券监管、采购、劳动社区证据和 gaps 的**证据索引**，不是评分。

NMPA UDI、SAMR recall、CSRC penalty 按来源语义和严格主体绑定进入独立 official lanes。GSXT、CNIPA、政府采购 CAPTCHA/登录/反自动化路径保留为明确 gap，不绕过。

### Phase M — v0.8.6/v0.8.7：中国上市披露做严格主体绑定

加入 SSE、SZSE。缩写和候选证券代码只用于发现；只有官方全名严格匹配才形成 `OFFICIAL_SOURCE_REFERENCE`。真实生产公司 `星宇股份有限公司` 与 SSE 官方 `常州星宇车灯股份有限公司` 不完全一致，因此系统正确保持不绑定。

根本原因：**宁愿显示未知，也不能因为“看起来像同一家公司”就改写主体。**

### Phase N — v0.8.8：停止追版本号，回到真实可用性

v0.8.7 后不再机械增加来源，而是以普通劳动者身份走生产核心流程。发现并修复两个真实问题：

1. production auto-research E2E 会被 source push 提前触发，在新 runtime 部署前对旧生产版本运行，产生假失败；现已改成部署后手动 `workflow_dispatch`；
2. China-first 产品没有中国大陆官方帮助资源；现已加入 12333、劳动关系服务、12348、全国根治欠薪线索反映平台，并明确敏感身份/联系方式只能提交到对应正式外部服务，不能复制进本站匿名辅导/公开贡献。

当前原则因此明确：**没有具体用户痛点、生产故障或验证过的覆盖缺口，就不要为了“继续推进”制造新框架、新 collector、新版本或低价值文档。**

## 4. 当前真实系统架构

```text
普通访问者
  -> https://workermanifestfellowship.dpdns.org
  -> Vercel 静态前端
  -> 同源 /api/* rewrite
  -> Cloudflare Worker
  -> D1

新建真实公司
  -> 同一 D1 事务写 Company + companyResearch: QUEUED
  -> Cloudflare Queue
  -> Consumer(batch=1, concurrency=1)
  -> 多来源串行研究
  -> deterministic autonomous trust policy
  -> AUTO_READY / AUTO_READY_WITH_SOURCE_GAPS
  -> 公共 safe projection / company dossier

Queue 失败
  -> bounded retry
  -> DLQ consumer 持久化失败
  -> 5 分钟/每日 Cron 按退避重投

每日社区运营
  -> 18:00 Asia/Shanghai bounded operations
  -> durable history + trusted API / bounded D1 fallback
  -> 19:00 independent evidence review / continuation
```

关键实现：

- `cloudflare-backend/src/worker.mjs`：HTTP、Queue、scheduled；
- `cloudflare-backend/src/d1-store.mjs`：D1；
- `cloudflare-backend/src/company-research.mjs`：生产多来源采集/生命周期；
- `sites-app/src/autonomous-intelligence.mjs`：确定性自治信任规则；
- `sites-app/src/domain.mjs`：共享业务/隐私规则；
- `sites-app/public/`：当前公共前端；
- `docs/v0_8/source-registry.json`：来源机器注册表；
- `scripts/community_agent/`：官方 source-specific 日常 collector；
- `docs/v0_8/DAILY_AGENT_OPERATIONS.md`：18/19 点运行契约。

## 5. 证据层与数据语义：严禁合并

| 层 | 能说明什么 | 不能说明什么 |
| --- | --- | --- |
| `MACHINE_VERIFIED_REFERENCE` | 严格确定性规则支持的窄范围参考字段 | 公司整体好坏、违法、完整身份关系 |
| `OPEN_KNOWLEDGE_CONTEXT` | 经过规则绑定的开放知识上下文 | 工商法定身份、法律认定 |
| `SOURCE_SIGNAL` | 某来源存在同名/精确范围的程序性记录 | 违法、责任、全公司劳动条件 |
| `SOURCE_EVENT_CANDIDATE` | allowlisted 公共事件时间线 | 最终责任、公司整体结论 |
| `CONTEXT_CANDIDATE` | 可能有用但未绑定的候选 | 事实 |
| `OFFICIAL_SOURCE_REFERENCE` | 特定官方登记/披露参考 | 自动升级 machine legal identity |
| `OFFICIAL_SOURCE_RELATION` | 特定官方记录支持特定关系 | 完整产品/客户/供应链 |
| `OFFICIAL_SOURCE_EVENT` | 特定官方监管/召回等事件 | 公司总评分、其他期间/地点行为 |
| Community E0+ | 用户/社区的观点、经历、线索、贡献 | 官方事实或总体员工意见 |

`0 match` 只等于“在该来源/窗口/绑定规则下未产生记录”，永远不自动等于“不存在”。`NOT_APPLICABLE` 不是成功、失败，也不是“没有记录”。

## 6. 当前生产接受状态（快照；接管时仍需重验）

当前接受证据位于 `docs/v0_8/CHANGE-v0.8.8-production-usability-hardening.md` 和 `qa/v0_8/verification.json -> candidate_v088_production_usability_hardening`。

接受快照：

- runtime：`0.8.8-rc.1`；
- release feature head：`cf1067a4d30485baf22258072d51bb3fc5348c5e`；
- v0.8.8 acceptance evidence commit：`ea2120afee05b6c3fbb59494f92ec8baaf8f65c7`；
- Worker version：`a7f6e635-a5b5-4bff-9171-b47a0ba8b26e`；
- Vercel deployment：`workermanifestfellowship-hx68r01vs-hiddenfeng.vercel.app`；
- release CI `35103315352`：PASS；
- post-deploy auto-research E2E `35104087790`：PASS；
- post-deploy public semantic smoke `35104628662`：PASS；
- E2E QA company/research/ballot 精确 3 行已在 `ltp_write_lock` 下删除，revision `77 -> 78`，残留 0；
- 接受时生产回到 1 个真实公司 `星宇股份有限公司`，现有真实社区证据保留；pending feedback / official references / official relations / official events 均为 0；
- 核心浏览器流程：home/guidance、company list/detail、anonymous advisory、contribution/company creation、我的提交、resource directory、runtime status 已验证；
- production capabilities 中 attachments=false、privateSensitiveInfo=false。

本连续性文件建立时再次通过真实浏览器读取 canonical `/api/config`，确认 version/domainVersion=`0.8.8-rc.1`、mode=`CLOUDFLARE_WORKER_D1`、核心 capability 仍启用，且该读取无 page/network/console error。

最大可辩护结论：**当前生产是已审计核心流程可用的基线。** 不能扩大为全球资料完整、中国大陆稳定 SLA、正式法律代理、自动外部申诉或敏感私密信息服务。

## 7. 当前用户流程与产品完成度

已经作为当前核心产品接受：

- 首页与劳动者问题引导；
- 公司搜索/空间/可读 dossier；
- 独立社区正负信号；
- 低门槛公司/产品/关系/劳动信息贡献；
- 用户自己的提交、纠错/撤回入口；
- 匿名非敏感辅导、回执查询、私有建议与聚合日报；
- 地区资源目录（含中国大陆官方路径）；
- 自动公司研究 Queue + 自愈；
- source-scoped China investigation；
- official reference/relation/event 独立 lanes；
- 18:00/19:00 日常 Agent 运营链；
- 当前全球公网部署和外部 smoke。

明确仍不是当前能力：

- 敏感附件、身份证明、真实姓名/私人联系方式/家庭详细住址/健康/支付数据的私密案件服务；
- 自动代表用户向外部机构提交；
- 保证中国大陆稳定访问 SLA；
- 全球所有公司、所有工商/法院/劳动/供应链/产品信息的完整覆盖；
- CAPTCHA/login/anti-bot/付费墙/未授权接口的绕过；
- 企业综合违法分、道德分、产品质量分。

## 8. 已经反复发生过的错误：新 Agent 不得再犯

### R1. 把旧文档当当前事实

症状：README、旧 handoff、旧 QA header、历史白皮书中的“尚未部署/下一门”被当成现在。
规则：先读本文件和当前 acceptance；再直接查 Git/runtime。历史文档只解释“为什么”。

### R2. E2E 时序错误造成假失败

历史：v0.8.7 source push 在 runtime 部署前自动触发 production E2E。
规则：production auto-research E2E 只允许**部署后手动 workflow_dispatch**；expected version 从 checked-out release 读取。

### R3. Smoke 选中并发 QA 公司造成假失败

历史：public smoke 选到仍在 `QUEUED/COLLECTING` 的并发 QA 公司。
规则：语义 smoke 使用已有完成 dossier；并发 QA 未 ready 时不得被当作健康基准。

### R4. 主体名称“看起来像”就强绑定

历史：CSRC substring 可能把短名绑定到长法律名；Xingyu shorthand/Wikidata/SSE abbreviation 容易诱导错误身份升级。
规则：按 provider-specific exact boundary。SAMR detail producer、CSRC party、SSE official FULL_NAME、SZSE full-name row 各自独立严格绑定。候选/简称不能改写 legal identity。

### R5. 把零结果写成“没有问题/没有关系”

规则：零结果只代表当前 source/window/rule 无匹配；必须保留 coverage/gap 说明。

### R6. 混淆官方来源、社区主张和程序记录

规则：不同 lane 不得因 UI 简化或模型总结合并。程序事件不是违法认定，relation 不是法律责任，社区热度不是证据。

### R7. 对不适用司法区运行来源并把 0 当覆盖

历史：非美公司曾运行美国来源。
规则：地区不适用用 `NOT_APPLICABLE`，既不算 success/error，也不证明 absence。

### R8. 把人工 reviewer 重新做成生产必经门

规则：当前正常生产采用 deterministic fail-closed 自动信任层；Python/人工可做 audit，但不能让网站可用性依赖某个命名人员。

### R9. 回退到 Cron-only 用户研究

历史：D1 QUEUED 正常，但 Cron 无法保证新建公司近期执行。
规则：Queue 是用户触发研究主链；Cron 仅 recovery/refresh。

### R10. 把本机 CLI 网络问题误判为生产故障

历史：curl/Vercel/Workers 或 `wrangler whoami` 在本机路径可 timeout/hang，而真实浏览器或 GitHub-hosted smoke 正常。
规则：区分环境路径与产品故障；使用独立可信路径交叉验证，不为绕过超时降低安全或证据门槛。

### R11. 为了“继续推进”增加无价值框架/collector/测试循环

规则：先问是否存在真实用户痛点、生产故障、已验证 coverage gap。决定性检查已经通过时，不重复全量测试只为制造工作量。

### R12. 生产 QA 数据留下残渣

规则：E2E QA 必须唯一标记；清理前精确 preflight；只删精确 QA related rows；在生产 write lock 下执行；清理后验证 residual=0 且真实数据保留。

### R13. 重新把 Tencent/EdgeOne 变成隐私阻塞

规则：腾讯/EdgeOne 是历史 PoC，不是当前生产依赖。除非用户做出新的明确隐私/合规决策，否则不得要求实名、身份文件、支付方式或重新设置为 NEXT_GATE。

### R14. D1 fallback 变成“方便的任意 SQL 后门”

规则：fallback 只能调用同一 domain mutator + `ltp_write_lock`，只允许治理文件列出的集合。失败时记录 PARTIAL/FAILED，不能临时写 raw SQL 绕过。

### R15. 把外部正式帮助渠道的数据要求带回本站

规则：12333/12348/欠薪等正式外部服务可能需要身份/联系方式；这些只提交给对应官方服务。本站匿名辅导和公开贡献仍不得收这些敏感数据。

## 9. 当前真实 blockers / gaps / next gate

### 当前没有的 blocker

- 没有一个已知核心生产流程阻塞当前产品使用；
- 没有必须用户立刻补充的云账号/付款/实名步骤；
- v0.8.8 没有待完成 release gate。

### 仍然存在但不是当前 blocker 的 gap

- 中国大陆稳定可达 SLA 未声明；
- BSE listing/disclosure 仍缺，但只有在官方、可复现、无 CAPTCHA/login/反自动化绕过的公共接口存在时才值得实现；
- GSXT、CNIPA、部分政府采购仍是明确人工/导航/verification gaps；
- 中国及全球劳动执法、法院、仲裁、完整产品/工厂/供应链覆盖仍然部分；
- credential/license-gated 来源保持关闭直到合法条件满足。

### 当前 NEXT_GATE

优先级固定为：

1. 真实用户反馈、纠错、隐私/安全事件或核心路径故障；
2. 真实生产健康/日常运营暴露出的具体问题；
3. 能明显提升劳动者实际效用、且有可靠来源/合法接口的验证过的 coverage gap；
4. 只有前面没有更高价值工作时，才做普通产品深化。

如果以上都没有，不要为了“Agent 必须继续干活”制造低价值任务。可以维持稳定运行并等待真实信号。

## 10. 任意 Agent 的强制接管流程

### A. 恢复，不猜

1. 确认实际项目根目录；
2. 如果有 AgentDock/等价设备工具，加载项目治理/连续性能力；
3. 读取 `AGENTS.md` 和本文件；
4. 执行 `git branch --show-current`、`git rev-parse HEAD`、`git status --short --branch`；
5. 读取当前 package version；
6. 读取 `qa/v0_8/verification.json` 的最新接受段及当前 change record；
7. 只有需要时再读部署/来源/日常运营专题文档；
8. 若任务依赖生产状态，直接检查当前 runtime/API/浏览器，不从旧聊天推断。

### B. 接管后先形成 9 项状态，不停在总结

- `PROJECT`：项目是什么；
- `USER_GOAL`：用户真正要解决什么；
- `CURRENT_TRUTH`：当前已接受状态；
- `ACTIVE_CHANGE`：当前是否有进行中的语义/架构变更；
- `ACTIVE_WORK`：当前任务/阻塞；
- `PRESERVE`：本轮不能破坏的能力；
- `GAPS`：已知未知/覆盖缺口；
- `NEXT_ACTION`：最高价值的一个具体动作；
- `EVIDENCE`：以上判断来自哪些项目/运行证据。

恢复后直接执行用户任务。不要因为“需要理解项目”重新写一套总体规划，也不要让用户重复项目已经记录的信息。

### C. 工作选择

每次只选择能形成一个有意义 milestone 的工作单元。遇到新问题先判断：

- 是当前 acceptance 的 blocker → 当前任务解决；
- 是相关但非 blocker → 记录为后续，不打断当前主线；
- 是与根目的无关的漂亮工程 → 不做。

### D. 实施与验证

- 先读相关规范/代码/测试，再改；
- 行为/能力/架构语义变化必须使用项目现有 change record 记录 `CURRENT -> PROPOSED -> PRESERVE -> VALIDATION -> ROLLBACK`；
- 不修改规范来“让当前实现看起来通过”；
- 只跑足以证明本次 claim 的 decisive checks；
- 生产/外部状态用对应真实证据验证；
- 失败记录必须保留，不能改写成成功。

## 11. 每个 Agent 的项目治理写回规则

**完成代码不等于完成工作。** 发生实质变化后，Agent 必须同步已有治理文件；不允许另起一个平行 TODO/认知体系。

| 发生的变化 | 必须更新的现有真相载体 |
| --- | --- |
| 用户目标、非目标、长期边界改变 | `PROJECT_CONTINUITY.md` + `AGENTS.md`（仅当 invariant/权限改变）+ 对应 change record |
| 行为/能力/架构变化 | 当前 `docs/v0_8/CHANGE-*.md` + 专题架构/规范 + 相关测试 |
| 新增/修改外部来源 | `docs/v0_8/source-registry.json` + 来源/自动化文档 + provider-specific binding/语义测试 |
| 生产部署/验收变化 | 对应 release change record + `qa/v0_8/verification.json` + 必要生产 evidence |
| 日常 18/19 点运营 | `history/daily/YYYY-MM-DD/` + `agentDailyRuns`；只有契约改变才改 `DAILY_AGENT_OPERATIONS.md` |
| 新的历史失败/反复错误 | 对应 QA/change record；如果会影响未来 Agent 决策，再追加到本文件“反复错误” |
| NEXT_GATE / blocker 改变 | `PROJECT_CONTINUITY.md` + 当前 evidence/change/task state |
| 仅实现细节、无语义变化 | 测试/代码/commit 即可；不要制造新治理文件 |

任何结束/交接前必须确认：

1. Git 工作区状态可解释；
2. 实际已做/未做/阻塞边界清楚；
3. 测试和真实运行证据与 claim 对应；
4. 本文件的 `当前生产状态 / blockers / next gate` 若已变化则已更新；
5. 历史失败没有被抹掉；
6. 没有把秘密、token、私人反馈正文、敏感个案写进交接；
7. 下一 Agent 不需要读旧聊天才能继续。

## 12. 当前必读路径（按任务选择，不要每次全仓库重读）

冷启动最小集：

1. `AGENTS.md`
2. `PROJECT_CONTINUITY.md`
3. `qa/v0_8/verification.json` 的最新接受段
4. `docs/v0_8/CHANGE-v0.8.8-production-usability-hardening.md`
5. 当前 Git/runtime

根据工作再读：

- 产品原始意图/演化：`docs/完整白皮书_v0.3_含历史基线.md`
- 部署：`docs/v0_8/DEPLOYMENT_ARCHITECTURE.md`、`DEPLOYMENT_RUNBOOK.md`、`MAINLAND_CHINA_ACCESS.md`
- 公司自动研究：`docs/v0_8/COMPANY_DATA_AUTOMATION.md`、`docs/v0_8/source-registry.json`
- China investigation：`docs/v0_8/CHANGE-v0.8.5-china-enterprise-investigation.md`、v0.8.6/v0.8.7 change records
- 日常 Agent：`agents/DAILY_COMMUNITY_AGENT.md`、`agents/DAILY_COMMUNITY_REVIEW_AGENT.md`、`docs/v0_8/DAILY_AGENT_OPERATIONS.md`
- 项目主 Agent：`agents/PROJECT_MANAGER_AGENT.md`
- 公告：`agents/SOCIAL_ANNOUNCEMENT_AGENT.md`
- 许可证：`LICENSE`、`LICENSE-DATA.md`、`CONTRIBUTING.md`

## 13. 本文件如何维护

本文件只保存**当前认知、需求演化的原因链、反复错误、权威路由、当前 blocker/NEXT_GATE**。不要把每次 commit、每个测试日志、每条 daily metric 都复制进来。

更新规则：

- 只有会影响下一个 Agent 判断的问题才写进这里；
- 可变数字优先放 QA/历史证据，这里只保存接受快照和指针；
- 新版本接受后更新“当前生产接受状态”和 NEXT_GATE；
- 某条历史错误形成自动测试/治理 invariant 后仍保留一句原因，防止后来 Agent 删除保护；
- 若本文件与实际 Git/runtime 冲突，先把冲突标 `UNKNOWN/CONFLICT`，直接验证后再更新，不能选择更方便的一方。

## 14. 可复制的固定接管指令

下面这段是**启动器**，不是项目事实本身。项目事实仍由本文件及其指向的实时证据维护，因此后续版本变化时通常无需重写整段启动器。

```text
接管项目：/Users/wt/Downloads/labor_transparency_v0_6

不要依赖本对话历史、旧聊天摘要或你自己的项目记忆，也不要重新从零规划。先使用当前可用的本地项目/设备工具（优先 AgentDock；若存在对应 skills，至少加载 project-governance-core、project-continuity，并在涉及语义/架构/长期意图时加载 project-intent-guardian；涉及长期任务状态时遵守现有 work-state 管理规则）恢复项目真实状态。

强制按以下顺序执行：
1. 确认真实项目根目录和 Git 仓库，读取根目录 AGENTS.md 与 PROJECT_CONTINUITY.md；PROJECT_CONTINUITY.md 是唯一当前连续性摘要，历史 handoff、archive、旧白皮书、旧 QA/change 只能解释历史，不能覆盖当前事实。
2. 直接核验 git branch、HEAD、worktree、package/runtime version；读取 qa/v0_8/verification.json 的最新接受段和 PROJECT_CONTINUITY.md 指向的当前 change/evidence。任务涉及生产、数据库、队列、网页、定时 Agent 或外部来源时，必须再直接验证相应实时状态，不能从旧聊天推断。
3. 在动手前恢复并内部明确：PROJECT、USER_GOAL、CURRENT_TRUTH、ACTIVE_CHANGE、ACTIVE_WORK、PRESERVE、GAPS、NEXT_ACTION、EVIDENCE。重点理解用户需求为什么发生变化、已经被事实否定的旧方案、反复出现的历史错误，以及当前设计为何如此；不要只看最新代码表面。
4. 以用户当前要求为最高优先级，在不破坏 AGENTS.md invariants 的前提下直接推进最高价值的具体工作。不要为了“继续推进”制造新框架、新 collector、新版本、重复全量测试或低价值治理文档；优先真实用户反馈/纠错/安全与隐私问题、生产故障、日常运营暴露的问题、已验证且明显提升用户效用的 coverage gap。
5. 不得重复历史错误：不要把候选/简称/substring 自动升级为主体事实；0 match 不代表不存在；community / official reference / relation / event / machine reference / source signal 必须分 lane；不适用地区用 NOT_APPLICABLE；正常生产不能依赖命名人工 reviewer；新公司研究以 Queue 为主、Cron 只恢复/刷新；Tencent/EdgeOne 不是当前 gate；production auto-research E2E 只能部署后手动执行且 QA 必须精确清理；本机 CLI 超时不能未经交叉验证就判定生产故障。
6. 修改前读相关规范/代码/测试；行为、能力、架构或项目语义变化必须使用项目已有 change record 记录 CURRENT→PROPOSED→PRESERVE→VALIDATION→ROLLBACK。只跑足以证明本次 claim 的 decisive checks，失败证据必须保留。
7. 每次出现实质进展都必须同步项目已有治理真相，不允许建立第二套认知/TODO/治理系统：用户目标/NEXT_GATE/反复错误改变时更新 PROJECT_CONTINUITY.md；invariant 改变时更新 AGENTS.md；行为/架构改变时更新对应 docs/v0_8 change/spec；来源改变时更新 source-registry 和 binding/语义测试；生产验收改变时更新 release change + qa/v0_8；18/19 点日常运行写 history/daily 与 agentDailyRuns。
8. 除非遇到确实需要用户决策的高风险/不可逆/身份或法律授权问题，否则不要停在“建议/计划/等你确认”。完成一个有意义 milestone 后再汇报。若当前没有真实 blocker 或高价值工作，不得编造任务；应明确维持稳定运行并等待真实信号。
9. 结束或交接前，确保 Git/work state 可解释、实际已做/未做/阻塞清楚、测试/运行证据与 claim 对齐、当前 blocker/NEXT_GATE 已同步、秘密/私人反馈/敏感个案未进入交接，并确保下一个全新 Agent 不读任何旧聊天也能仅靠 AGENTS.md + PROJECT_CONTINUITY.md + 其指向证据继续工作。

恢复完成后不要只输出长篇项目总结；先用简短状态说明你确认的当前事实与本轮 NEXT_ACTION，然后直接执行本次用户任务，持续推进到一个真实 milestone 或必须由我决策的边界。
```

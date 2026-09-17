# Labor Transparency / 劳动透明计划 — PROJECT_CONTINUITY

Status: `CURRENT_CANONICAL_CONTINUITY`
Continuity schema: `LTP-CONTINUITY-1`
Accepted product runtime at this continuity update: `0.8.8-rc.1`
Active source/runtime candidate at this continuity update: `0.9.0-rc.1` (`REFERENCE_PRODUCTION_RELEASE_PREP_LOCAL_PASS`, not source-published under this version and not production accepted)
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

### Phase O — 2026-09-17：从单一中心运营转向公益上游 + 独立实例 + 公共证据协作网络

用户明确改变长期架构目标：项目不再以“由上游长期承载全球用户、数据和地区运营”的中心化全球平台为终局，而要成为**非商业公益的 source-available 软件/标准上游 + 独立实例 + 公共证据协作网络**。当前公网部署保留为 reference instance；其他社区应拥有自己的数据库、Secret、用户/会话、日志、审核和部署责任，Fork 不得默认连接参考实例生产 API/数据库。

联邦对象也被明确收窄为**公开且有传播/再分发权利的证据与事实**，而不是用户数据库。匿名/假名身份、投票关联、私人反馈/辅导、联系方式、IP、原始敏感材料不因“去中心化”而跨实例复制；可审计历史必须支持纠正、撤回、tombstone 与依法删除，而不是把私人内容永久不可删除地固化。

同时用户新增“产品与劳工信号”消费入口：产品可带出所属公司的劳动者视角、普通社区印象和具体劳动主张/证据，形成“劳工愤怒榜 / 劳工支持榜 / 证据视图 / 社区关注”等消费者参考入口。但三条 lane 必须物理/语义分离：自报劳动者情绪不是雇佣身份验证，社区印象不是劳动事实，具体主张的证据等级只支持该主张；任何榜单都不能升级为企业道德/违法总分、产品质量分或平台强制抵制/购买指令。

第一阶段采用增量迁移，不做大爆炸重构：保留既有 v0.8.8 数据/证据模型，在同一 ballot collection 中用独立复合键增加 worker-perspective lane；产品市场只读取公开产品及公开信号/证据；独立实例构建模式失败关闭远程 upstream API/proxy。当前 P0 bootstrap 已完成本地验证：新 Fork 可生成自己的稳定 `instance.id`、Ed25519 实例密钥、私有运行 Secrets 与本地 FileStore 数据目录，并通过 localhost same-origin 启动现有核心应用；实例身份与数据在重启后保持，且公开 config/health 不暴露私钥或运营 token。第一版 signed public-evidence federation 也已本地跑通：只从现有 `publicDataset` 的独立再分发批准记录生成签名 full snapshot + delta，两个独立实例可完成 verify/import、key pinning、幂等、链连续性、correction/retraction/tombstone；用户/session/投票身份、私有 feedback/advisory 和未审查再分发条款的 official/machine/provider lanes 不进入 v1。content-addressed 多镜像、显式 peer trust/pull 与 self-host release contract 都已在本地验证；公开治理、README、GitHub issue/PR 与 release-readiness 包也已完成机器检查，使第三方可以直接理解许可、隐私、安全、品牌和 operator 责任。真实外部 Git/object-storage/IPFS 镜像、自动 peer crawler、完整 container E2E、下游公网证书/监控/异地备份和跨实例 aggregate 仍是后续阶段，不得写成当前已完成能力。

根本原因：**把项目生命力从单一运营者/单一站点中解耦，同时不能把“去中心化”变成更大规模的隐私复制，也不能把情绪动员伪装成事实判断。**

当前 active change：`docs/v0_8/CHANGE-federated-public-interest-network-and-product-labor-signals.md`；独立实例边界说明：`docs/v0_8/INDEPENDENT_INSTANCES_AND_FEDERATION.md`。Phase O 已从 source-only candidate 进入 **`v0.9.0-rc.1` Reference Production release-prep candidate**；accepted production 仍是 `v0.8.8-rc.1`，版本化候选尚未发布/部署，必须先完成 source publication + CI，再经过单独 production release/acceptance。

## 4. 当前真实系统架构

当前**已接受生产实例**的运行拓扑没有因 Phase O 自动改变；它现在应理解为 reference instance。上游目标架构是 `Software + Standards + Public Evidence Contract -> independent instances`。P0 independent bootstrap 与第一版 signed public-evidence snapshot/delta transport 已在本地两个独立实例间验证，但尚未作为 reference production 或公开多节点网络部署/验收。

```text
普通访问者（reference instance）
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
| `GENERAL_COMMUNITY_SIGNAL` | 本实例普通社区对公司的去重正/负整体印象与关注 | 劳动者总体意见、劳动事实、违法或产品质量 |
| `WORKER_PERSPECTIVE_SIGNAL` | 自报劳动相关参与者对待遇的正/负感受 | 雇佣身份验证、具体劳动事实、证据等级 |
| Community E0+ / `labour_claim` | 用户/社区的观点、经历、线索与具体劳动主张；E-level 只约束具体主张 | 自动变成官方事实、公司总分或所有员工意见 |

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

2026-09-17 Reference release-prep 前再次通过真实浏览器读取 canonical `/api/config`，确认 version/domainVersion=`0.8.8-rc.1`、mode=`CLOUDFLARE_WORKER_D1`、核心 capability 仍启用，且该读取无 page/network/console error。同期 trusted production state 已有 **2 家真实公司**（`富士康`、`星宇股份有限公司`），pending feedback=0；新增真实公司 `富士康` 的 Queue 研究从 queuedAt `02:42:43.501Z` 到 collectedAt `02:42:47.015Z` 后进入 `AUTO_READY / CANDIDATES_ONLY`，2 个适用来源成功、0 error、9 个来源 `NOT_APPLICABLE`，`exactNameCandidateCount=0`，法律主体保持 `NO_VERIFIED_REFERENCE`，证明新公司主链正常且没有因简称/上下文相似强绑主体。该生产事实是当前运行证据，不改写 v0.8.8 接受时“1 家真实公司”的历史 hygiene 快照。

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

当前还有一个**已分配 `v0.9.0-rc.1` source/runtime identity、正在 Reference Production release prep、尚未生产验收**的 active candidate：

- 产品与劳工信号页：公开产品卡片同时展示彼此独立的 `WORKER_PERSPECTIVE_SIGNAL`、`GENERAL_COMMUNITY_SIGNAL`、具体 `labour_claim` 证据；包含“劳工愤怒榜 / 劳工支持榜 / 证据较强的劳动实践 / 社区关注”视图，所有榜单都有非事实/非产品质量结论边界；
- worker perspective ballot 与旧 community ballot 同 collection 但使用独立复合键，旧 community 记录无需迁移且不会被 worker signal 覆盖；
- local reference server 与 Cloudflare Worker 都已有 `/api/product-market` 候选接口和独立 worker/community/evidence 投影；
- `LTP_INDEPENDENT_INSTANCE=true` 构建模式要求 same-origin API，配置远程 API/proxy 时失败关闭；P0 bootstrap 还能生成自己的稳定 instance ID / Ed25519 key / Secrets / FileStore 并 localhost same-origin 独立启动；
- signed public-evidence federation v1 已在两个本地独立实例间通过：只同步现有 public redistribution gate 已批准的 contribution，支持 canonical full snapshot + delta、Ed25519 签名、source-key pinning、幂等、chain continuity、correction/retraction/tombstone；导入 evidence 与 source tracker 使用独立 collections，不自动再转发；
- tombstone 只继续公开 hash/version/root/history proof，不继续公开已撤正文；FileStore 导入必须显式 `--service-stopped`；
- `/api/federation/evidence` 是只读公共 provenance 投影；当前没有远程 federation 写接口；
- content-addressed multi-mirror 已本地验证：source-signed snapshot 可封装为 `sourcePathId/snapshotRoot` package，byte-identical 复制到多个 mirror root，每次读取重新验证文件 hash + source signature；删除一个镜像、破坏第二个镜像后可从第三个恢复，全部损坏时失败关闭；
- mirror index/manifest 只作传输定位，不是证据 authority；minimal signed peer descriptor + explicit trust + pull 已本地验证，可从 descriptor latest root 反向补齐缺失 snapshot 链并跨损坏镜像恢复，但仍没有真实外部 Git/object-storage/IPFS 镜像、availability monitoring、中心/自动 peer registry 或周期性 crawler；
- self-host release contract 已本地验证：code-only release 与实例持久数据分离，真实 Caddy Host/Origin/CSRF/security flow、health/preflight、停服 backup/restore、release replacement 通过；Dockerfile/Compose 配置可解析，但 Docker Hub base-image 拉取超时使真实 container build/run 仍是明确 gap；
- public governance/release readiness 已完成：根目录 mission/operating/governance/privacy/security/non-commercial/operator/brand/attribution/conduct/release policy 与 GitHub Issue/PR 模板已建立；`public-site` 的 LICENSE/data-license/contributing 副本受自动一致性检查；machine readiness 当前为 `PUBLIC_GOVERNANCE_READY_SOURCE_CANDIDATE`；
- clean source candidate 已作为 commit `ec453528b3e4cb89bb6f6c0d06db211092b878f4` 推送 canonical GitHub `main`。该 SHA 的 `Validate release candidate (no deployment)` run `35181683052`、`Public non-Tencent deployment smoke` run `35181683073` 与 GitHub Pages run `35181683098` 均 `success`；其中 public smoke 只证明当前已部署 Reference Instance 公开路径仍健康，**不证明 Phase O 已部署**；
- 以上由 `docs/v0_8/CHANGE-federated-public-interest-network-and-product-labor-signals.md` 与 `docs/v0_8/INDEPENDENT_INSTANCES_AND_FEDERATION.md` 管理，**不是 accepted production capability**，直到单独 version/release/deploy/production acceptance 完成。

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

### R16. 把“去中心化/永久保存”理解成复制所有用户和私人材料

规则：联邦默认只面向有公开传播/再分发权利的公共证据。用户/session 关联、投票身份链接、私人反馈/辅导、联系方式、IP、原始敏感材料和附件不跨实例复制；历史可审计不等于私人数据永不可删，必须支持纠正、撤回、tombstone 与法律要求的删除边界。

### R17. 把劳工情绪榜写成事实榜/黑名单

规则：`WORKER_PERSPECTIVE_SIGNAL`、`GENERAL_COMMUNITY_SIGNAL` 与具体 `labour_claim` 证据始终分开。劳工愤怒/支持、社区关注只说明本实例的自报情绪/参与，不验证雇佣身份、不证明违法/优良雇主，也不构成产品质量结论、黑名单或平台强制购买/抵制指令。

### R18. 运行中的 FileStore 被离线 federation importer 直接改写

历史：第一版 federation integration 中，导入进程已经写盘，但正在运行的 B 实例仍持有旧内存状态，API 看到 0 条导入记录；继续并发写还可能覆盖导入结果。
规则：FileStore federation import 属于离线 mutation，必须显式 `--service-stopped`；不要为“热同步”绕过这个门或增加任意文件写后门。将来若需要在线导入，必须走同一运行进程的受权 domain transaction，而不是第二个 FileStore writer。

### R19. 把“公开来源/公开内容”自动等同于“可以联邦再分发”

规则：v1 federation 只复用现有 `publicDataset` 独立再分发审批；社区/worker ballots、owner/session、私有 feedback/advisory、imported federation data，以及尚未逐来源复核再分发条款的 official/machine/provider lanes 都不能自动进入 snapshot。Imported data 也不得默认再出口形成无控制多跳复制。撤回/tombstone 只保留 hash/version/root/history proof，不继续公开旧正文。

### R20. 把镜像 index / URL / 仓库数量当成证据权威

规则：mirror 只是公开签名快照的分发副本。`index.json`、manifest、DNS、Git 仓库和 URL 都只能帮助定位；真实可信度仍必须回到 source instance 公钥、snapshotRoot/contentRoot、精确文件 hash 与原始 Ed25519 签名。多个镜像重复同一说法不能提高证据等级，也不能替代来源本身。

### R21. 把本地多目录容灾测试写成“全球去中心化网络已上线”

规则：当前 multi-mirror 只证明 content-addressed package/复制/校验/恢复契约。没有真实外部 Git mirror/object storage/IPFS 节点、availability monitoring、自动 peer discovery/fetch 或公开运营网络时，必须继续写作本地验证 candidate，不能声称互联网级持久性或抗审查可用性已建立。

### R22. 把 peer descriptor / DNS / URL 当成自动可信身份

规则：peer 必须由 operator 显式 `--trust`；首次信任 pin source key，之后同 ID 换钥匙、descriptor 回滚/冲突失败关闭。URL/DNS/mirror 数量只负责定位，不证明主体更可信、更真实，也不提高任何 evidence level。不得建立一个“中心 registry 说可信，所以所有实例自动信任”的捷径。

### R23. 为了自动 pull 放宽网络或离线写入边界

规则：非 loopback 网络访问必须显式授权；非 loopback plaintext HTTP、redirect、URL credentials/query/fragment、无限响应体都拒绝。FileStore pull/import 继续需要 `--service-stopped`，不能因为 peer 同步需要频繁运行就引入第二个并发 FileStore writer 或任意远程 mutation endpoint。

### R24. GitHub 治理文档 / 静态副本漂移

历史：README 重排后曾丢失强制 cold-start 入口；`public-site/CONTRIBUTING.md` 也曾保留“本地合成环境”的旧文案。
规则：公开治理/README 重构必须跑 `scripts/public_project_governance.test.mjs` 与 `scripts/public_release_readiness.mjs`；根 `LICENSE` / `LICENSE-DATA.md` / `CONTRIBUTING.md` 与 `public-site` 对应副本必须保持一致。不得为了版面精简删除 `AGENTS.md -> PROJECT_CONTINUITY.md` 接管路由。

### R25. 把 source release / main 分支更新写成 production deploy

规则：GitHub 源码更新、tag/release、self-host code release 与 Reference Instance production acceptance 是不同状态。Phase O 未完成单独 release -> deploy -> production smoke/acceptance 前，必须保持 `phaseOCandidateProductionAccepted=false`，不能因为 main/Release 已公开就宣称 Reference Instance 已运行该 candidate。

## 9. 当前真实 blockers / gaps / next gate

### 当前没有的 blocker

- 没有一个已知核心生产流程阻塞当前已接受 v0.8.8 reference instance；
- 没有必须用户立刻补充的云账号/付款/实名步骤；
- v0.8.8 没有待完成 release gate；
- Phase O 本地 candidate 已具备可继续推进的明确路径，不需要用生产部署来证明本地实现存在。

### 仍然存在但不是当前 blocker 的 gap

- 中国大陆稳定可达 SLA 未声明；
- BSE listing/disclosure 仍缺，但只有在官方、可复现、无 CAPTCHA/login/反自动化绕过的公共接口存在时才值得实现；
- GSXT、CNIPA、部分政府采购仍是明确人工/导航/verification gaps；
- 中国及全球劳动执法、法院、仲裁、完整产品/工厂/供应链覆盖仍然部分；
- credential/license-gated 来源保持关闭直到合法条件满足；
- self-host release contract 已本地验证：独立实例可使用外置持久目录、code-only release、Host/Origin/CSRF、真实 Caddy reverse proxy、health/preflight、停服 backup/restore 与 release replacement；Dockerfile/Compose/Caddy 配置已解析验证，但本机 Docker Hub base-image 拉取超时导致真实 container build/run 尚未完成；FileStore runtime 仍不包含 reference production 的 Queue/Cron 自动研究；
- signed public-evidence full snapshot + explicit delta、import idempotency、key pinning、chain continuity、correction/retraction/tombstone 已在两个本地独立实例间验证；content-addressed multi-mirror package/publish/verify/resolve 与 signed peer descriptor + explicit trust/pull 也已本地通过，但尚未连接真实外部 Git/object-storage/IPFS 镜像，没有 availability monitoring、自动周期 peer crawler、key rotation/recovery 或公网运营网络；
- federation v1 只同步现有独立再分发批准的 contribution；official reference/relation/event、machine/provider/source lanes 仍需逐来源确认公开再分发条款后才能进入跨实例快照；
- 跨实例 community/worker signal 聚合尚未设计为可抵抗重复身份/Sybil 的可靠统计，因此当前不得生成“全网好评率/愤怒率”。

### 当前 NEXT_GATE

在任何真实用户反馈、纠错、隐私/安全事件或生产故障仍拥有最高抢占优先级的前提下，用户当前已明确授权的结构性主线是 Phase O：

1. clean Phase O source candidate `ec453528b3e4cb89bb6f6c0d06db211092b878f4` 及治理提交 `a8eca854f28fbd23deab8ce3b35be2470ec1fdcc` 已在 canonical `main`，其既有 CI/public smoke/Pages 证据均成功；accepted Reference Instance production 仍保持 `v0.8.8-rc.1`；
2. 2026-09-17 release-prep preflight 已重新检查真实 production/config、feedback、真实新公司 Queue/dossier 与 18:00/19:00 LocalAgentRuntime 调度：没有反馈/申诉/隐私安全/核心生产故障抢占项；真实 `富士康` 新公司研究主链成功且主体歧义正确 fail-closed；
3. Phase O 已分配新的 source/runtime candidate identity **`v0.9.0-rc.1`**，不再允许用 `0.8.8-rc.1` 表示 materially different candidate。机器治理必须同时表达 `candidate=0.9.0-rc.1` 与 `accepted production=0.8.8-rc.1`，不得再把 package version 自动当成生产接受版本；
4. 当前下一 gate 是 **VERSIONED_SOURCE_CANDIDATE_PUBLICATION_AND_CI**：完成本地 release-prep/change/release-note/QA evidence 后，将 versioned candidate 作为独立 source publication 提交 canonical repo 并观察决定性 CI。source publication 仍不等于 production deploy；
5. 只有 versioned source candidate 的 CI 通过后，才进入 **REFERENCE_PRODUCTION_RELEASE_GATE**：deploy -> production smoke -> 手动 post-deploy auto-research E2E -> exact QA cleanup/residual=0 -> production acceptance。任何失败必须保留，不能修改验收标准；
6. 真实外部 Git/object-storage/IPFS mirrors、自动 peer availability、Docker registry/build 仍可后续补，但不能抢占真实用户反馈/安全/生产故障。跨实例 community/worker aggregate 继续等待 anti-Sybil 设计。

不要因为长期联邦方向已经确定就大爆炸重构目录、创建第二套数据模型或提前实现无人使用的服务。每一阶段必须先证明独立用户价值和边界。

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

# v0.8.2 无人值守公司资料研究：来源、信任规则与自愈边界

日期：2026-09-16
状态：`PASS_PRODUCTION_UNATTENDED_AUTONOMOUS_COMPANY_INTELLIGENCE / GLOBAL_COVERAGE_PARTIAL`

## 1. 目标不是“爬到越多越好”

系统现在把公司公开资料自动化拆成四层，而且正常生产路径不等待某个具体人员：

1. **来源候选**：公开来源返回了一个名称、案件、设施、申报或交易候选；
2. **确定性身份/信任判定**：机器按权威来源、精确名称、国家提示、LEI/CIK 等结构化校验决定是否允许形成窄范围参考事实；任何歧义都失败关闭；
3. **机器事实 / 来源信号 / 候选分流**：满足严格规则的客观参考字段进入 `MACHINE_VERIFIED_REFERENCE`；劳动、执法、工会、停工等名称命中只进入带原始程序语义限制的 `SOURCE_SIGNAL`；其余为 `CONTEXT_CANDIDATE` / 未知；
4. **持续重算与撤回**：每次刷新以当前来源重新生成机器资料。旧事实失去当前支持时自动删除/降级，不要求运营人员手动清理。

因此，“没查到”仍然是未知，不写成“不存在”；“查到案件”也不自动写成“公司违法”。Cloudflare Worker 会把完整 raw candidate 保存在受限 `companyResearch` 记录中；普通公众可看到机器参考事实、来源信号、自动降级原因、研究生命周期、来源可用/失败状态，以及每个来源最多 3 条经过字段白名单裁剪的候选预览。案件正文、raw `records`、私有队列和后台审计材料不进入普通公司 API。

## 2. 当前来源矩阵

机器可读版本：`docs/v0_8/source-registry.json`。

| 来源 | 主要覆盖 | 当前模式 | 核心限制 |
| --- | --- | --- | --- |
| GLEIF | 法律名称、LEI、国家/辖区、实体/维护状态、直接/最终会计合并母公司 | 无密钥自动；身份根 | LEI覆盖不是全部公司；母公司为会计合并口径，不是完整实控/供应链 |
| SEC EDGAR | CIK、ticker、交易所、SIC、近期申报、部分 XBRL 财务事实 | 美国公开申报主体；无密钥 | 当前共享网络可能被 SEC 限流/403；不可因此阻断其他来源 |
| Wikidata | 行业、产品/产出、品牌、成立时间、总部、上下级/子组织、官网 | 全球候选；需 QID 显式绑定 | 社区知识图谱，只作上下文；与官方来源冲突时不能覆盖更高权威来源 |
| NLRB cases | charge / petition / case 编号、类型、日期、状态、地点等 | 美国；结构化镜像查询，NLRB 为 source-of-record | 案件或 charge 的存在不等于 NLRB 已认定雇主违法 |
| OSHA enforcement | 检查地点、类型/范围、日期、citation 等 | 美国；结构化 DOL 数据镜像 | 检查/引用只支持具体 establishment / event，不外推公司整体 |
| DOL WHD | 已结案合规行动、欠薪/受影响员工/民事罚款、行业和地点 | 美国；结构化镜像 | 可表达来源明确的具体执法结果，但不能外推所有地点/时期/实践 |
| FMCS F-7 | 集体谈判通知、工会、单位规模、地点、合同/到期信息 | 美国；结构化镜像 | 是谈判/通知记录，不是违法认定 |
| NLRB voluntary recognition | 自愿认可、代表单位、工会、人数、地点 | 美国；结构化镜像 | 是代表权/认可事件，不是违法或“劳动条件好坏”结论 |
| FMCS work stoppages | 停工事件、工会、人数、日期、持续时间、行业/地点 | 美国；结构化镜像 | 事件原因、责任、合法性需另行证据 |
| DOL OLMS LM-20/21 | employer / consultant statutory disclosure、报告与金额 | 美国；结构化镜像 | 是法定披露/安排；不能自动表述为 unfair labor practice 认定 |
| USAspending | 联邦 award / 政府客户关系、金额、机构、描述、期间 | 美国；官方无密钥 API | 只证明具体公共 award，不是完整客户/供应商/合作网络 |
| OpenCorporates | 多司法辖区企业登记、公司编号、人员/网络等 | **可选**；需要 API token，并做许可复核 | ODbL/share-alike/商业条款必须先与项目再分发政策兼容 |
| Open Supply Hub | 设施、产品/加工类型、parent company、贡献者、供应链候选 | **可选**；token/订阅 | 贡献者/设施关联是候选，不自动证明当前供应合同或责任链 |

LaborData 在本项目里只作为美国公共劳工数据的**结构化镜像/查询层**。NLRB、OSHA、WHD、FMCS、OLMS 等官方机构仍是 source-of-record；前端和证据解释不得把镜像网站说成官方机构。

## 3. 七个公司栏目现在能做到什么

### 企业主体

GLEIF 是当前 identity root。只有**唯一精确法律名称候选 + 公司空间存在可机器解析的国家提示 + GLEIF 国家一致 + LEI 通过 ISO-17442 mod-97 校验**时，机器才发布法律名称、LEI、国家/地区、辖区、实体状态和 LEI 维护状态等窄范围参考字段。多个精确候选、国家缺失/冲突、LEI 校验失败都会自动保持未绑定。OpenCorporates 只能在 token + 许可决策完成后作为补充。

### 业务与产品

可由 SEC EDGAR 的申报元数据/XBRL、Wikidata 的行业/产品/品牌上下文、WHD/FMCS 的行业字段和 USAspending 的具体 award 描述补充。它们依然不能组成“全产品目录”，也不能推出产品质量。

### 母子公司与品牌

GLEIF 的直接/最终会计合并母公司属于较强来源；Wikidata 的 parent/subsidiary/brand 只是上下文候选。两者不能混写为同一法律口径。

### 工厂与用工地点

Wikidata 可给总部上下文；OSHA、WHD、FMCS/NLRB 记录可给具体事件/单位涉及地点。它们不是企业全部设施清单。真正供应链设施仍需要 Open Supply Hub 或企业公开供应商/工厂数据等后续授权来源。

### 供应链与合作关系

目前最强的无密钥自动化是 USAspending 的具体美国联邦 award / 政府客户关系。它不等于完整供应链。Open Supply Hub 已留接口，但在 token、许可、OS ID 和关系范围未确认之前只允许候选，不写入事实。

### 劳动信息来源

美国覆盖已经明显增强：NLRB、OSHA、WHD、FMCS F-7、voluntary recognition、work stoppage、OLMS 披露可以自动形成候选/事件记录。不同来源的法律含义不同：

- `charge / petition / case`：程序记录，不等于违法认定；
- `inspection / citation`：具体检查/引用记录，最终状态需看来源；
- `WHD concluded compliance action`：可以描述来源明确的具体结案执法字段，但仅限具体案件、期间和地点；
- `F-7 / voluntary recognition / work stoppage`：劳资关系或事件记录，不是违法认定；
- `LM disclosure`：法定披露，不自动等同于不公平劳动行为。

社区贡献继续存在，但社区热度永远不能把 E0 线索自动提升为高证据事实。

### 官方沟通与申诉渠道

Wikidata 的官网字段只用于公开入口。正式劳动申诉渠道高度依赖国家/地区和事项类型，因此继续由“权益资源目录 + 地区规则”提供，不假装存在一个全球统一企业投诉 API。

## 4. 自动执行架构

### Python back office：可选离线审计，不是生产门

```text
公司空间
  -> GLEIF 主体候选/绑定
  -> 多来源有限搜索
  -> provider-specific 候选
  -> 显式 source binding
  -> 多源 draft packet
  -> 独立来源/范围/许可/隐私复核
  -> 到期发布研究快照
  -> 用户/关注者通知
```

这条历史链继续保留用于研究、审计和更复杂的显式绑定实验，但 v0.8.2 生产网站不会等待它，也不会要求一个命名 reviewer 才能正常展示自动公司资料。

### Cloudflare Worker + Queue：线上无人值守主链

用户通过 `POST /api/companies` 新建真实公司空间时，Worker 会在同一个 D1 事务中创建 `QUEUED` 研究记录，并立即向 Cloudflare Queue `labor-transparency-company-research` 投递只包含 company ID / reason / refresh 标记的消息。Queue Consumer 执行多源采集和自治信任规则，状态进入 `COLLECTING`，完成后为 `AUTO_READY` 或 `AUTO_READY_WITH_SOURCE_GAPS`，且 `reviewRequired=false`。意外运行时失败记为 `COLLECTION_FAILED` 并按退避重试；主 Queue 多次失败后进入 DLQ，DLQ 也由同一 Worker 消费并把耗尽状态写回 D1，之后定时兜底按 failureCount 指数退避重新投回主 Queue。`*/5` 与日更 Cron 只重新投递遗漏、陈旧、失败或到期刷新任务，不直接执行外部采集。

默认约束：

- 每次最多 `LTP_RESEARCH_MAX_COMPANIES_PER_RUN` 个公司，默认 2；
- synthetic demo 不进入研究；
- 原始候选与 raw source records 仅在 research-agent 受限接口可见；
- 普通公司列表只公开安全研究投影：生命周期、来源状态/数量、官方来源链接和每来源最多 3 条字段白名单候选预览；
- `/api/research/status` 公开 queued / collecting / failed / completed 等聚合状态；
- `COMPANY_RESEARCH_QUEUE` 是生产主消费者；每批 1 条消息、最大并发 1、默认重试延迟 60 秒、最多 5 次并配置独立 DLQ；DLQ consumer 每批/并发仍为 1，遇到底层写入失败最多重试 10 次；
- `LTP_RESEARCH_QUEUE_DISPATCH=true` 才允许 HTTP/调度器向真实 Queue 投递；本地普通 smoke 默认关闭，避免测试无意触发真实联网采集；
- `LTP_RESEARCH_SCHEDULED=true` 时 `*/5` 与 `0 1 * * *` 只承担漏单/到期刷新重投递，不直接跑外部 provider；
- 完成记录默认 24 小时后重新刷新；策略版本变化或历史记录缺少当前 intelligence 时立即进入自动迁移。失败从 30 分钟起按 failureCount 指数退避，最高 8 小时；`COLLECTING` 超过 15 分钟视为陈旧 lease；
- 每个外部来源请求有 8 秒硬超时，来源串行执行以减少对公共 API 的突发压力；单来源超时/403/429 不丢弃其他来源结果；
- 研究 Agent token 与 advisory/review/export token 完全分离；
- 来源错误统一成有限错误码，不能把第三方内部 reference、网络异常正文或凭据回给公众。

## 5. 当前真实验证

`qa/v0_8/live-company-sources.json`：对 Starbucks Corporation 做有限名称候选检查。GLEIF、Wikidata、NLRB、OSHA、WHD、FMCS F-7、OLMS 和 USAspending 在本机网络上有真实返回；SEC 在当前共享出口出现 `SOURCE_ACCESS_DENIED`；某些数据集对该名称返回 0 条，这是有效的“没有本轮候选”，不是来源失败。

`qa/v0_8/live-company-intelligence.json`：在 QA 中显式指定 Starbucks 的 GLEIF/Wikidata/NLRB/OSHA/WHD/F-7/OLMS/USAspending 绑定后生成 `DRAFT_READY` 多源草稿。该动作没有批准或发布草稿。

`qa/v0_8/cloudflare-live-research.json`：v0.8.2 已完成真实本地 Wrangler Worker + D1 + Queue + 真实外网自动链验证；流程为“用户创建 Starbucks Corporation -> D1 `QUEUED` -> `QUEUE_SENT` -> Queue Consumer -> 多源采集 -> 自治信任分层 -> 普通 `/api/companies` 机器参考事实/来源信号/候选安全投影 -> Worker 重启恢复”。本地真实来源链得到 `AUTO_READY_WITH_SOURCE_GAPS`、6 个机器参考事实、4 个来源信号，且 `reviewRequired=false`。正式生产 E2E run `35046956907` 也从项目自有域名完成同一主链，并额外验证普通用户负向 ballot 交互；QA company/research/ballot 共 3 条记录随后精准清理。现有真实公司“星宇股份有限公司”无需私有 run/review 即自动迁移到 `auto-intelligence-0.8.2`，在无法得到足够强身份参考时正确保持 `NO_VERIFIED_REFERENCE`，其真实社区负向反馈继续保留。最终机器证据见 `qa/v0_8/autonomous-company-intelligence-v082-production.json` 与 `qa/v0_8/verification.json`。

`qa/v0_8/company-intelligence-audit.json`：确定性 fixture 对所有主要 provider 完成 `candidate -> explicit binding -> draft -> independent review -> release -> reopen persistence` 审计。

## 6. 仍然不完整的部分

“对应公司相关的全部数据”在现实世界没有一个合法、免费、全球、实时且完全准确的数据源。当前还明确存在以下缺口：

- 全球非 LEI 企业的登记/股权覆盖不一致；
- 全球诉讼、法院 docket、劳动仲裁、行政处罚没有统一免费结构化 API；
- 完整产品目录、门店/工厂、全球供应商/客户、外包链与历史关系需要更多企业披露或授权数据；
- 中国大陆及其他司法区的工商、法院、劳动监察、工会/仲裁数据需要按当地许可和访问规则逐源接入；
- 新闻/媒体只能作为“事件发现/进一步核查”候选，不应直接成为高证据事实；
- OpenCorporates / Open Supply Hub 等需要第三方账号/token/订阅或许可决策，Agent 不绕过这些前置条件。

后续新增来源必须先登记在 source registry，再实现 bounded adapter、主体绑定规则、语义边界、测试和真实有限验证。不能通过任意 URL 爬虫、验证码绕过、付费墙规避或账号共享来“补齐覆盖”。

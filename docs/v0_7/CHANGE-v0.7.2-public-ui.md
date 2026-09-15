# CHANGE v0.7.2 — 面向普通劳动者的大众化 UI / 内容重构

ID: `LTP-V072-PUBLIC-UI`

## PROBLEM

v0.7.1 的核心业务链、匿名辅导和证据边界已经可运行，但前端仍有明显“工程候选 / 开发者说明页”气质：技术术语过多、首页没有首先回应劳动者痛点、缺少情绪支持与行动指引、新闻/公开案例和外部权益资源不足，运营入口也过于显眼。

## CURRENT

- 公司空间、社区反馈、公开贡献、证据复核、纠错、匿名辅导、Agent 日报等业务能力已存在。
- 首页主叙事仍以“系统是什么 / 证据机制是什么”为主。
- 权益指导、公开案例、国际/地区正式资源没有形成大众化信息架构。
- “AI built / AI managed”信息权重过高，普通用户第一眼不容易理解“这里能帮我做什么”。

## PROPOSED

把公开体验定位为：**公共服务 × 公益媒体 × 温暖而有力量的行动入口**。

核心首页顺序改为：

`情绪共鸣与三条主行动 → 常见劳动痛点 → 先做三件事 → 真实公开案例 → 正式外部帮助资源 → 社区声音与证据解释 → 匿名辅导聚合日报`

主要视觉语言：暖白、珊瑚红、深靛蓝、可信赖青绿；大字号编辑式标题配合轻微手写感短句；圆角但避免卡片泛滥；动效只用于层次与反馈，并提供 reduced-motion 降级。

## ADDED

- 6 类大众问题入口：工资/加班、工时/休息、合同/离职、安全、尊重/歧视、组织/发声。
- 每类问题的“先记录什么 / 下一步是什么”基础指导。
- 4 个 2026 年公开劳动事件案例，全部链接回 DOL 或 Worker Rights Consortium 原始来源。
- 外部权益资源目录：ILO、WRC、ITUC、Workers United、US DOL WHD、OSHA、NLRB、Acas、Fair Work Ombudsman、European Ombudsman。
- 首页公开资源导航、公开案例区、匿名辅导日报摘要和公司社区预览。
- 公司搜索框。
- 大众化证据等级文案映射。
- 响应式布局、focus-visible、reduced-motion、渐进式 reveal 动效。
- `editorial-content.js` 内容层与对应源/URL 测试。

## MODIFIED

- 首页从“工程候选介绍”改为劳动者痛点和行动入口。
- 主导航隐藏运营审核入口，改放页脚弱化入口。
- 匿名辅导页面从“队列”语义改为“先把事情慢慢说清楚”的人本流程。
- 公司页把 E0/E3 等系统码翻译成大众可理解标签，同时保留内部证据机制。
- 方法页保留治理信息，但不再承担首屏叙事。

## REMOVED

没有删除任何 v0.7.1 已验证业务能力。没有新增真实敏感私密信息收集。

## PRESERVED_CAPABILITIES

- 社区热度与证据等级分离。
- 公司、产品、具体劳动实践证据范围分离。
- E0 可公开讨论；证据升级仍由复核决定。
- 纠错暂停高证据展示/再分发。
- 匿名辅导只接收非敏感摘要，私有建议不公开，公开日报只含聚合数量。
- 自动公司研究覆盖仍以 `/api/research/coverage` 和 QA 审计为准。

## CONTENT SOURCE POLICY

公开案例只使用当前已核验的原始/权威来源链接；案例只是教育性引导，不自动进入公司事实库或证据等级。

外部资源收录只是公开导航，**不表示项目与相关机构存在合作、隶属、授权、认可或正式转介关系**。

当前内容来源包括：

- ILO — Fundamental Principles and Rights at Work；Grievance handling and access to remedy
- Worker Rights Consortium — 工厂调查与补救
- ITUC — Global Rights Index
- U.S. Department of Labor — Wage and Hour Division complaint / 2026 enforcement releases
- OSHA — File a Complaint
- NLRB — Investigate Charges
- Workers United
- Acas
- Fair Work Ombudsman
- European Ombudsman

## VALIDATION

- Sites Node tests 覆盖大众化文案、资源 URL 白名单、案例日期/来源、响应式/reduced-motion。
- 真实 Chrome 验证首页、权益指南、资源筛选、公司搜索、匿名辅导提交与 Agent 后续建议。
- console / network / page error 必须为 0。
- GitHub Actions 保持 Python 基线、旧 Node/HTTP 回归和 Sites candidate job 全部通过。

## RISK / BOUNDARY

- 权益指南不是法律意见；具体法律标准与时限必须回到用户所在地区。
- 案例/新闻不可被前端语义误写成对任意公司的事实结论。
- European Ombudsman 等资源适用范围必须明确，不得暗示可处理私人雇主的一般劳动争议。
- 不把外部资源称为“合作伙伴”除非未来获得可验证的正式合作授权。

## APPROVAL

用户已明确要求 UI 更大众化、具有支持、温暖与力量，同时增加现实案例、权益指导和国际/地区相关资源。该变更按当前授权实施。

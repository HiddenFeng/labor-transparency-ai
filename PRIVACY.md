# 隐私与数据边界

项目采用“**不必要就不收集；能留在本地就不联邦；能用摘要就不收原件**”的默认原则。本文件说明上游设计边界，不构成对所有独立实例适用法律义务的替代。

## 数据分层

### PUBLIC VERIFIED / REVIEWED

满足公开展示条件的主张、来源、公司/产品资料与证据状态。只有进一步满足独立再分发审批的条目才可进入公共 federation snapshot。

### PUBLIC UNVERIFIED

E0/E1 等明确标记未独立核实的讨论/线索。可以在本地公开，但“公开展示”不自动等于允许跨实例再分发。

### LOCAL PSEUDONYMOUS

session/owner hash、普通社区票、worker-perspective signal、信誉/审核关联等。默认属于本实例，不自动联邦。

### LOCAL PRIVATE

匿名辅导内容、私有 feedback/response、任何未来可能出现的敏感案件材料、联系方式、IP、访问日志等。核心 distribution 不把它们当 federation data。

## 核心产品不应收的敏感信息

当前匿名辅导和公开贡献不得主动索取：

- 真实姓名；
- 私人邮箱/电话/即时通信账号；
- 身份证件或员工证；
- 家庭详细住址；
- 健康、支付/银行卡信息；
- 能直接识别投诉人的敏感附件；
- 官方外部投诉渠道要求的实名材料。

12333、12348、欠薪等正式外部服务如果要求身份/联系方式，只向对应官方服务提供；不要复制到本项目匿名辅导或公开贡献。

## GitHub / issue 边界

公共 GitHub repo、Issue、PR、Discussion 都不是私密案件入口。不要上传真实工资单、身份证明、账户 token、未脱敏截图、保密材料或可还原具体劳动者身份的信息。

需要描述真实问题时，优先使用合成/最小化复现。当前上游没有对外承诺一个可接收敏感案件/安全材料的私密邮箱；不要虚构或猜测一个联系渠道。

## 联邦边界

第一版 federation snapshot 默认排除：

- owner/session/account linkage；
- community / worker ballots；
- private feedback/advisory；
- contacts / IP / private attachments；
- imported federation records；
- 未单独确认再分发条款的 official/machine/provider data。

Mirror 只复制已经 source-signed 的公共 snapshot；peer descriptor 只包含公开实例身份/公钥/最新 snapshot 和 mirror URL。

## 更正、撤回、保留

“可审计”不等于“正文永不可删”。

- 本地记录编辑后重新进入复核/再分发判断；
- 有公开纠错时暂停再分发；
- 撤回或失去授权时，从新的完整 public snapshot 中移除；
- federation receiver 的 tombstone 仅保留最小 logical ID、version、hash、snapshot root 与事件历史，不继续公开已撤正文；
- 法律要求的保留/删除由实际 operator 按适用规则处理并最小化范围。

## 日志与 Secrets

上游要求：

- Secret、Token、Cookie 不进入 Git、公开静态包或普通日志；
- POST body / 私人 case text 不应写入普通 access log；
- 公共错误不返回堆栈、本机路径或平台内部凭据；
- self-host Secrets/state 放在独立持久目录/volume，代码 release 不包含它们。

## Independent instance operator

一个 Fork/独立实例必须自行制定并公开适用于其地区/用户的 retention、日志、moderation 和 privacy notice。上游软件并不因为提供模板就自动承担下游用户数据控制/处理责任。

更完整 operator 清单见 `INSTANCE_OPERATORS.md`；开发者公网身份边界见 `docs/v0_8/PUBLIC_IDENTITY_PRIVACY.md`。

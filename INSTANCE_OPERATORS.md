# 独立实例运营者责任

运行一个 Fork / Independent Instance 意味着你在技术和运营上拥有自己的实例。上游提供软件、标准、测试和参考实现，**不会因为你的实例使用同一代码就自动成为你的服务器、用户数据或内容审核运营者。**

## 启动前

Operator 至少应确认：

- 使用自己的域名/服务器/部署账号；
- 生成并保护自己的 `instance.id`、Ed25519 key 与 runtime Secrets；
- Fork 不指向 reference production API/database/secrets；
- 明确公开实例名称与 operator，不冒充官方 Reference Instance；
- 阅读 `LICENSE`、`LICENSE-DATA.md`、`NON_COMMERCIAL_POLICY.md`；
- 根据所在地/服务对象建立适用的隐私、内容响应、备份和安全流程。

## 数据责任

Operator 负责自己实例的：

- session/user/community signal；
- public contribution/review；
- feedback/advisory；
- 日志与备份；
- peer trust store 和 federation imports；
- 当地用户发起的纠错/撤回/删除请求。

用户身份、session、社区/劳动者投票身份关联、私有 feedback/advisory、联系方式、IP 和敏感材料**不自动联邦**。不要因为上游存在 signed federation 就把私人数据镜像出去。Federation v1 只接受现有独立再分发 gate 已批准的公共 contribution。

## 内容治理

- 不把热度当事实；
- worker perspective、general community、concrete labour evidence 分开；
- E0 可讨论但必须保持未核实语义；
- 不出售排名、删除、曝光或“认证好雇主”；
- 不为企业或个人提供报复/黑名单功能；
- 遇到具体来源/主体绑定不确定时保持未知/候选状态。

## 安全与可用性

Operator 负责自己的：

- TLS / DNS / firewall；
- Secret rotation；
- 主机与依赖更新；
- 备份与恢复演练；
- 监控、告警、容量和事故响应；
- 独立实例可用性承诺。

当前 self-host FileStore runtime 不是多 writer 数据库，也不包含 Reference Instance 的 Cloudflare Queue/Cron 自动公司研究能力。不要把功能缺口写成已上线能力。

## Federation trust

Peer 必须由 operator 显式添加/信任。建议记录为什么信任该 source key、从哪里获得 descriptor，以及何时复核。

Mirror/URL/DNS 不是事实权威；source signature 也只证明“该 source instance 发布了这份 snapshot”，不会把 E0 升成 E3，也不会证明 source 的所有判断正确。

## 退出实例

如果你停止运营：

- 尽可能给本地用户明确停运/导出/纠错说明；
- 撤销不再使用的 Secrets/域名/部署 token；
- 根据适用规则处理本地私人数据；
- 公共 source-signed snapshot 可以按其授权继续存在于独立 mirrors，但撤回/tombstone 规则仍应被后续使用者尊重；
- 不要求上游接管你的私人用户数据库。

## 官方身份

Fork 应写明“Based on / Forked from Worker Manifest Fellowship / Labor Transparency”，而不是自称“官方中国站/官方地区站/官方认证节点”，除非获得明确的上游品牌授权。详见 `TRADEMARK.md` 与 `BRANDING.md`。

# 公开运营模型

本文件说明“这个项目是谁、谁运行什么、实例之间交换什么”。它不替代 `LICENSE`、`LICENSE-DATA.md`、`AGENTS.md` 或具体实例的适用法律义务。

## 1. Upstream Project

上游项目负责维护：

- 软件与测试；
- 证据/数据结构与隐私安全基线；
- 独立部署模板；
- 公共证据联邦协议；
- 文档、治理规则和 release 证据；
- Reference Instance 的公开基线。

上游**不默认承担**所有 Fork 的服务器、用户数据、地区内容审核、法律合规、备份或运营责任。

## 2. Reference Instance

当前公开 Reference Instance 是项目维护者用于验证产品与公共运营流程的实例。它不是整个项目的唯一中心，也不是所有 Fork 的后台。

Reference Instance 的 accepted production 状态必须以 `PROJECT_CONTINUITY.md` + `qa/v0_8/verification.json` 当前接受证据为准。本地 candidate、测试中的 federation/self-host 能力不得因为代码存在就写成 reference production 已上线。

## 3. Independent Instance

一个独立实例拥有自己的：

- `instance.id` 与 Ed25519 实例密钥；
- 数据库/FileStore/对象存储；
- session / reviewer / export / Agent secrets；
- 用户、社区信号与本地审核；
- 日志、备份、可用性和部署账户；
- 运营/隐私/内容处理责任。

Fork 不得默认请求上游生产 API、数据库或 Secret。当前 self-host release contract 允许代码 release 与持久实例目录分离，使升级代码不需要旋转实例身份或用户状态。

## 4. Public Evidence Network

第一版联邦只允许从现有 `publicDataset()` 独立再分发审批通过的记录生成源实例签名 snapshot。接收实例必须验证 source key、hash、signature、snapshot chain 与版本。

默认不交换：

- 用户/session/account linkage；
- general-community / worker-perspective ballot 身份关联；
- 私有 feedback / advisory；
- 联系方式、IP、私人附件、原始敏感材料；
- 从其他实例导入的 federation record（避免无控制多跳复制）；
- 尚未逐来源确认再分发权利的 official/machine/provider lanes。

Tombstone 保留最小 hash/version/root/history 证明，但不继续公开已撤正文。

## 5. Mirrors and peers

Mirror 是 source-signed snapshot 的**分发副本**，不是事实权威。`index.json`、manifest、DNS、Git 仓库、URL 数量都不会提高证据等级。

Peer descriptor 由 source instance key 签名；接收 operator 必须显式 trust。首次信任 pin source key，随后同 ID 换钥匙、descriptor rollback/conflict、snapshot chain gap 都失败关闭。

没有中心 registry 会自动告诉所有实例“谁可信”。

## 6. Discussion and evidence lanes

至少保持三条公开产品/公司信号分离：

1. **Worker Perspective**：参与者自报的在职/离职/求职/外包等劳动相关感受；不验证其劳动身份；
2. **General Community**：普通社区对公司的总体印象/关注；
3. **Concrete Labour Claims / Evidence**：具体主张，按来源、范围、时间和证据状态判断。

“劳工愤怒榜”“劳工支持榜”等只表达对应实例的情绪/感受视图，不能写成违法认定、好雇主认证、产品质量结论或平台强制购买/抵制指令。

## 7. Failure independence

目标是：

- Reference Instance 停止，不影响独立实例继续运行；
- 一个镜像退出，不影响其他镜像验证同一 source-signed snapshot；
- 一个社区退出，不自动删除其他实例依法、按授权持有的公共证据；
- 私有数据不因为容灾需要而被复制到公共镜像。

当前真实能力/缺口以 `PROJECT_CONTINUITY.md` 为准，不以本文件中的架构愿景替代运行证据。

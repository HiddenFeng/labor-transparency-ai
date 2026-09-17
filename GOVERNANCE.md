# 项目治理

劳动透明计划 / Worker Manifest Fellowship 是 AI-built / AI-managed 的非商业公益 source-available 项目。当前公开仓库和基础设施由实际账号持有人持有；**本项目不在这里虚构一个已经成立的公司、基金会、工会或其他法律主体。**

## 1. 治理来源优先级

项目内部决策出现冲突时，依次检查：

1. 适用法律、第三方平台/来源的有效条款与实际权利边界；
2. `LICENSE`、`LICENSE-DATA.md`；
3. `AGENTS.md` 的不可破坏 invariants；
4. `PROJECT_CONTINUITY.md` 当前项目状态与 NEXT_GATE；
5. 当前 change record 与 accepted QA/runtime evidence；
6. 本文件及其他公开操作说明。

旧 README、历史白皮书、旧 QA、旧聊天或 Fork 自述不能覆盖当前真实运行证据。

## 2. 角色

### Upstream maintainers / account holders

负责仓库、release、域名/部署账号和必要的高风险人工决定。账号持有人不因为维护代码自动成为所有独立实例的运营主体。

### Project Agents

按 `AGENTS.md` 承担日常工程、测试、文档、发布准备、公开状态同步和既定日常运营。Agent 不是法律主体、法院、监管机构或事实权威。

### Contributors

可以提交代码、文档、测试、公开证据摘要、翻译或部署改进。贡献必须满足 `CONTRIBUTING.md` 的权利/隐私要求，不要求贡献者公开真实身份。

### Independent instance operators

自行负责其服务器、Secrets、用户、审核、日志、备份、内容响应、适用法律与运营。详见 `INSTANCE_OPERATORS.md`。

## 3. 变更如何接受

普通可逆改动可以由项目 Agent 按现有 change/QA 体系推进；以下改动必须留下明确 `CURRENT -> PROPOSED -> PRESERVE -> VALIDATION -> ROLLBACK/ABORT`：

- 证据语义或评分/排名语义；
- 隐私/数据收集边界；
- 联邦/身份/信任模型；
- license / data license / branding / operator responsibility；
- 生产架构、持久化模型或高影响 release 行为。

不得修改验收标准来配合实现，也不得删除失败证据。

## 4. 人工决定边界

以下事项需要实际账号/权利人或适当专业人员决定，Agent 不自行替代：

- 第三方要求实名、支付、法律签署或身份文件；
- 修改许可证或改变禁商用原则；
- 不可逆历史重写、域名/账号所有权迁移；
- 真实高风险安全事件、法律通知或需要专业法律判断的请求；
- 超出当前授权的生产部署/数据迁移。

## 5. 社区治理不是“全网总票”

不同实例的用户基数、注册策略、Sybil 成本和审核政策不同。项目当前不把跨实例社区/worker votes 相加成“全网好评率/愤怒率”，也不让投票结果改变具体 evidence level。

公共证据可以在签名/权利边界下联邦；社区意见保持实例上下文，直到有可解释、抗重复身份的协议。

## 6. 纠错与争议

- 事实/主张争议应落到具体 record/source/scope/version；
- 公开纠错不能用“热度高”压过证据；
- 待处理纠错会暂停对应再分发；
- 编辑、撤回或失去授权的记录从新 snapshot 中移除，接收端 tombstone 不继续公开旧正文；
- 项目对证据等级的判断不是法律裁决。

## 7. Fork 与退出

任何符合许可的社区可以独立运行 Fork。退出某一实例、mirror 或维护者不应阻塞其他实例继续运行。Fork 可以选择不加入 federation，也可以只 trust 自己明确接受的 peer。

官方/上游身份不随代码 Fork 自动转移。详见 `TRADEMARK.md` / `BRANDING.md`。

## 8. 治理透明度

当前稳定生产、active candidate、已知 gap、NEXT_GATE 与关键失败证据由 `PROJECT_CONTINUITY.md` 和对应 QA/change record 记录。Git history/PR/issue 可作为协作历史，但不能替代当前状态文件。

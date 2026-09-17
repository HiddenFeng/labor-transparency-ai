# 参与劳动透明计划

这是仅供非商业公益目的使用的 source-available 项目，不是 OSI Open Source。提交前阅读 `LICENSE`、`LICENSE-DATA.md`、`CODE_OF_CONDUCT.md`、`PRIVACY.md` 与 `SECURITY.md`。仅提交自己有权授权的原创代码、摘要或允许再分发的材料；第三方代码保留许可，不复制无授权全文。

## 普通用户

在公司空间选择“共建资料”，可提交公司事实、产品、品牌/合作关系、劳动经历主张、产品相关主张。公司尚未建档时先登记即可。没有来源也可以提交E0。可一次输入一条，或以JSON批量提交1—50条。整批通过字段校验才保存；用户不能自行填写E3/E5。

公开展示和公益再分发是不同选项，默认均不勾选。可只保存私密草稿；不要求先公开个人经历。选择公开时先移除私人身份、员工编号、精确排班等组合识别信息。使用笔名是自愿的；默认以匿名贡献者署名。当前已有公开 Reference Instance，但核心边界仍是不接收上述真实敏感资料；公开仓库/Issue 也不是私密案件入口。具体当前生产能力与 candidate 状态以 `PROJECT_CONTINUITY.md` 为准。

## 核验与再分发复核

具体部署可以使用受信 review/export 凭据、Agent 或独立人工审计，但生产可用性不依赖某个具名核验员。核验必须围绕来源与主张一一对应、覆盖部门/地点/期间、支持与反对信息。E3及以上必须记录具体范围、起止时间、所用来源和真实性检查。E5必须有支持同一主张的相关有效正式认定，而不是单纯提交或受理回执。

证据复核与公益再分发复核是两件事：进入 federation/public dataset 前还要检查隐私、可再识别风险、权利与独立再分发同意。出现纠错时记录针对性的理由，而不是为了保留榜单强行通过；编辑、纠错、撤回会暂停或停止后续再分发。

## 工程贡献

先新增能重现问题的合成测试，再做最小修改。运行README中的测试。不要提交`local-data/`、数据库、密钥、会话、真实工资单或浏览器个人资料。不要将失败测试删掉来通过持续集成，不要关闭后端阶段开关、权限检查或脱敏边界来完成演示。

提交代码或文档时，应明确声明：本人拥有相应权利；同意本贡献按项目当前公益用途许可公开；已说明引入的第三方依赖与许可。不要以签署贡献协议为名收集身份证件。发起人的代码接受不等于法律主体已经完成设立。

## 不建议通过公开Issue提交

真实劳动争议、举报人身份、保密合同、账户问题、泄露详情和可以还原个人的截图。公开仓库没有替代平台私密入口的安全保证。在正式私密报告渠道建立之前，使用合成描述，不上传真实证据。


## Independent instance / federation 贡献

修改独立部署、联邦、mirror 或 peer trust 时，必须同时阅读 `OPERATING_MODEL.md`、`INSTANCE_OPERATORS.md` 与 `docs/v0_8/INDEPENDENT_INSTANCES_AND_FEDERATION.md`。不得把用户数据库做成 federation payload，不得让 mirror/URL 数量升级 evidence level，也不得让 Fork 默认请求 reference production API/Secret。

## 品牌与署名

Fork 可以如实写 “Based on Worker Manifest Fellowship / Labor Transparency”，并保留上游许可与 Git attribution；未经明确授权不要自称“官方地区站/官方认证节点”。详见 `AUTHORS.md`、`TRADEMARK.md`、`BRANDING.md`。

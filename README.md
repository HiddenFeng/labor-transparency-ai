# 劳动透明计划 · 当前生产基线 v0.8.8-rc.1

**公开源码：** https://github.com/HiddenFeng/labor-transparency-ai

**公开站点：** https://workermanifestfellowship.dpdns.org

**平台回退：** https://workermanifestfellowship.vercel.app

**Cloudflare API：** https://labor-transparency-api.labor-transparency-public.workers.dev

**运营方式：** AI 制作、AI Agent 日常管理；非商业公益用途。

当前生产已经从早期本地/只读原型演进为 **Vercel 静态前端 + Cloudflare Worker/D1 + Cloudflare Queue/Cron + 项目 DNS** 的独立公网系统。`v0.8.8-rc.1` 已通过核心用户流程浏览器验收、发布 CI、部署后自动公司研究 E2E、精确 QA 清理和公开语义 smoke，作为当前审计过的可用基线。中国大陆稳定访问 SLA 仍不声明；腾讯云/EdgeOne 仅保留历史 PoC，不是当前完成条件。

平台始终遵循：E0讨论可正常传播；热度与证据等级分离；公司资料不完整不阻止已开放的社区或匿名帮助能力；社区贡献、官方来源引用/关系/事件和自动研究输出属于不同证据 lane。缺失或零结果保持未知/范围受限，不能被写成“没有问题”或“没有关系”。

新 Agent / 新对话接管时，**先读 `AGENTS.md` 与 `PROJECT_CONTINUITY.md`**，再验证当前 Git、版本、`qa/v0_8/verification.json` 最新接受证据和必要的真实运行状态。不要从旧 README 段落、历史白皮书、旧 QA 或旧 handoff 推断当前 NEXT_GATE。

## 当前 v0.8.8 核心能力

当前公司资料产品建立在无人值守 Queue/D1 链上：列表提供简洁摘要，详情页将社区声音、机器参考事实、开放知识上下文、官方 reference/relation/event、公共记录事件候选、用户贡献、资料缺口、来源覆盖与更新时间分层展示。研究按司法区选择适用来源；不适用来源明确为 `NOT_APPLICABLE`。China-first 路径已经加入 source-scoped 调查索引、严格 SSE/SZSE 主体绑定、NMPA/SAMR/CSRC bounded collectors、北京时间 18:00/19:00 日常运营，以及中国大陆官方劳动/法律/欠薪帮助资源。Python back office 继续只作可选离线审计，不是生产可用性依赖。

- 公司讨论空间与去重正/负社区评价；
- 产品、公司资料、关系、劳动实践和产品体验的公开贡献；
- E0 默认公开但未独立核实；E2+/E3+/E5 的证据升级约束；
- 用户自己的修改、撤回与公开纠错；
- 证据审核与公益再分发审核相互独立；
- 高证据展示和公开数据快照遇到待处理纠错会自动暂停；
- Cloudflare D1 持久化、Worker 重启恢复、CORS/CSRF 边界与公开字段隐私预检；
- 匿名辅导/代办：去身份化非敏感摘要 → 一次性回执 → Agent 待办 → 私有建议 → 聚合公开日报；
- 自动公司研究覆盖矩阵：把“找到来源候选 / 确定性身份与信任规则 / 机器参考事实或来源信号 / 候选与未知”分开，不把搜索命中直接当成公司事实；
- 公司详情 API 与可分享 `#company/<id>` 资料页：合并自动资料、社区评价和公开贡献，但保持证据层级、未知与来源边界；
- `SOURCE_EVENT_CANDIDATE` 时间线：只公开每类劳工/执法记录允许展示的程序字段和 caveat，不透出 raw provider record；
- `OPEN_KNOWLEDGE_CONTEXT`：用确定性名称/地区/官网/组织结构信号绑定开放知识上下文；它永远不是工商登记或法律认定的替代品；
- 已接入或完成适配的来源包括 GLEIF、Wikidata、SEC EDGAR、NLRB、OSHA、DOL WHD、FMCS F-7 / work stoppages、NLRB voluntary recognition、DOL OLMS 与 USAspending；OpenCorporates / Open Supply Hub 保留为需要 token/许可复核的可选来源；
- 用户新建真实公司空间后会立即写入 `QUEUED` 并投递 Cloudflare Queue；Queue Consumer 以单并发、单消息批次串行采集。唯一精确 GLEIF 法律名称 + 可解析且一致的国家提示 + 有效 LEI 校验码，可自动形成窄范围 `MACHINE_VERIFIED_REFERENCE`；劳动/执法/集体关系等精确名称记录只形成带程序语义限制的 `SOURCE_SIGNAL`。歧义/冲突自动降级，不等待指定人员。刷新会完整重算并自动撤回失去当前来源支持的机器事实；主 Queue 重试耗尽后进入 DLQ，DLQ consumer 把耗尽状态持久化到 D1，5 分钟与每日兜底任务再按 failureCount 退避自动重投主队列。

匿名辅导**不是私密敏感信息服务**。当前不收集真实姓名、私人联系方式、身份证明、家庭详细住址、健康/支付信息或敏感附件，也不自动代用户向外部机构提交。若未来需要全自动持续跟进，必须另行建立专门联系渠道和私密数据处理协议；当前站点不收集该联系方式，也不会虚构一个已存在的联系渠道。

独立部署本地验证：

```sh
./scripts/deployment/verify_cloudflare_local.sh
./scripts/deployment/verify_cloudflare_research_live.sh
npm --prefix sites-app test
LTP_PUBLIC_API_BASE=http://127.0.0.1:8790 node deploy/frontend/build.mjs
node scripts/deployment/privacy_audit.mjs deploy/frontend/dist
```

部署与中国大陆访问边界直接阅读 `docs/v0_8/DEPLOYMENT_ARCHITECTURE.md`、`docs/v0_8/MAINLAND_CHINA_ACCESS.md`、`docs/v0_8/DEPLOYMENT_RUNBOOK.md`。当前生产主链固定为 **GitHub + Vercel + Cloudflare Worker/D1 + DigitalPlat DNS**。项目域名 `workermanifestfellowship.dpdns.org` 已完成 HiddenFeng Vercel 的所有权/DNS 验证。当前网络对 Vercel/Workers 的中国大陆直连仍不可靠，因此项目不承诺中国大陆 SLA。历史 EdgeOne PoC 继续作为证据保留，但根据隐私决策，腾讯云/EdgeOne 已从必需部署链和 NEXT_GATE 移除；项目不会为了大陆加速要求账号持有人向腾讯云提交实名、身份或支付信息。

自动公司资料研究已经从单一 GLEIF 扩展为多源：法律主体/母公司以 GLEIF 为 identity root；美国公开申报可用 SEC EDGAR；业务/产品/总部上下文可由绑定后的 Wikidata 补充；美国劳动侧可采集 NLRB 案件、OSHA 检查、WHD 已结案合规行动、FMCS 集体谈判通知与停工记录、NLRB voluntary recognition、OLMS employer/consultant disclosure；USAspending 可提供具体联邦 award / 政府客户关系候选。**这仍不等于“全球所有公司所有数据已完整收集”**：不同国家、公司类型和栏目覆盖不同，Open Supply Hub / OpenCorporates 等来源仍受 token、订阅或许可前置条件约束。机器可读来源矩阵见 `docs/v0_8/source-registry.json`，确定性审计见 `qa/v0_8/company-intelligence-audit.json`，真实有限联网证据见 `qa/v0_8/live-company-sources.json`、`qa/v0_8/live-company-intelligence.json` 与 `qa/v0_8/cloudflare-live-research.json`。

## AI 制作与 AI 管理

本项目公开声明为 **AI-built / AI-managed** 的非商业公益项目：日常工程、测试、版本整理、问题分流、发布准备、公开状态同步和公告默认交给项目 Agent 执行。根目录 `AGENTS.md` 是 Agent 运行约束；`agents/PROJECT_MANAGER_AGENT.md` 负责项目主线，`agents/SOCIAL_ANNOUNCEMENT_AGENT.md` 专门负责公开信息与公告。

“AI 管理”不意味着 AI 是法律主体，也不意味着 AI 可以替代证据、监管机构、法院或律师。第三方平台账号和相关权利仍归其真实账号/权利人；Agent 只能在已授权边界内操作，并必须把社区热度、证据强度、公司/产品/具体劳动实践和私密数据严格分开。

## 先读

- `PROJECT_CONTINUITY.md`：当前唯一项目接管/连续性摘要；包含用户目标、需求演化、当前状态、反复错误、治理写回规则和 NEXT_GATE。
- `AGENTS.md`：所有 Agent 的强制冷启动协议与不可破坏 invariants。
- `docs/v0_8/CHANGE-v0.8.8-production-usability-hardening.md` + `qa/v0_8/verification.json` 最新接受段：当前生产接受证据。
- `docs/v0_8/DEPLOYMENT_ARCHITECTURE.md`：v0.8 独立前后端架构与安全边界。
- `docs/v0_8/MAINLAND_CHINA_ACCESS.md`：中国大陆访问边界，以及不依赖中国云实名/支付信息的当前策略。
- `docs/v0_8/PUBLIC_IDENTITY_PRIVACY.md`：公网开发者身份与部署隐私策略。
- `docs/v0_8/ACCOUNT_MIGRATION_AND_PUBLICATION.md`：HiddenFeng GitHub/Vercel 迁移、公开仓库净化历史与部署隐私决策。
- `docs/v0_8/DEPLOYMENT_RUNBOOK.md`：Cloudflare / Vercel / DigitalPlat 当前生产部署步骤；EdgeOne 仅保留历史可选实验说明。
- `docs/v0_8/COMPANY_DATA_AUTOMATION.md`：自动公司资料的数据类别、来源层级、复核规则和仍未覆盖的边界。
- `docs/v0_7/交付与验收.md`、`qa/v0_7/verification.json`：上一阶段 v0.7.2 的 UI/业务基线证据。
- `docs/v0_6/交付与验收.md`：v0.6.1 稳定版的历史运行与安全验收。
- `docs/v0_6/调度与运营运行.md`：批次执行、心跳、失败恢复和上线边界。
- `qa/v0_6/verification.json`：机器可读验证摘要。
- `qa/v0_6/browser/result.json`：实际浏览器阻断记录。
- `qa/v0_6/live-source.json`：实际GLEIF联网检查结果。

v0.1—v0.7文档保留演进历史；账号隐私迁移后，旧 GitHub Pages 阶段镜像不再作为当前公开入口。当前公开交互服务以 v0.8.8 的 Vercel/Cloudflare 公网部署、`PROJECT_CONTINUITY.md` 和 `qa/v0_8` 最新接受证据为准；项目域名已在 Vercel 配置验证。中国大陆稳定访问仍未建立，也不再以腾讯云账户补全、实名、支付方式或 EdgeOne 接入作为项目完成条件；若未来重新选择中国大陆本地/加速服务，将作为单独的隐私与合规决策重新评估。

## 启动

支持 Python 3.9+；CI会覆盖3.9与3.13。本轮已在macOS系统Python 3.9.6和Homebrew Python 3.12.14实测依赖安装与完整Python测试。

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python scripts/run_local.py --phase assistance
```

只有显式指定允许公开研究和网络访问时，才能主动访问真实企业公开来源。普通前台页面不会因为打开而自行联网或发布。

## 有限研究调度

单次无网络维护循环（默认最安全，可发布已到期且已复核结果、更新通知和心跳）：

```sh
python scripts/research_scheduler.py --once
```

显式授权真实来源访问后运行一次有限循环：

```sh
python scripts/research_scheduler.py --once --network --max-jobs 3 --daily-budget 20
```

常驻循环只提供程序能力，不代表已经安装系统服务：

```sh
python scripts/research_scheduler.py --loop --interval-seconds 300
```

生产环境必须另行配置进程管理、监控、重启策略、凭据和出站网络。后台 `/#research` 会显示最近调度心跳、逾期任务数和来源暂停状态；没有近期心跳时明确显示没有活跃调度器。

## 验证

```sh
python -m unittest discover -s tests -v
python scripts/make_ui_fixture.py /tmp/ltp-ui.json
node tests/test_ui_render.cjs /tmp/ltp-ui.json
node tests/test_research_ui.cjs /tmp/ltp-ui.json
python scripts/make_community_fixture.py /tmp/ltp-community-ui.json
node tests/test_community_ui.cjs /tmp/ltp-community-ui.json
node tests/test_offline.cjs
python scripts/smoke_research_http.py --out /tmp/research-http.json
python scripts/smoke_community_http.py --out /tmp/community-http.json
python scripts/check_static_http.py
```

当前Mac已经完成真实Chrome桌面与窄视口点击验收，真实GLEIF单请求连通与搜索结构也已通过；这些只证明本地浏览器链和当前公开来源适配器可用，不代表生产认证、反滥用、申诉外部提交或长期来源稳定性已经完成。详见 `docs/v0_6/交付与验收.md`。

## 本地运行数据备份与恢复演练

`runtime_backup.py` 对SQLite使用一致性备份API，并把私密附件密钥作为独立文件纳入校验。备份目录默认权限0700，数据库、密钥和清单0600；清单记录SHA-256，校验时会执行SQLite `quick_check`，存在私密附件时还会真实解密并核对附件哈希。

```sh
python scripts/runtime_backup.py create --db local-data/demo.sqlite3 --out /安全位置/ltp-backup-001
python scripts/runtime_backup.py verify --backup /安全位置/ltp-backup-001
python scripts/runtime_backup.py drill --db local-data/demo.sqlite3
```

恢复属于高影响操作，默认拒绝覆盖现有数据库，并要求显式确认服务已停止：

```sh
python scripts/runtime_backup.py restore --backup /安全位置/ltp-backup-001 --target-db /恢复位置/restored.sqlite3 --service-stopped
```

只有确实需要替换现有数据库时再加 `--replace`；脚本会先创建安全备份再替换。当前备份仍是**本地明文运维备份**：附件本体在数据库内加密，但案件事实等数据库字段并未整体加密，因此生产环境仍需独立的异地备份加密、密钥托管、保留策略和恢复权限控制。

## 历史 v0.6 Python 生产候选（非当前公网主链）

以下内容保留用于解释 v0.6 的本地安全/恢复基线，不是当前 v0.8.8 Cloudflare Worker/D1 生产部署方案。该历史链本地验证使用 `app.server:app`，其独立 Python 生产候选使用 `app.production:app` 与失败关闭的生产配置预检：

```sh
python scripts/check_production_config.py
```

生产候选要求精确Host/HTTPS/Origin、Secure+HttpOnly+SameSite会话、会话绑定CSRF、请求限流和最小安全审计；管理API还必须配置精确 `LTP_ADMIN_ALLOWED_IPS`，不允许通配或CIDR。附件上传默认关闭；只有显式配置 `LTP_ATTACHMENT_UPLOADS=clamav` 且提供真实可执行 `LTP_CLAMSCAN_PATH` 后才会开放，扫描结果为 `CLEAN` 才能保存。扫描通过不等于材料真实性已经核验。

当前Mac的受控staging已经进一步实测真实 Caddy 2.11.4 反向代理、macOS launchd 故障后自动拉起、ClamAV 1.5.4 + daily签名库，以及生产管理员精确IP白名单。Caddy/后端和launchd演练均只绑定回环并在结束后清理；ClamAV只扫描合成文件。仍未验证正式CA证书生命周期、DNS/防火墙、目标服务器systemd/容器、长期FreshClam调度、Secret Manager/MFA、外部监控和异地灾备。部署模板位于 `deploy/`，完整边界见 `docs/v0_6/生产安全入口.md`。

## 本轮 staging 进展

当前受控staging已从自建测试代理继续推进到真实Caddy、macOS launchd故障恢复与真实ClamAV生产附件门；详细结果见 `docs/v0_6/本轮staging追加.md`、`qa/v0_6/caddy-staging.json`、`qa/v0_6/launchd-supervision.json`、`qa/v0_6/clamav-real.json`。这些结果仍只属于本机生产候选验证，不代表公网或目标生产服务器已经通过。

## 更新现有本地目录

v0.6包内的 `scripts/apply_to_local.py` 默认目标是 `~/Downloads/labor_transparency_v0_5`、默认 `--from-version v0.5`，但**默认仅预检**：

```sh
python scripts/apply_to_local.py
```

只有确认旧服务已经停止，并且预检无冲突后才显式执行：

```sh
python scripts/apply_to_local.py --apply --service-stopped
```

脚本支持v0.2—v0.5真实发布包作为基线，发生本地改动即拒绝覆盖；运行数据和证据密钥会单独备份。SHA-256用于内容一致性检查，不是数字签名。

## 发布边界

源码公开继续遵循本项目公益用途许可证，禁止商业化和其他非公益用途；这不是OSI定义的开源许可证。当前 Vercel + Cloudflare Worker/D1 + 项目 DNS 交互生产链已真实上线，但敏感附件/真实私密案件、自动外部机构提交和中国大陆稳定 SLA 仍不属于当前能力。任何新 release 必须按 `AGENTS.md`、`PROJECT_CONTINUITY.md`、当前 change record 和 `qa/v0_8` 的证据门执行，不能用“源码已公开”或“测试通过”替代对应生产证据。

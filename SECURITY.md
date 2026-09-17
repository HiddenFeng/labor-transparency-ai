# Security Policy

本项目把“fail closed”作为默认安全原则。安全控制不能为了 demo、部署便利、联邦同步或“一键运行”而静默关闭。

## 当前保护边界

- same-origin API + exact Origin/Host/CSRF；
- HttpOnly / SameSite session cookie；
- self-host 可配置精确 Host allowlist；
- CSP、frame denial、nosniff、referrer/security headers；
- 独立实例 Secrets/state 与代码 release 分离；
- federation source-key pinning、hash/signature/chain/version 校验；
- FileStore import/pull/backup/restore 采用显式 stopped-service 门，避免第二 writer 覆盖内存状态；
- 非 loopback federation fetch 需显式网络授权，拒绝 plaintext HTTP、redirect、credential/query/fragment URL，并限制大小/超时；
- public mirror/index/manifest 不被视为事实权威。

## 不要通过公共 GitHub 发送

- API/Cloudflare/Vercel/GitHub/DNS tokens；
- session/cookie/receipt bearer code；
- 私钥/备份；
- 真实劳动者身份证明、工资单、联系方式或可识别截图；
- 需要保密的漏洞利用材料和真实用户数据。

## 报告安全问题

当前仓库没有声明一个可以接收敏感漏洞材料的统一私密上游邮箱。因此：

1. **非敏感、可公开重现**的问题可用合成数据在 GitHub Issue/PR 中提交；
2. 如果问题需要 Secret、真实用户数据或未公开 exploit 才能说明，**不要把这些内容放到公共 Issue**；
3. 对具体独立实例，优先使用该 operator 已公开的安全联系渠道；
4. 对 GitHub/Cloudflare/Vercel/DNS 等第三方平台自身漏洞，使用对应平台的正式安全渠道；
5. 上游未来建立专用私密安全联系入口后，应在此文件明确更新，不得由 Agent 临时编造地址。

## Self-host 最低要求

公共部署应：

- 让 app 保持在回环或私有容器网络，使用反向代理终止 TLS；
- HTTPS 部署保持 secure cookie；
- 配置精确的 public Host allowlist；
- 使用独立持久 volume / backup，不把 `secrets.json` 放进镜像或 repo；
- 升级前停服备份 + preflight，升级后 healthcheck；
- 不直接公开 reviewer/export/Agent token；
- 不把 FileStore 当成支持多 writer 的数据库。

`deploy/self-host/README.md` 给出当前本地验证过的发行/备份/恢复边界。真实 DNS、防火墙、CA 证书生命周期、监控和异地灾备必须由下游环境自己验证。

## Federation / mirror threat model

- mirror 可恶意、过期或损坏；因此读取时始终重新验证 source-signed snapshot；
- peer descriptor URL/DNS 可被劫持；因此 operator 显式 trust 后 pin source key；
- 同 ID 换 key、descriptor rollback、snapshot chain gap、版本倒退全部拒绝；
- imported evidence 不自动再出口，避免无控制复制和信任洗白；
- 多个 mirror 重复同一内容不会提高 evidence level。

## Secret incident

若 Secret 意外进入 Git/log/build：立即停止使用并在对应平台旋转/撤销；不要只删除工作区文件后继续使用旧 Secret。若公开 Git history 已传播，视为泄露而不是“后来删掉就安全”。

## 支持期限

上游只对 `PROJECT_CONTINUITY.md` 指向的当前 accepted production / active candidate 做事实性维护声明。历史版本保留工程证据，不保证持续安全支持。

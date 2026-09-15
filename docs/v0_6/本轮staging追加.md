# v0.6 当前生产运行门追加记录

日期：2026-09-14。总体状态仍为 `LOCAL_CANDIDATE_NOT_PRODUCTION`。本文件记录当前受控 staging 的最新事实，覆盖此前“仅有自建测试代理、未验证系统级恢复、未验证真实ClamAV”的旧状态。

## 1. 真实 Caddy 反向代理

当前Mac已安装并实际运行 Homebrew Caddy 2.11.4。`scripts/check_caddy_staging.py` 使用真实Caddy二进制在回环地址终止TLS，再反向代理到独立Uvicorn生产ASGI进程；测试证书由临时私有CA签发并由客户端真实校验。实测 `/api/health` 返回200，错误Host由应用拒绝为403，缺CSRF的变更请求403，正确同源CSRF请求200；Secure/HttpOnly/SameSite Cookie、HSTS和CSP经过Caddy链仍存在。测试结束后Caddy和后端监听均关闭，没有启动持久Caddy服务，也没有建立公网监听。

这证明“真实Caddy二进制 + 可信同机代理 + 生产应用”的基础运行链已经在本机受控staging成立。它不证明公网DNS、正式CA证书签发/续期或生产防火墙已经完成。

## 2. macOS launchd 进程守护与故障恢复

`scripts/check_launchd_supervision.py` 创建一次性用户级LaunchAgent，使用 `KeepAlive=true` 管理生产ASGI后端，并通过独立TLS代理观察健康。第一次直接从Downloads运行时，macOS后台LaunchAgent因隐私边界无法读取项目 `.venv/pyvenv.cfg`；没有降低系统权限或绕过该边界，而是把当前 `app` 与 `.venv` 精确复制到权限收紧的临时staging目录再运行。

最终演练中：初始生产健康检查通过；受控终止后端PID后，launchd自动产生新PID；生产健康恢复，最近一次恢复耗时约1.2秒；演练结束后执行bootout，后端与代理端口均关闭，临时目录删除。该结论只覆盖当前Mac的用户级launchd恢复能力，不等于目标Linux服务器上的systemd/容器恢复已经验证。

## 3. 真实 ClamAV 与生产附件门

当前Mac已安装ClamAV 1.5.4，并通过FreshClam实际取得 `daily.cvd`；`clamscan --version` 显示签名版本28123。直接真实扫描中，普通合成文本返回CLEAN，标准无害EICAR杀毒测试签名返回 `Eicar-Test-Signature FOUND`/INFECTED。

`scripts/check_real_clamav.py` 进一步把真实 `/opt/homebrew/bin/clamscan` 接入生产配置和真实应用代码路径：生产配置接受绝对可执行扫描器路径；合成私密事项的干净附件通过扫描后写入并记录 `scan_engine=clamav`；EICAR附件在入库前被拒绝，数据库中的附件数量没有增加。测试只使用合成文件，从未扫描用户文件。

当前不能扩大为“ClamAV生产运维完成”：已确认真实引擎、daily签名库和生产上传门，但FreshClam长期定时更新、镜像长期可用性、main/bytecode数据库完整生命周期、签名保留策略和并发扫描性能仍需运维门验证。

## 4. 管理入口受限运营网络

本轮将生产管理员边界从“管理员Bearer凭据 + CSRF + 限流”加强为“上述机制 + 必填精确运营IP白名单”。生产配置现在必须设置 `LTP_ADMIN_ALLOWED_IPS`，只接受精确IPv4/IPv6，不允许 `*`、CIDR或主机名；任何 `/api/admin...` 请求都会在管理员凭据判断之前检查实际客户端地址，不在白名单即403。通过反向代理时仍由Uvicorn只信任显式 `forwarded_allow_ips`，应用本身不接受任意客户端伪造转发头。

变更边界：这是安全权限收紧，不改变社区、证据、私密求助、研究或发布语义；本地模式不受影响。回滚只需移除该生产配置要求和中间件网络门，但只有出现真实不可兼容的运营网络架构时才应考虑，不能为了上线方便改成通配来源。该网络门不替代后续独立运营身份/MFA。

## 5. 当前结论与下一门

当前受控staging已经真实覆盖：生产ASGI、真实Caddy反向代理、私有CA TLS、Host/Origin/CSRF、安全Cookie、真实macOS launchd故障恢复、真实ClamAV/daily签名库、生产附件入库前扫描，以及管理员精确网络白名单。所有这些验证都只绑定回环或TestClient，没有公网发布。

仍未完成的发布门主要收敛到：正式/公共CA证书签发与续期、DNS与防火墙；目标服务器上的systemd/容器守护与文件权限；FreshClam长期更新和扫描容量；受保护Secret管理与独立运营身份/MFA；外部监控告警/日志留存；异地加密备份、保留策略、RPO/RTO和容量；更系统的PII/版权审核；多来源长期可靠性；真实申诉渠道受控提交。上述门完成前，不执行GitHub推送或公网部署。

机器可读证据：`qa/v0_6/caddy-staging.json`、`qa/v0_6/launchd-supervision.json`、`qa/v0_6/clamav-real.json`，以及本轮完成后更新的 `qa/v0_6/verification.json`。

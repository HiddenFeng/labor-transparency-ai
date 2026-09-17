import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicReleaseReadiness,REQUIRED_PUBLIC_GOVERNANCE_FILES,REQUIRED_GITHUB_GOVERNANCE_FILES,PUBLIC_SITE_POLICY_MIRRORS} from './public_release_readiness.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFile(path.join(ROOT,rel),'utf8');

test('public governance package is substantive and keeps license/project/operator boundaries explicit',async()=>{
  for(const rel of REQUIRED_PUBLIC_GOVERNANCE_FILES){const stat=await fs.stat(path.join(ROOT,rel));assert.ok(stat.size>80,`${rel} must not be placeholder`)}
  for(const rel of REQUIRED_GITHUB_GOVERNANCE_FILES){const stat=await fs.stat(path.join(ROOT,rel));assert.ok(stat.size>80,`${rel} must not be placeholder`)}
  for(const [source,mirror] of PUBLIC_SITE_POLICY_MIRRORS)assert.equal(await read(mirror),await read(source),`${mirror} must mirror ${source}`);
  const license=await read('LICENSE'),nonCommercial=await read('NON_COMMERCIAL_POLICY.md'),governance=await read('GOVERNANCE.md'),operating=await read('OPERATING_MODEL.md');
  assert.match(license,/不是OSI认可的开源许可证/);assert.match(nonCommercial,/法律授权范围以 `LICENSE`/);assert.match(nonCommercial,/禁止方向/);
  assert.match(governance,/不在这里虚构一个已经成立/);assert.match(governance,/PROJECT_CONTINUITY\.md/);assert.match(operating,/Reference Instance/);assert.match(operating,/Independent Instance/);assert.match(operating,/Public Evidence Network/);
});

test('privacy, security and branding rules reject sensitive GitHub intake, federation identity leakage and official impersonation',async()=>{
  const privacy=await read('PRIVACY.md'),security=await read('SECURITY.md'),brand=await read('TRADEMARK.md'),operators=await read('INSTANCE_OPERATORS.md'),conduct=await read('CODE_OF_CONDUCT.md');
  assert.match(privacy,/公共 GitHub repo/);assert.match(privacy,/默认属于本实例，不自动联邦/);assert.match(privacy,/tombstone/);
  assert.match(security,/不要通过公共 GitHub/);assert.match(security,/不得由 Agent 临时编造地址/);assert.match(security,/FileStore import\/pull\/backup\/restore/);
  assert.match(brand,/不声称.*商标注册/);assert.match(brand,/官方中国站/);assert.match(operators,/不会因为你的实例使用同一代码就自动成为/);assert.match(conduct,/doxxing/);
});

test('README and contribution guidance separate accepted Reference scope from still-local/public-network gaps',async()=>{
  const readme=await read('README.md'),contributing=await read('CONTRIBUTING.md'),release=await read('RELEASE_POLICY.md');
  assert.match(readme,/Reference production/);assert.match(readme,/v0\.9\.0-rc\.1/);assert.match(readme,/Phase O scope/);assert.match(readme,/不等于真实公网多节点网络已上线/);assert.match(readme,/Docker Hub base-image 拉取路径超时/);
  assert.doesNotMatch(contributing,/当前版本仍是本地合成数据验收环境/);assert.match(contributing,/公开仓库\/Issue 也不是私密案件入口/);assert.match(release,/Local Candidate \/ Locally Validated/);assert.match(release,/Accepted Production/);assert.match(release,/v0\.9\.0-rc\.1/);
});

test('machine release-readiness requires the current production-acceptance ledger before reporting accepted production',async()=>{
  const result=await publicReleaseReadiness();assert.equal(result.status,'PUBLIC_GOVERNANCE_READY_ACCEPTED_PRODUCTION',JSON.stringify(result.failures));assert.equal(result.version,'v0.9.0-rc.1');assert.equal(result.acceptedProduction,'v0.9.0-rc.1');assert.equal(result.phaseOCandidateProductionAccepted,true);assert.equal(result.sourcePublicationPassed,true);assert.equal(result.productionAcceptancePassed,true);assert.equal(result.forbiddenTracked.length,0);assert.match(result.dockerContainerE2E,/BLOCKED/);assert.equal(result.nextGate,'REAL_USER_OR_OPERATIONS_EVIDENCE_FIRST');
});

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
export const REQUIRED_PUBLIC_GOVERNANCE_FILES=[
  'MISSION.md','OPERATING_MODEL.md','NON_COMMERCIAL_POLICY.md','GOVERNANCE.md','PRIVACY.md','SECURITY.md',
  'INSTANCE_OPERATORS.md','TRADEMARK.md','BRANDING.md','AUTHORS.md','CODE_OF_CONDUCT.md','NOTICE','RELEASE_POLICY.md',
  'CONTRIBUTING.md','LICENSE','LICENSE-DATA.md','AGENTS.md','PROJECT_CONTINUITY.md'
];
export const REQUIRED_GITHUB_GOVERNANCE_FILES=['.github/ISSUE_TEMPLATE/config.yml','.github/ISSUE_TEMPLATE/bug_report.yml','.github/ISSUE_TEMPLATE/feature_request.yml','.github/PULL_REQUEST_TEMPLATE.md'];
export const PUBLIC_SITE_POLICY_MIRRORS=[['LICENSE','public-site/LICENSE.txt'],['LICENSE-DATA.md','public-site/LICENSE-DATA.md'],['CONTRIBUTING.md','public-site/CONTRIBUTING.md']];
async function read(rel){return fs.readFile(path.join(ROOT,rel),'utf8')}
async function exists(rel){try{await fs.stat(path.join(ROOT,rel));return true}catch(err){if(err?.code==='ENOENT')return false;throw err}}
function git(...args){const out=spawnSync('git',args,{cwd:ROOT,encoding:'utf8'});if(out.status!==0)throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`);return out.stdout.trim()}

export async function publicReleaseReadiness(){
  const missing=[];const tooSmall=[];
  for(const rel of REQUIRED_PUBLIC_GOVERNANCE_FILES){if(!await exists(rel)){missing.push(rel);continue}const stat=await fs.stat(path.join(ROOT,rel));if(stat.size<80)tooSmall.push(rel)}
  for(const rel of REQUIRED_GITHUB_GOVERNANCE_FILES){if(!await exists(rel)){missing.push(rel);continue}const stat=await fs.stat(path.join(ROOT,rel));if(stat.size<80)tooSmall.push(rel)}
  const pkg=JSON.parse(await read('sites-app/package.json'));const version=String(pkg.version||'');const qa=JSON.parse(await read('qa/v0_8/verification.json'));
  const readme=await read('README.md');const continuity=await read('PROJECT_CONTINUITY.md');const release=await read('RELEASE_POLICY.md');const change=await read('docs/v0_8/CHANGE-federated-public-interest-network-and-product-labor-signals.md');
  const acceptedMatch=continuity.match(/Accepted product runtime at this continuity update: `([^`]+)`/);const acceptedVersion=acceptedMatch?.[1]||'';
  const phaseOAccepted=acceptedVersion===version;
  const productionAcceptance=qa?.candidate_v090_phase_o_reference_production_acceptance;
  const productionAcceptancePassed=productionAcceptance?.status==='PASS_DEPLOYED_BROWSER_SMOKE_MANUAL_E2E_EXACT_CLEANUP_V090';
  const failures=[];
  if(missing.length)failures.push(`missing governance files: ${missing.join(', ')}`);if(tooSmall.length)failures.push(`empty/placeholder governance files: ${tooSmall.join(', ')}`);
  for(const [label,text] of [['README',readme],['PROJECT_CONTINUITY',continuity],['RELEASE_POLICY',release]])if(!text.includes(`v${version}`)&&!text.includes(`\`${version}\``))failures.push(`${label} does not name current v${version} source/runtime candidate`);
  if(!acceptedVersion)failures.push('PROJECT_CONTINUITY does not name accepted production runtime independently from source/runtime candidate');
  if(phaseOAccepted){
    if(!productionAcceptancePassed)failures.push('PROJECT_CONTINUITY claims current source/runtime as accepted production without the matching v0.9 production-acceptance QA ledger');
    if(!readme.includes('Phase O scope')||!readme.includes('不等于真实公网多节点网络已上线'))failures.push('README does not distinguish accepted Phase O Reference scope from still-local/public-network gaps');
    if(!change.includes('Production impact in this work round: `REFERENCE_PRODUCTION_ACCEPTED_2026_09_18`')||!change.includes('## CURRENT ACCEPTANCE TRANSITION — 2026-09-18'))failures.push('active change does not carry the explicit accepted-production evidence transition');
  }else{
    if(!readme.includes('Phase O local candidate')||!readme.includes('尚未进入 Reference Instance production acceptance'))failures.push('README does not distinguish local Phase O candidate from reference production');
    if(!change.includes('Production impact in this work round: `NONE_UNTIL_SEPARATE_DEPLOYMENT_ACCEPTANCE`'))failures.push('active change no longer carries explicit production gate');
  }
  if(!release.includes('Local Candidate / Locally Validated')||!release.includes('Accepted Production'))failures.push('release policy status taxonomy incomplete');
  if(!readme.includes('Docker Hub')||!change.includes('Docker Hub'))failures.push('bounded Docker Hub container-E2E gap is not preserved publicly');
  if(!readme.includes('不是 OSI Open Source')&&!readme.includes('不是 OSI'))failures.push('README could misrepresent non-commercial source-available license as OSI open source');
  const tracked=git('ls-files').split('\n').filter(Boolean);const forbiddenTracked=tracked.filter(rel=>rel==='.ltp-instance'||rel.startsWith('.ltp-instance/')||rel.endsWith('/secrets.json')||rel.endsWith('/peers.json')||rel==='deploy/self-host/.env'||rel.includes('/backups/'));
  if(forbiddenTracked.length)failures.push(`tracked runtime/private self-host artifacts: ${forbiddenTracked.join(', ')}`);
  const docs={};for(const rel of REQUIRED_PUBLIC_GOVERNANCE_FILES)if(await exists(rel))docs[rel]=await read(rel);
  if(!docs['PRIVACY.md']?.includes('公共 GitHub repo')||!docs['PRIVACY.md']?.includes('LOCAL PRIVATE'))failures.push('privacy policy missing GitHub/private-data boundary');
  if(!docs['SECURITY.md']?.includes('不要通过公共 GitHub')||!docs['SECURITY.md']?.includes('没有声明一个可以接收敏感漏洞材料'))failures.push('security policy may imply unsafe public/private reporting');
  if(!docs['TRADEMARK.md']?.includes('不声称')||!docs['TRADEMARK.md']?.includes('官方中国站'))failures.push('brand policy does not preserve no-registration/no-official-impersonation boundary');
  if(!docs['AUTHORS.md']?.includes('HiddenFeng')||!docs['AUTHORS.md']?.includes('No invented entity'))failures.push('attribution policy missing public initiator/no-invented-entity statement');
  if(!docs['INSTANCE_OPERATORS.md']?.includes('上游提供软件')||!docs['INSTANCE_OPERATORS.md']?.includes('不自动联邦'))failures.push('instance operator responsibility/federation privacy boundary incomplete');
  for(const [source,mirror] of PUBLIC_SITE_POLICY_MIRRORS){if(await exists(source)&&await exists(mirror)){if(await read(source)!==await read(mirror))failures.push(`public-site policy mirror drift: ${mirror} != ${source}`)}}
  const bugTemplate=await exists('.github/ISSUE_TEMPLATE/bug_report.yml')?await read('.github/ISSUE_TEMPLATE/bug_report.yml'):'';const prTemplate=await exists('.github/PULL_REQUEST_TEMPLATE.md')?await read('.github/PULL_REQUEST_TEMPLATE.md'):'';if(!bugTemplate.includes('Do not submit secrets')||!bugTemplate.includes('Privacy confirmation'))failures.push('GitHub bug template lacks explicit sensitive-data gate');if(!prTemplate.includes('undeployed/local candidate as production/stable')||!prTemplate.includes('No secret, token'))failures.push('GitHub PR template lacks release/privacy scope checks');
  const sourcePublicationPassed=qa?.candidate_v090_phase_o_reference_release_prep?.source_publication_ci?.status==='PASS_VERSIONED_SOURCE_CANDIDATE_PUBLICATION_CI';
  const nextGate=phaseOAccepted?'REAL_USER_OR_OPERATIONS_EVIDENCE_FIRST':sourcePublicationPassed?'REFERENCE_PRODUCTION_RELEASE_GATE':'VERSIONED_SOURCE_CANDIDATE_PUBLICATION_AND_CI_BEFORE_REFERENCE_PRODUCTION_RELEASE_GATE';
  const status=failures.length?'NOT_READY':phaseOAccepted?'PUBLIC_GOVERNANCE_READY_ACCEPTED_PRODUCTION':'PUBLIC_GOVERNANCE_READY_SOURCE_CANDIDATE';
  return {status,version:`v${version}`,acceptedProduction:acceptedVersion?`v${acceptedVersion}`:'UNKNOWN',phaseOCandidateProductionAccepted:phaseOAccepted,sourcePublicationPassed,productionAcceptancePassed,governanceFiles:REQUIRED_PUBLIC_GOVERNANCE_FILES.length,githubGovernanceFiles:REQUIRED_GITHUB_GOVERNANCE_FILES.length,publicSitePolicyMirrors:PUBLIC_SITE_POLICY_MIRRORS.length,missing,tooSmall,forbiddenTracked,failures,dockerContainerE2E:'BLOCKED_BY_EXTERNAL_DOCKER_HUB_PULL_PATH',nextGate};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const result=await publicReleaseReadiness();console.log(JSON.stringify(result,null,2));if(result.status==='NOT_READY')process.exitCode=1;}

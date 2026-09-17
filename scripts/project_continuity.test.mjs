import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));

test('single live continuity route distinguishes source candidate from accepted production',()=>{
  const versions=['sites-app/package.json','cloudflare-backend/package.json','deploy/frontend/package.json']
    .map(p=>json(p).version);
  assert.equal(new Set(versions).size,1,`runtime package versions diverged: ${versions.join(', ')}`);
  const candidateVersion=versions[0];
  const continuity=read('PROJECT_CONTINUITY.md');
  assert.match(continuity,/Status: `CURRENT_CANONICAL_CONTINUITY`/);
  assert.ok(continuity.includes(`Active source/runtime candidate at this continuity update: \`${candidateVersion}\``));
  const accepted=continuity.match(/Accepted product runtime at this continuity update: `([^`]+)`/);
  assert.ok(accepted?.[1],'continuity must name the independently accepted production runtime');
  assert.notEqual(accepted[1],'UNKNOWN');
  assert.ok(continuity.includes('CHANGE-v0.8.8-production-usability-hardening.md'));
  assert.ok(continuity.includes('qa/v0_8/verification.json'));
  for(const required of ['用户真实意图','需求与架构为什么一步步变成现在这样','当前真实系统架构','当前生产接受状态','已经反复发生过的错误','当前 NEXT_GATE','每个 Agent 的项目治理写回规则','可复制的固定接管指令']){
    assert.ok(continuity.includes(required),`continuity missing cold-start section: ${required}`);
  }
});

test('optional local handoff cannot compete with canonical continuity',()=>{
  const handoffPath=path.join(root,'HANDOFF_MANIFEST.json');
  if(!fs.existsSync(handoffPath)) return;
  const handoff=JSON.parse(fs.readFileSync(handoffPath,'utf8'));
  assert.equal(handoff.status,'POINTER_ONLY_NOT_CURRENT_STATE');
  assert.equal(handoff.current_continuity,'PROJECT_CONTINUITY.md');
  assert.equal(handoff.current_governance,'AGENTS.md');
  assert.equal(handoff.current_evidence_ledger,'qa/v0_8/verification.json');
  assert.equal(handoff.current_accepted_change,'docs/v0_8/CHANGE-v0.8.8-production-usability-hardening.md');
  for(const p of [handoff.current_continuity,handoff.current_governance,handoff.current_evidence_ledger,handoff.current_accepted_change]){
    assert.ok(fs.existsSync(path.join(root,p)),`missing handoff target: ${p}`);
  }
  if(handoff.historical_integrity_manifest){
    assert.ok(fs.existsSync(path.join(root,handoff.historical_integrity_manifest)),`missing local archived handoff: ${handoff.historical_integrity_manifest}`);
  }
});

test('cold-start governance routes new agents through continuity before historical state',()=>{
  const agents=read('AGENTS.md');
  const manager=read('agents/PROJECT_MANAGER_AGENT.md');
  const readme=read('README.md');
  assert.ok(agents.includes('Mandatory cold-start takeover protocol'));
  assert.ok(agents.includes('PROJECT_CONTINUITY.md'));
  assert.ok(manager.includes('single live cold-start/continuity summary'));
  assert.ok(readme.includes('先读 `AGENTS.md` 与 `PROJECT_CONTINUITY.md`'));
});

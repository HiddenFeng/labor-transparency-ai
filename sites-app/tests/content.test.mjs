import test from 'node:test';
import assert from 'node:assert/strict';
import {ISSUE_GUIDES,PUBLIC_CASES,RESOURCE_GROUPS,RESOURCE_DISCLAIMER,SOURCE_NOTE} from '../public/editorial-content.js';

test('worker-facing guidance is complete and action-oriented',()=>{
  assert.equal(ISSUE_GUIDES.length,6);
  for(const item of ISSUE_GUIDES){
    assert.ok(item.title.length>=6);
    assert.ok(item.feeling.length>=6);
    assert.equal(item.steps.length,3);
    assert.ok(item.steps.every(x=>x.length>=8));
    assert.ok(item.resourceTags.length>=1);
  }
});

test('public cases are dated, sourced, and only point to HTTPS primary/official sources',()=>{
  assert.ok(PUBLIC_CASES.length>=4);
  for(const item of PUBLIC_CASES){
    assert.match(item.date,/^2026-\d{2}-\d{2}$/);
    assert.ok(item.summary.length>=40);
    assert.ok(item.takeaway.length>=30);
    const u=new URL(item.url);
    assert.equal(u.protocol,'https:');
    assert.ok(['www.dol.gov','www.workersrights.org'].includes(u.hostname));
  }
  assert.match(SOURCE_NOTE,/不会因为一篇报道或外部调查就自动给某家公司下结论/);
});

test('external resource directory uses official HTTPS links and explicitly denies partnership claims',()=>{
  const allowedHosts=new Set(['www.ilo.org','www.workersrights.org','www.ituc-csi.org','www.dol.gov','www.osha.gov','www.nlrb.gov','workersunited.org','www.acas.org.uk','www.fairwork.gov.au','www.ombudsman.europa.eu']);
  const all=RESOURCE_GROUPS.flatMap(g=>g.items);
  assert.ok(all.length>=10);
  for(const item of all){const u=new URL(item.url);assert.equal(u.protocol,'https:');assert.ok(allowedHosts.has(u.hostname),`unexpected host ${u.hostname}`);assert.ok(item.description.length>=20);assert.ok(item.for.length>=10)}
  assert.match(RESOURCE_DISCLAIMER,/不代表.*合作/);
  assert.match(RESOURCE_DISCLAIMER,/以其官方说明为准/);
});

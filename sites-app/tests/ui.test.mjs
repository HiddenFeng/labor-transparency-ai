import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {seedState,reviewQueue} from '../src/domain.mjs';

test('public UI is worker-facing, preserves privacy/evidence boundaries, and has no inline handlers',async()=>{
  const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/工作里的委屈/);
  assert.match(html,/先匿名说说我的情况/);
  assert.match(html,/社区意见 ≠ 事实/);
  assert.match(html,/个案正文不公开/);
  assert.match(html,/当前不提供私密信息服务/);
  assert.match(html,/不收集联系方式/);
  assert.match(html,/不让“很多人都这么说”冒充证据/);
  assert.match(html,/AI 管理不是 AI 裁决/);
  assert.match(html,/资源与帮助/);
  assert.match(html,/真实世界里的劳动事件/);
  assert.match(html,/<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
  assert.doesNotMatch(html,/\son(?:click|submit|change|input)=/i);
  assert.doesNotMatch(html,/type=["']file["']/i);
});

test('responsive/reduced-motion CSS is present for public-facing interactions',async()=>{
  const css=await fs.readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/\.issue-grid/);
  assert.match(css,/\.story-rail/);
});

test('company UI exposes automatic research lifecycle and safe candidate-detail presentation',async()=>{
  const js=await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const css=await fs.readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(js,/已进入自动采集队列/);
  assert.match(js,/正在自动采集公开来源/);
  assert.match(js,/查看自动收集的公开来源候选/);
  assert.match(js,/候选不会自动变成公司事实/);
  assert.match(js,/researchPollRemaining=36/);
  assert.match(js,/公司空间已创建，并已自动进入公开资料采集队列/);
  assert.doesNotMatch(js,/\.records\b/);
  assert.match(css,/\.research-details/);
  assert.match(css,/\.research-preview-list/);
});

test('system demo records never enter the operational review queue',()=>{
  const state=seedState();
  assert.equal(state.contributions.length,1);
  assert.equal(reviewQueue(state).length,0);
});

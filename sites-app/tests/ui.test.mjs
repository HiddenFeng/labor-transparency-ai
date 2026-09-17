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
  assert.match(html,/产品与劳工信号/);
  assert.match(html,/劳工愤怒榜/);
  assert.match(html,/劳动者视角 = 自报感受/);
  assert.match(html,/平台要求任何人抵制或购买/);
  assert.match(html,/独立实例与联邦能力不等于公共多节点网络已上线/);
  assert.doesNotMatch(html,/当前 v0\.8\.8/);
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
  assert.match(css,/\.company-detail-dialog/);
  assert.match(css,/\.company-detail-top\{grid-template-columns:1fr\}/);
  assert.match(css,/\.product-grid/);
  assert.match(css,/\.product-signals/);
  assert.match(css,/\.audience-entry-grid/);
});

test('company UI exposes usable dossier detail while keeping evidence tiers separate',async()=>{
  const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const css=await fs.readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(html,/id="company-detail-dialog"/);
  assert.match(js,/已进入自动采集队列/);
  assert.match(js,/正在自动采集公开来源/);
  assert.match(js,/自动资料已更新/);
  assert.match(js,/查看完整资料/);
  assert.match(js,/当前资料概览/);
  assert.match(js,/社区总体印象/);
  assert.match(js,/劳动者视角与实际劳动主张/);
  assert.match(js,/机器可验证的窄范围参考事实/);
  assert.match(js,/开放知识上下文（不是工商登记）/);
  assert.match(js,/来源信号（不是公司结论）/);
  assert.match(js,/公开记录时间线（事件候选）/);
  assert.match(js,/上下文候选（不自动当事实）/);
  assert.match(js,/当前资料缺口 \/ 未知/);
  assert.match(js,/自动候选聚类/);
  assert.match(js,/地区不适用/);
  assert.match(js,/root\.append\(text\('p',detail\.boundary,'detail-boundary'\)\)/);
  assert.match(js,/\/api\/companies\/\$\{encodeURIComponent\(companyId\)\}/);
  assert.match(js,/\/api\/research\/health/);
  assert.match(js,/查看自动收集的公开来源候选/);
  assert.match(js,/researchPollRemaining=36/);
  assert.match(js,/公开资料会自动开始整理，你不用再做设置/);
  assert.match(js,/官方登记参考/);assert.match(js,/官方来源确认的公司 \/ 品牌 \/ 产品关系/);
  assert.match(js,/中国企业调查概览/);assert.match(js,/官方监管 \/ 召回事件/);assert.match(js,/产品召回/);assert.match(js,/行政处罚决定/);
  assert.match(js,/没有命中不会显示成“没有问题”/);assert.match(js,/政府采购/);assert.match(js,/全国自动官方覆盖仍有限/);
  assert.doesNotMatch(js,/\.records\b/);
  assert.match(css,/\.research-details/);
  assert.match(css,/\.research-preview-list/);
  assert.match(css,/\.machine-intelligence/);
  assert.match(css,/\.event-timeline/);
  assert.match(css,/\.company-dossier-teaser/);
  assert.match(css,/\.china-investigation-grid/);assert.match(css,/\.official-event-timeline/);assert.match(css,/\.china-source-coverage/);
});

test('contribution UI is low-friction with progressive disclosure and daily feedback loop',async()=>{
  const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const css=await fs.readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(html,/不用填报告/);assert.match(html,/1 选公司/);assert.match(html,/一句话说重点/);assert.match(html,/我有公开来源、时间或更多细节（可选）/);
  assert.match(html,/今天平台更新了什么/);assert.match(html,/一句话就够/);assert.match(html,/每天 18:00/);assert.match(html,/19:00/);
  assert.doesNotMatch(html,/name="rights"/);assert.doesNotMatch(html,/name="shareConsent"/);assert.doesNotMatch(html,/name="rightsNote"/);
  assert.match(js,/rights:sourceUrl\?'reference_only':'own_summary'/);assert.match(js,/\/api\/community-feedback/);assert.match(js,/\/api\/announcements/);
  assert.doesNotMatch(js,/await loadCompanies\(\);await loadHomeLive\(\)/,'boot must not reload company options twice and race a user selection');
  assert.match(js,/const current=select\.value;select\.replaceChildren\(\)/);assert.match(js,/if\(current&&\[\.\.\.select\.options\]\.some\(x=>x\.value===current\)\)select\.value=current/);
  assert.match(js,/dataset\.companyContribute/);assert.match(js,/补充这家公司资料/);assert.match(js,/openContributionForCompany/);
  assert.match(js,/companyShareUrl\(companyId\)/);assert.match(js,/#company\/\$\{encodeURIComponent\(companyId\)\}/);assert.match(js,/复制资料链接/);
  assert.match(js,/\/api\/product-market/);assert.match(js,/signalType:'worker'/);assert.match(js,/劳动者视角信号已更新/);assert.match(js,/workerPerspective/);assert.match(js,/labourEvidence/);
  assert.doesNotMatch(js,/companyShareUrl[\s\S]{0,300}(csrf|session|cookie|searchParams)/i,'share URL must not include private/session state');
  assert.match(css,/\.progressive-details/);assert.match(css,/\.feedback-quick-grid/);assert.match(css,/\.official-relation-card/);
});

test('system demo records never enter the operational review queue',()=>{
  const state=seedState();
  assert.equal(state.contributions.length,1);
  assert.equal(reviewQueue(state).length,0);
});

/* Node VM units ONLY. Test generated HTML, routing and form payloads, not browser layout. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),fixture=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const dom={addEventListener(){},querySelector(){return null},setAttribute(){},classList:{toggle(){return false}}};
let calls=[];
const sandbox={console,URL,URLSearchParams,crypto:require('crypto').webcrypto,setTimeout,clearTimeout,
 location:{hash:'#discover'},document:{querySelector(){return dom},addEventListener(){}},window:{addEventListener(){}},
 fetch:async(url,opt)=>{const key=String(url).replace('/api','');calls.push({key,opt});
  if(opt?.method==='POST')return {ok:true,json:async()=>({id:'con_submit'})};
  if(!(key in fixture))throw Error('missing fixture '+key);return {ok:true,json:async()=>structuredClone(fixture[key])};}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'app/web/community.js'),'utf8'),sandbox);
let source=fs.readFileSync(path.join(root,'app/web/app.js'),'utf8').replace("window.addEventListener('hashchange',render);render();","window.addEventListener('hashchange',render);");
vm.runInContext(source,sandbox);vm.runInContext('config='+JSON.stringify(fixture['/config']),sandbox);
const ids=fixture._ids;
(async()=>{
 let passed=0;const check=(name,cond)=>{assert(cond,name);passed++;console.log('PASS',name);};
 const specs=[['positive','discoverPage(new URLSearchParams())','社区好评'],['negative','discoverPage(new URLSearchParams("lane=community_negative"))','还没有符合条件'],['evidence','discoverPage(new URLSearchParams("lane=evidence_positive"))','有证据支持的具体实践'],['form',`contributePage('${ids.company}')`,'提交这条贡献'],['edit',`contributePage('','${ids.contribution}')`,'保存新版本'],['my-contributions','contributionsPage()','我的贡献'],['detail',`contributionDetail('${ids.contribution}')`,'来源与支持范围'],['company-data',`companyContributions('${ids.company}')`,'补充公司'],['public-data','dataPage()','当前可再分发 1 条记录'],['review','reviewPage()','资料核验工作台']];
 let outputs={};for(const [name,expr,expected] of specs){const html=await vm.runInContext(expr,sandbox);outputs[name]=html;check(name+' content',html.includes(expected));check(name+' safe-render',!html.includes('undefined')&&!html.includes('<script>alert(1)</script>'));}
 check('E0 product not rendered E3',outputs.positive.includes('E0 · 待核验'));
 check('separate source support',outputs.evidence.includes('E3 · 范围内已核验'));
 check('sample notice',outputs.positive.includes('投票样本少'));
 check('optional source does not block no-source contribution',!/name="source_supports"[^>]*required/.test(outputs.form));
 check('no default public grant',!/name="public"[^>]*checked/.test(outputs.form));
 check('no default data grant',!/name="share_consent"[^>]*checked/.test(outputs.form));
 check('reviewer sees private corrections',outputs.review.includes('仅供核验员的私密纠错测试'));
 check('detail does not show private corrections',!outputs.detail.includes('仅供核验员'));
 check('redistribution requires second person',outputs.review.includes('第二人'));
 fixture['/review-role']={can_review:false};check('review unavailable to ordinary accounts',(await vm.runInContext('reviewPage()',sandbox)).includes('没有核验权限'));
 vm.runInContext('config.capabilities.showcase=false',sandbox);check('stage closed',(await vm.runInContext('discoverPage(new URLSearchParams())',sandbox)).includes('准备开放'));
 vm.runInContext('config.capabilities.showcase=true',sandbox);
 const values=new Map(Object.entries({company_id:ids.company,kind:'product',title:'测试产品',description:'测试描述',direction:'neutral',dimension:'other',rights:'reference_only',consent:'on'}));
 sandbox.form={id:'contribution-form',dataset:{},classList:{contains(){return false}}};sandbox.formData={get:k=>values.get(k),has:k=>values.has(k)};
 await vm.runInContext('submitCommunityForm(form,formData)',sandbox);const call=calls.at(-1),payload=JSON.parse(call.opt.body);
 check('form no artificial source',payload.sources.length===0);check('form explicit grants false',!payload.public&&!payload.share_consent);check('form never elevates evidence',!('evidence' in payload));
 const document=fs.readFileSync(path.join(root,'app/web/index.html'),'utf8');check('shared renderer loaded',document.includes('community.js'));check('no inline click handlers',!document.includes('onclick='));
 console.log(JSON.stringify({passed,scope:'Node VM HTML/payload units; no browser layout verification'}));
})().catch(e=>{console.error(e);process.exitCode=1;});

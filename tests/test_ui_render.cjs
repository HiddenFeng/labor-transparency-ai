/* Renderer unit tests in a Node VM. No browser navigation or visual verification. */
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const fixture=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const domStub={addEventListener(){},querySelector(){return null},setAttribute(){},classList:{toggle(){return false}}};
const sandbox={console,URL,URLSearchParams,crypto:require('crypto').webcrypto,setTimeout,clearTimeout,
 location:{hash:'#home'},document:{querySelector(){return domStub},addEventListener(){}},window:{addEventListener(){}},
 fetch:async(url,opts)=>{if(url==='/assets/whitepaper.html')return {ok:true,text:async()=>fs.readFileSync(path.join(root,'app/web/whitepaper.html'),'utf8')};
  const key=String(url).replace('/api','').split('?')[0];if(!(key in fixture))throw new Error('missing fixture '+key);
  return {ok:true,json:async()=>JSON.parse(JSON.stringify(fixture[key]))};}};
vm.createContext(sandbox);
let source=fs.readFileSync(path.join(root,'app/web/app.js'),'utf8').replace("window.addEventListener('hashchange',render);render();","window.addEventListener('hashchange',render);");
vm.runInContext(source,sandbox);
vm.runInContext('config='+JSON.stringify(fixture['/config']),sandbox);
const {cid,pid,kid}=fixture._ids;
const checks=[
 ['homepage','home()','查公司'],['directory','companiesPage(new URLSearchParams())','公开公司空间'],
 ['search-empty','companiesPage(new URLSearchParams("q=不存在的公司"))','还没有这家公司的空间'],
 ['register','registerPage()','建立公司入口'],['existing-register',`registerPage('${cid}')`,'青禾'],
 ...['overview','relations','discussion','conditions','responses'].map(t=>['company-'+t,`companyPage('${cid}','${t}')`,'青禾']),
 ['community','community(new URLSearchParams())','真实声音'],['compose',`compose('${cid}')`,'没有附件'],
 ['post',`postPage('${pid}')`,'这是一条正常补充'],['rankings','rankings(new URLSearchParams())','参与账号'],
 ['help','helpPage()','不必一个人'],['new-case',`newCase('${cid}')`,'默认仅你可见'],['case',`casePage('${kid}')`,'下载完整材料包'],
 ['mine','mine()','我的空间'],['account','accountPage(new URLSearchParams())','登录'],['signup','accountPage(new URLSearchParams("mode=signup"))','创建体验账号'],
 ['features','features()','提交我的建议'],['plan','plan()','完整建设，分阶段开放'],['whitepaper','whitepaper()','完整白皮书'],['privacy','privacy()','公开与私密分开'],
 ['admin-login','manage()','本地管理凭据']
];
(async()=>{let count=0;for(const [name,expression,expected] of checks){const html=await vm.runInContext(expression,sandbox);assert(html.includes(expected),name+' missing expected content');assert(!html.includes('undefined'),name+' leaked undefined');assert(!html.includes('<script>alert(1)</script>'),name+' did not escape user content');count++;console.log('PASS',name);}
 vm.runInContext("adminToken='fixture-only';",sandbox);const admin=await vm.runInContext('manage()',sandbox);assert(admin.includes('开放阶段'));count++;console.log('PASS admin-render');
 vm.runInContext('config.capabilities={};',sandbox);for(const name of ['community(new URLSearchParams())','rankings(new URLSearchParams())',`newCase('${cid}')`,`compose('${cid}')`]){assert((await vm.runInContext(name,sandbox)).includes('尚未开放')||(await vm.runInContext(name,sandbox)).includes('准备开放'));count++;console.log('PASS stage-closed',name);}
 const css=fs.readFileSync(path.join(root,'app/web/styles.css'),'utf8');assert(css.includes('@media(max-width:540px)'));assert(css.includes('prefers-reduced-motion'));count++;console.log('PASS responsive-rules-exist-only');
 const html=fs.readFileSync(path.join(root,'app/web/index.html'),'utf8');assert(html.includes('lang="zh-CN"'));assert(html.includes('aria-live="polite"'));assert(!html.includes('onclick='));count++;console.log('PASS static-document-semantics');
 console.log(JSON.stringify({passed:count,scope:'Node VM renderer and static unit tests ONLY; no layout or browser clicks verified'}));})().catch(e=>{console.error(e);process.exitCode=1;});

"""Browser acceptance entry point for the authorized local Mac. NOT run successfully here.
Requires an installed Playwright browser. Never changes browser policy or retries via a bypass.
"""
import argparse,json,time,uuid,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:8765');p.add_argument('--out',default='qa/browser-local');p.add_argument('--full',action='store_true');args=p.parse_args()
 if not args.url.startswith(('http://127.0.0.1:','http://localhost:')):raise SystemExit('只对明确的本机服务运行测试')
 out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 result={'status':'RUNNING','url':args.url,'checks':[],'errors':[],'screenshots':[]}
 def check(label,condition):
  result['checks'].append({'name':label,'passed':bool(condition)})
  if not condition:raise AssertionError(label)
 try:
  with sync_playwright() as driver:
   browser=driver.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None)
   ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
   page=ctx.new_page();page.on('pageerror',lambda e:result['errors'].append(str(e)))
   page.goto(args.url,wait_until='networkidle',timeout=20000)
   page.locator('h1').wait_for();check('homepage meaningful',bool(page.locator('h1').text_content()))
   page.screenshot(path=str(out/'home-desktop.png'),full_page=True);result['screenshots'].append('home-desktop.png')
   page.get_by_label('搜索公司、品牌或工厂').fill('没有这个公司'+uuid.uuid4().hex[:6])
   page.get_by_role('button',name='查公司').click();page.get_by_text('还没有这家公司的空间').wait_for()
   check('search empty state',page.get_by_text('还没有这家公司的空间').is_visible())
   page.goto(args.url+'/#register');page.get_by_label('公司、品牌或工厂名称').fill('浏览器验收（虚构）'+uuid.uuid4().hex[:6]);page.get_by_label('所在国家 / 地区或城市').fill('示例地区')
   page.get_by_label('将公司名称和地区加入公开目录。我的身份及具体需求不会随之公开。').check()
   page.get_by_label('我理解这是体验环境，只使用虚构公司和测试内容。').check()
   page.get_by_role('button',name='建立公司入口').click();page.get_by_text('公司入口已经建立。').wait_for();check('registration receipt',True)
   page.get_by_role('link',name='进入公司空间').click();page.locator('.company-header').wait_for();cid=page.url.split('#company/')[1].split('/')[0]
   config=ctx.request.get(args.url+'/api/config').json()
   if args.full:
    check('all implemented modules opened for internal test',config['phase']=='assistance')
    page.get_by_role('link',name='分享经历').click();page.get_by_label('用一句话概括').fill('零附件也能正常分享')
    page.get_by_label('具体发生了什么？').fill('仅用于本地浏览器验收的虚构工作经历。')
    page.get_by_role('button',name='先预览公开内容').click();check('public preview visible',page.locator('#post-preview').is_visible())
    page.get_by_label('我已检查内容，愿意将这段经历公开，并理解这不是向机构提交申诉。').check()
    page.get_by_role('button',name='公开这份经历').click();page.locator('.article-head').wait_for();check('E0 post published','E0' in page.locator('.article-head').text_content())
    page.get_by_label('写下你的回复').fill('这是一条验收回复。');page.get_by_role('button',name='发布回复').click();page.locator('.reply').wait_for();check('reply visible',True)
    page.goto(args.url+'/#newcase/'+cid);page.get_by_label('给这件事起一个标题').fill('私密材料验收')
    page.get_by_label('你目前知道的事实').fill('仅本地测试私密事实，不是实际案件。');page.get_by_label('你希望解决什么问题').fill('验证零附件材料导出')
    page.get_by_role('button',name='保存到我的私密空间').click();page.get_by_text('目前没有附件。仍可以生成如实说明材料缺口的陈述草稿。').wait_for(state='visible')
    with page.expect_download() as download:page.get_by_role('link',name='下载陈述草稿').click()
    check('material download',bool(download.value.suggested_filename))
   page.set_viewport_size({'width':390,'height':844});page.goto(args.url);page.locator('h1').wait_for()
   check('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
   page.get_by_role('button',name='展开导航').click();check('mobile menu opened',page.locator('#navigation').is_visible())
   page.screenshot(path=str(out/'home-mobile.png'),full_page=True);result['screenshots'].append('home-mobile.png')
   check('no uncaught page errors',not result['errors'])
   browser.close();result['status']='PASSED_REQUESTED_FLOWS'
 except Exception as exc:
  result['status']='BLOCKED' if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(exc) else 'FAILED'
  result['error']=str(exc)
 finally:(out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(json.dumps(result,ensure_ascii=False,indent=2))
 if result['status']!='PASSED_REQUESTED_FLOWS':raise SystemExit(2)
if __name__=='__main__':main()

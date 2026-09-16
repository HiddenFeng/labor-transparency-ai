import unittest

from scripts.community_agent import cn_samr_recall_daily as recall


INDEX = b'''<!doctype html><ul>
<li><a href="./202608/t20260821_115889.html" title="\xe5\xb0\x8f\xe7\xb1\xb3\xe6\xb1\xbd\xe8\xbd\xa6\xe7\xa7\x91\xe6\x8a\x80\xe6\x9c\x89\xe9\x99\x90\xe5\x85\xac\xe5\x8f\xb8\xe5\x8f\xac\xe5\x9b\x9e\xe9\x83\xa8\xe5\x88\x862024\xe6\xac\xbe\xe5\xb0\x8f\xe7\xb1\xb3\xe7\x89\x8cSU7\xe7\xb3\xbb\xe5\x88\x97\xe7\xba\xaf\xe7\x94\xb5\xe5\x8a\xa8\xe6\xb1\xbd\xe8\xbd\xa6\xef\xbc\x88\xe4\xb8\x80\xef\xbc\x89">exact</a><span>2026-08-21</span></li>
<li><a href="./202608/t20260821_999999.html" title="\xe5\xb0\x8f\xe7\xb1\xb3\xe6\xb1\xbd\xe8\xbd\xa6\xe7\xa7\x91\xe6\x8a\x80\xe6\x9c\x89\xe9\x99\x90\xe5\x85\xac\xe5\x8f\xb8\xe5\xad\x90\xe5\x85\xac\xe5\x8f\xb8\xe5\x8f\xac\xe5\x9b\x9e\xe6\x9f\x90\xe4\xba\xa7\xe5\x93\x81">fuzzy</a><span>2026-08-21</span></li>
</ul>'''

DETAIL = '''<!doctype html><html><body>
<div class="TRS_Editor">召回编号：S2026M0096V</div>
<table>
<tr><td>生产者名称</td><td>小米汽车科技有限公司</td></tr>
<tr><td>召回实施时间</td><td>2026-08-21至2027-08-21</td></tr>
<tr><td>召回车辆总数量</td><td>339069辆</td></tr>
<tr><td>缺陷描述</td><td>车内应急机械拉手不易识别，极端情形下存在安全隐患。</td></tr>
<tr><td>召回维修措施</td><td>加贴警示标识并进行软件升级。</td></tr>
</table></body></html>'''.encode('utf-8')


class CnSamrRecallDailyTests(unittest.TestCase):
    def test_title_requires_exact_full_producer_name(self):
        self.assertTrue(recall.title_matches_company('小米汽车科技有限公司召回部分SU7汽车', '小米汽车科技有限公司'))
        self.assertTrue(recall.title_matches_company('甲公司、小米汽车科技有限公司再次召回部分汽车', '小米汽车科技有限公司'))
        self.assertFalse(recall.title_matches_company('小米汽车科技有限公司子公司召回部分汽车', '小米汽车科技有限公司'))
        self.assertFalse(recall.title_matches_company('小米汽车召回部分汽车', '小米汽车科技有限公司'))

    def test_detail_becomes_scoped_official_recall_event(self):
        company = {'id': 'co_xiaomi', 'name': '小米汽车科技有限公司', 'region': '中国', 'synthetic': False}
        row = {'title': '小米汽车科技有限公司召回部分2024款小米牌SU7系列纯电动汽车（一）', 'url': 'https://www.samrdprc.org.cn/qczh/qczhgg1/202608/t20260821_115889.html', 'date': '2026-08-21', 'category': 'vehicle'}
        event = recall.event_from_detail(company, row, DETAIL)
        self.assertIsNotNone(event)
        self.assertEqual(event['eventType'], 'PRODUCT_RECALL')
        self.assertEqual(event['decisionNo'], 'S2026M0096V')
        self.assertEqual(event['attributes']['recallCount'], '339069辆')
        self.assertIn('不能据此推断企业全部产品质量', event['caveat'])

    def test_collect_fetches_detail_only_after_exact_title_match(self):
        company = {'id': 'co_xiaomi', 'name': '小米汽车科技有限公司', 'region': '中国', 'synthetic': False}
        calls = []
        def fetch(url, timeout=30):
            calls.append(url)
            if url.endswith('t20260821_115889.html'):
                return DETAIL
            if url.endswith('t20260821_999999.html'):
                raise AssertionError('fuzzy title must not fetch detail')
            if 'qczhgg1' in url:
                return INDEX
            return b'<html><body><ul></ul></body></html>'
        events, metrics = recall.collect([company], pages=1, fetch=fetch)
        self.assertEqual(metrics['indexRequests'], 2)
        self.assertEqual(metrics['detailRequests'], 1)
        self.assertEqual(metrics['uniqueEvents'], 1)
        self.assertEqual(len(events), 1)
        self.assertTrue(any(x.endswith('t20260821_115889.html') for x in calls))
        self.assertFalse(any(x.endswith('t20260821_999999.html') for x in calls))


if __name__ == '__main__':
    unittest.main()

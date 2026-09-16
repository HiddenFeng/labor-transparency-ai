import unittest

from scripts.community_agent import cn_csrc_penalty_daily as csrc


SEARCH_HTML = '''<!doctype html><html><body>
<div class="wordGuide Residence-permit" id="0">
  <div class="bigTit clearfix"><span class="fl columnLabel styleColor">行政处罚</span>
    <a href="//www.csrc.gov.cn/csrc/c101928/c7626997/content.shtml" target="_blank" class="fl titleFont permitT titleSelf">中国证券监督管理委员会行政处罚决定书</a>
  </div>
  <div class="listInfoCon clearfix"><p class="summaryFont">〔2026〕10号 当事人:<span>大唐高鸿</span><span>网络</span><span>股份有限公司</span>(以下简称高鸿股份),住所:贵州省贵安新区。对大唐高鸿网络股份有限公司责令改正,给予警告,并处罚款。</p>
  <p class="time"><a class="sourceDateFont permitU">中国证券监督管理委员会</a><span class="sourceDateFont">2026-04-07</span></p></div>
</div>
</body></html>'''.encode('utf-8')

DECISION = '''<!doctype html><html><body><div class="TRS_Editor">
<p>中国证券监督管理委员会行政处罚决定书</p><p>〔2026〕10号</p>
<p>当事人：大唐高鸿网络股份有限公司（以下简称高鸿股份）。</p>
<p>我会根据相关证券法律规定，对本案作出行政处罚决定。</p>
</div></body></html>'''.encode('utf-8')


class CnCsrcPenaltyDailyTests(unittest.TestCase):
    def test_search_parser_only_accepts_official_penalty_decision_urls(self):
        rows = csrc.parse_search_results(SEARCH_HTML)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['url'], 'https://www.csrc.gov.cn/csrc/c101928/c7626997/content.shtml')
        self.assertEqual(rows[0]['date'], '2026-04-07')
        self.assertIn('大唐高鸿网络股份有限公司', rows[0]['summary'])
        self.assertEqual(csrc.canonical_csrc_url('https://example.org/csrc/c101928/c1/content.shtml'), '')
        self.assertEqual(csrc.canonical_csrc_url('https://www.csrc.gov.cn/csrc/c101927/c1/content.shtml'), '')

    def test_decision_requires_exact_full_company_name(self):
        row = csrc.parse_search_results(SEARCH_HTML)[0]
        company = {'id': 'co_gaohong', 'name': '大唐高鸿网络股份有限公司', 'region': '中国', 'synthetic': False}
        event = csrc.event_from_decision(company, row, DECISION)
        self.assertIsNotNone(event)
        self.assertEqual(event['eventType'], 'ADMINISTRATIVE_PENALTY')
        self.assertEqual(event['decisionNo'], '〔2026〕10号')
        self.assertEqual(event['sourceRecordId'], 'c7626997')
        self.assertIn('不能自动扩张', event['caveat'])
        fuzzy = {'id': 'co_fuzzy', 'name': '大唐高鸿网络', 'region': '中国', 'synthetic': False}
        self.assertIsNone(csrc.event_from_decision(fuzzy, row, DECISION.replace('大唐高鸿网络股份有限公司'.encode(), '大唐高鸿网络股份有限公司子公司'.encode())))

    def test_collect_does_one_search_and_fetches_exact_penalty_detail(self):
        company = {'id': 'co_gaohong', 'name': '大唐高鸿网络股份有限公司', 'region': '中国', 'synthetic': False}
        searched = []
        fetched = []
        def search(name, timeout=30):
            searched.append(name); return SEARCH_HTML
        def fetch(url, timeout=30):
            fetched.append(url); return DECISION
        events, metrics = csrc.collect([company], search=search, fetch=fetch)
        self.assertEqual(searched, ['大唐高鸿网络股份有限公司'])
        self.assertEqual(len(fetched), 1)
        self.assertEqual(metrics['searchRequests'], 1)
        self.assertEqual(metrics['detailRequests'], 1)
        self.assertEqual(metrics['uniqueEvents'], 1)
        self.assertEqual(events[0]['provider'], 'CN_CSRC_PENALTY')


if __name__ == '__main__':
    unittest.main()

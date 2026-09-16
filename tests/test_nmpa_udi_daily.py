import tempfile
import unittest
from pathlib import Path

from scripts.community_agent import nmpa_udi_daily as nmpa


class NmpaUdiDailyTests(unittest.TestCase):
    def test_only_exact_existing_company_becomes_official_relation(self):
        xml = '''<?xml version="1.0" encoding="UTF-8"?>
<udid version="1.0"><devices>
  <device>
    <zxxsdycpbs>06972253600013</zxxsdycpbs><cpmctymc>PTCA球囊扩张导管</cpmctymc><spmc>测试商品名</spmc><ggxh>CBC-1210</ggxh>
    <tyshxydm>91320594346302401E</tyshxydm><zczbhhzbapzbh>国械注准20193030166</zczbhhzbapzbh>
    <ylqxzcrbarmc>苏州鼎科医疗技术股份有限公司</ylqxzcrbarmc><qxlb>器械</qxlb><flbm>03-13-06</flbm><cplb>耗材</cplb>
    <cpms>仅用于fixture的产品描述</cpms><deviceRecordKey>KEY-1</deviceRecordKey><versionNumber>4</versionNumber><versionTime>2026-09-15</versionTime><versionStauts>更新</versionStauts>
  </device>
  <device>
    <zxxsdycpbs>00000000000002</zxxsdycpbs><cpmctymc>不匹配产品</cpmctymc><ylqxzcrbarmc>另一家公司</ylqxzcrbarmc><deviceRecordKey>KEY-2</deviceRecordKey><versionTime>2026-09-15</versionTime>
  </device>
</devices></udid>'''
        companies = [
            {"id": "co_match", "name": "苏州鼎科医疗技术股份有限公司", "region": "中国", "synthetic": False},
            {"id": "co_other", "name": "另一家并不存在的公司", "region": "中国", "synthetic": False},
            {"id": "co_demo", "name": "苏州鼎科医疗技术股份有限公司", "region": "示例", "synthetic": True},
        ]
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "udi.xml"
            path.write_text(xml, encoding="utf-8")
            rows, metrics = nmpa.parse_relations(path, companies, "https://udi.nmpa.gov.cn/example.zip")
        self.assertEqual(metrics["recordsScanned"], 2)
        self.assertEqual(metrics["uniqueRelations"], 1)
        self.assertEqual(metrics["matchedCompanies"], 1)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["companyId"], "co_match")
        self.assertEqual(row["relationType"], "COMPANY_REGISTERS_PRODUCT")
        self.assertEqual(row["objectName"], "PTCA球囊扩张导管")
        self.assertEqual(row["objectExternalId"], "06972253600013")
        self.assertEqual(row["sourceRecordId"], "KEY-1")
        self.assertEqual(row["sourceDate"], "2026-09-15")
        self.assertEqual(row["attributes"]["unifiedSocialCreditCode"], "91320594346302401E")
        self.assertIn("不代表平台认定产品整体质量", row["caveat"])

    def test_rss_requires_https_and_returns_first_daily_item(self):
        rss = b'''<?xml version="1.0"?><rss><channel><item><title>UDID_DAY_UPDATE_20260915.zip</title><pubDate>x</pubDate><link>https://udid.nmpa.gov.cn/file.zip</link></item></channel></rss>'''
        item = nmpa.latest_feed_item(rss)
        self.assertEqual(item["title"], "UDID_DAY_UPDATE_20260915.zip")
        self.assertEqual(item["link"], "https://udid.nmpa.gov.cn/file.zip")
        with self.assertRaises(RuntimeError):
            nmpa.latest_feed_item(b'''<rss><channel><item><title>x</title><link>http://example.test/x.zip</link></item></channel></rss>''')


if __name__ == "__main__":
    unittest.main()

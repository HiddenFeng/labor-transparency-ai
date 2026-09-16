import io
import json
import tempfile
import unittest
import zipfile
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

from scripts.community_agent import jp_nta_daily as nta


def corporation_xml(rows):
    body=[]
    for i,row in enumerate(rows,1):
        values={"sequenceNumber":str(i),"latest":"1",**row}
        body.append("<corporation>"+"".join(f"<{k}>{v}</{k}>" for k,v in values.items())+"</corporation>")
    return ("<?xml version='1.0' encoding='UTF-8'?><corporations>"+"".join(body)+"</corporations>").encode()


class JapanNtaDailyTests(unittest.TestCase):
    def test_latest_xml_metadata_uses_xml_section_and_reiwa_date(self):
        html='''<div id="csv-unicode">令和8年9月16日 <a onclick="return doDownload(100);">zip</a></div>
        <h2 id="xml-unicode">XML</h2><tr><th>令和8年9月16日</th><td><a onclick="return doDownload(28088);">zip</a></td></tr>'''
        self.assertEqual(nta.latest_xml_file_metadata(html),{"downloadDate":"2026-09-16","fileNo":"28088"})

    def test_no_japan_company_performs_zero_source_requests(self):
        with tempfile.TemporaryDirectory() as td:
            companies=Path(td)/"companies.json";companies.write_text(json.dumps({"items":[{"id":"co_cn","name":"星宇股份有限公司","region":"中国","synthetic":False}]},ensure_ascii=False),encoding="utf-8")
            args=Namespace(origin="https://example.invalid",companies_file=str(companies),zip_file="",source_date="",publish=False,output="")
            with patch.object(nta,"official_daily_zip",side_effect=AssertionError("must not access NTA source")):
                result=nta.run(args)
        self.assertEqual(result["status"],"PASS_NO_ELIGIBLE_COMPANIES")
        self.assertEqual(result["sourceRequests"],0)
        self.assertEqual(result["eligibleCompanies"],0)

    def test_exact_daily_delta_match_becomes_bounded_official_reference(self):
        xml=corporation_xml([{
            "corporateNumber":"1234567890123","process":"01","updateDate":"2026-09-16","changeDate":"2026-09-15",
            "name":"株式会社サンプル","kind":"301","prefectureName":"東京都","cityName":"千代田区",
            "assignmentDate":"2020-01-01","enName":"Sample Co., Ltd."
        }])
        refs,metrics=nta.parse_references(xml,[{"id":"co_jp","name":"株式会社サンプル","region":"日本","synthetic":False}],"2026-09-16",{"signatureFilePresent":True,"signatureVerification":"SIGNATURE_PRESENT_NOT_CRYPTOGRAPHICALLY_VERIFIED"})
        self.assertEqual(metrics["recordsScanned"],1);self.assertEqual(metrics["uniqueReferences"],1);self.assertEqual(metrics["ambiguousCompanies"],[])
        ref=refs[0]
        self.assertEqual(ref["provider"],"JP_NTA_CORPORATE_NUMBER")
        self.assertEqual(ref["referenceType"],"LEGAL_ENTITY_REGISTRY")
        self.assertEqual(ref["sourceRecordId"],"1234567890123")
        self.assertEqual(ref["confidence"],"MEDIUM")
        self.assertEqual(ref["fields"]["prefectureName"],"東京都")
        self.assertTrue(ref["fields"]["signatureFilePresent"])
        self.assertIn("不是全国全量唯一性检索",ref["caveat"])

    def test_same_exact_name_with_two_corporate_numbers_fails_closed(self):
        xml=corporation_xml([
            {"corporateNumber":"1234567890123","updateDate":"2026-09-16","name":"同名株式会社"},
            {"corporateNumber":"9999999999999","updateDate":"2026-09-16","name":"同名株式会社"},
        ])
        refs,metrics=nta.parse_references(xml,[{"id":"co_jp","name":"同名株式会社","region":"JP","synthetic":False}],"2026-09-16",{})
        self.assertEqual(refs,[]);self.assertEqual(metrics["uniqueReferences"],0);self.assertEqual(metrics["ambiguousCompanies"],[{"companyId":"co_jp","exactCorporateNumbers":2}])

    def test_zip_requires_one_xml_and_reports_signature_presence(self):
        raw=io.BytesIO()
        with zipfile.ZipFile(raw,"w") as z:
            z.writestr("diff_20260916.xml","<corporations/>")
            z.writestr("diff_20260916.xml.asc","signature")
        xml,meta=nta.zip_xml_and_signature(raw.getvalue())
        self.assertEqual(xml,b"<corporations/>")
        self.assertTrue(meta["signatureFilePresent"])
        self.assertEqual(meta["expectedPgpFingerprint"],nta.EXPECTED_PGP_FINGERPRINT)


if __name__ == "__main__":
    unittest.main()

import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

from scripts.community_agent import cn_sse_listing_daily as sse


DIRECTORY = '''//staticDate=2026-09-16 07:36:00
function get_data(){var _t = new Array();
_t.push({val:"601799",val2:"星宇股份",val3:"xygf"});
_t.push({val:"600519",val2:"贵州茅台",val3:"gzmt"});
_t.push({val:"600001",val2:"*ST测试",val3:"stcs"});
return _t;}'''


def overview(code, full_name, short_name="测试"):
    return {
        "COMPANY_CODE": code,
        "FULL_NAME": full_name,
        "SECURITY_ABBR_A_CN": short_name,
        "SEC_TYPE": "主板A",
        "A_LIST_DATE": "20110201",
        "STATE_CODE_A_DESC": "上市",
        "CSRC_GREAT_CODE_DESC": "制造业",
        "AREA_NAME": "江苏省",
    }


class ChinaSseListingDailyTests(unittest.TestCase):
    def test_directory_and_candidate_discovery_are_candidate_only(self):
        rows, date = sse.parse_directory(DIRECTORY)
        self.assertEqual(date, "2026-09-16")
        self.assertEqual(len(rows), 3)
        self.assertEqual(sse.candidate_codes("星宇股份有限公司", rows), ["601799"])
        self.assertEqual(sse.candidate_codes("测试股份有限公司", rows), ["600001"])

    def test_exact_official_full_name_creates_disclosure_reference(self):
        rows, date = sse.parse_directory(DIRECTORY)
        company = {"id": "co_mt", "name": "贵州茅台酒股份有限公司", "region": "中国", "synthetic": False}
        refs, metrics = sse.match_references(
            [company], rows, date,
            overview_loader=lambda code: overview(code, "贵州茅台酒股份有限公司", "贵州茅台"),
        )
        self.assertEqual(metrics["exactFullNameMatches"], 1)
        self.assertEqual(len(refs), 1)
        ref = refs[0]
        self.assertEqual(ref["provider"], "CN_SSE_LISTING")
        self.assertEqual(ref["referenceType"], "DISCLOSURE_REGISTRY")
        self.assertEqual(ref["sourceRecordId"], "SSE:600519")
        self.assertEqual(ref["fields"]["fullLegalName"], "贵州茅台酒股份有限公司")
        self.assertIn("不升级 GSXT", ref["caveat"])

    def test_shortened_company_space_does_not_bind_different_full_legal_name(self):
        rows, date = sse.parse_directory(DIRECTORY)
        company = {"id": "co_xy", "name": "星宇股份有限公司", "region": "中国", "synthetic": False}
        refs, metrics = sse.match_references(
            [company], rows, date,
            overview_loader=lambda code: overview(code, "常州星宇车灯股份有限公司", "星宇股份"),
        )
        self.assertEqual(refs, [])
        self.assertEqual(metrics["candidateSecurityCodes"], 1)
        self.assertEqual(metrics["exactFullNameMatches"], 0)

    def test_no_china_company_performs_zero_exchange_requests(self):
        with tempfile.TemporaryDirectory() as td:
            companies = Path(td) / "companies.json"
            companies.write_text(json.dumps({"items": [{"id": "co_jp", "name": "株式会社サンプル", "region": "日本"}]}, ensure_ascii=False), encoding="utf-8")
            args = Namespace(origin="https://example.invalid", companies_file=str(companies), directory_file="", publish=False, output="")
            with patch.object(sse, "official_directory", side_effect=AssertionError("must not call SSE")):
                result = sse.run(args)
        self.assertEqual(result["status"], "PASS_NO_ELIGIBLE_COMPANIES")
        self.assertEqual(result["sourceRequests"], 0)

    def test_multiple_exact_official_rows_fail_closed(self):
        directory = [
            {"securityCode": "600100", "securityAbbreviation": "同名"},
            {"securityCode": "600101", "securityAbbreviation": "同名"},
        ]
        company = {"id": "co_same", "name": "同名股份有限公司", "region": "CN"}
        refs, metrics = sse.match_references(
            [company], directory, "2026-09-16",
            overview_loader=lambda code: overview(code, "同名股份有限公司", "同名"),
        )
        self.assertEqual(refs, [])
        self.assertEqual(metrics["ambiguousCompanies"], [{"companyId": "co_same", "exactOfficialRows": 2}])


if __name__ == "__main__":
    unittest.main()

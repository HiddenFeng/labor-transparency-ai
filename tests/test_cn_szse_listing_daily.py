import io
import json
import tempfile
import unittest
import zipfile
from argparse import Namespace
from html import escape
from pathlib import Path
from unittest.mock import patch

from scripts.community_agent import cn_szse_listing_daily as szse


HEADERS = ["板块", "公司全称", "英文名称", "注册地址", "A股代码", "A股简称", "A股上市日期", "所属行业", "省    份", "城     市", "公司网址"]


def xlsx_fixture(rows):
    all_rows = [HEADERS, *rows]
    xml_rows = []
    for ridx, values in enumerate(all_rows, 1):
        cells = []
        for cidx, value in enumerate(values, 1):
            n = cidx
            letters = ""
            while n:
                n, rem = divmod(n - 1, 26)
                letters = chr(65 + rem) + letters
            cells.append(f'<c r="{letters}{ridx}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>')
        xml_rows.append(f'<row r="{ridx}">{"".join(cells)}</row>')
    sheet = '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + "".join(xml_rows) + '</sheetData></worksheet>'
    raw = io.BytesIO()
    with zipfile.ZipFile(raw, "w") as archive:
        archive.writestr("xl/worksheets/sheet1.xml", sheet)
    return raw.getvalue()


def row(name, code, abbr, board="主板"):
    return [board, name, "Example Co., Ltd.", "广东省深圳市测试路1号", code, abbr, "1991-04-03", "J 金融业", "广东", "深圳市", "example.com"]


class ChinaSzseListingDailyTests(unittest.TestCase):
    def test_report_parser_maps_official_full_name_and_code(self):
        rows, metrics = szse.parse_report(xlsx_fixture([row("平安银行股份有限公司", "000001", "平安银行")]))
        self.assertEqual(metrics["recordsScanned"], 1)
        self.assertEqual(rows[0]["fullLegalName"], "平安银行股份有限公司")
        self.assertEqual(rows[0]["aStockCode"], "000001")
        self.assertEqual(rows[0]["province"], "广东")

    def test_exact_full_name_creates_bounded_disclosure_reference(self):
        rows, _ = szse.parse_report(xlsx_fixture([row("平安银行股份有限公司", "000001", "平安银行")]))
        company = {"id": "co_pa", "name": "平安银行股份有限公司", "region": "中国", "synthetic": False}
        refs, metrics = szse.match_references([company], rows, "2026-09-16")
        self.assertEqual(metrics["exactFullNameMatches"], 1)
        self.assertEqual(len(refs), 1)
        ref = refs[0]
        self.assertEqual(ref["provider"], "CN_SZSE_LISTING")
        self.assertEqual(ref["referenceType"], "DISCLOSURE_REGISTRY")
        self.assertEqual(ref["sourceRecordId"], "SZSE:000001")
        self.assertEqual(ref["fields"]["exchange"], "SZSE")
        self.assertEqual(ref["fields"]["fullLegalName"], "平安银行股份有限公司")
        self.assertIn("不升级 GSXT", ref["caveat"])

    def test_shortened_or_substring_name_does_not_bind(self):
        rows, _ = szse.parse_report(xlsx_fixture([row("深圳市振业(集团)股份有限公司", "000006", "深振业Ａ")]))
        company = {"id": "co_short", "name": "振业股份有限公司", "region": "CN", "synthetic": False}
        refs, metrics = szse.match_references([company], rows, "2026-09-16")
        self.assertEqual(refs, [])
        self.assertEqual(metrics["exactFullNameMatches"], 0)

    def test_duplicate_exact_full_names_fail_closed(self):
        rows, _ = szse.parse_report(xlsx_fixture([
            row("同名股份有限公司", "000100", "同名一"),
            row("同名股份有限公司", "000101", "同名二"),
        ]))
        company = {"id": "co_same", "name": "同名股份有限公司", "region": "中国", "synthetic": False}
        refs, metrics = szse.match_references([company], rows, "2026-09-16")
        self.assertEqual(refs, [])
        self.assertEqual(metrics["ambiguousCompanies"], [{"companyId": "co_same", "exactOfficialRows": 2}])

    def test_no_china_company_performs_zero_source_requests(self):
        with tempfile.TemporaryDirectory() as td:
            companies = Path(td) / "companies.json"
            companies.write_text(json.dumps({"items": [{"id": "co_jp", "name": "株式会社サンプル", "region": "日本"}]}, ensure_ascii=False), encoding="utf-8")
            args = Namespace(origin="https://example.invalid", companies_file=str(companies), xlsx_file="", source_date="", publish=False, output="")
            with patch.object(szse, "official_report", side_effect=AssertionError("must not call SZSE")):
                result = szse.run(args)
        self.assertEqual(result["status"], "PASS_NO_ELIGIBLE_COMPANIES")
        self.assertEqual(result["sourceRequests"], 0)


if __name__ == "__main__":
    unittest.main()

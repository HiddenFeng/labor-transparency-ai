#!/usr/bin/env python3
"""Collect strict Shenzhen Stock Exchange listing/disclosure references."""

from __future__ import annotations

import argparse
import io
import json
import re
import urllib.parse
import urllib.request
import zipfile
from datetime import timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Iterable
import xml.etree.ElementTree as ET

if __package__:
    from .nmpa_udi_daily import DEFAULT_ORIGIN, http_json, load_agent_token, normalize_name
else:
    from nmpa_udi_daily import DEFAULT_ORIGIN, http_json, load_agent_token, normalize_name

PROVIDER = "CN_SZSE_LISTING"
SOURCE_OF_RECORD = "深圳证券交易所"
SZSE_LIST_PAGE = "https://www.szse.cn/market/product/stock/list/index.html"
SZSE_REPORT = "https://www.szse.cn/api/report/ShowReport"
UA = "LaborTransparencyPublicInterest/0.8.7 SZSE-Listing-Agent"
XLSX_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

HEADER_MAP = {
    "板块": "board",
    "公司全称": "fullLegalName",
    "英文名称": "englishName",
    "注册地址": "registeredAddress",
    "A股代码": "aStockCode",
    "A股简称": "aStockAbbreviation",
    "A股上市日期": "aListingDate",
    "B股代码": "bStockCode",
    "B股简称": "bStockAbbreviation",
    "B股上市日期": "bListingDate",
    "地区": "area",
    "省份": "province",
    "城市": "city",
    "所属行业": "industry",
    "公司网址": "website",
}


def is_china_company(company: dict) -> bool:
    region = normalize_name(company.get("region", ""))
    return bool(
        not company.get("synthetic")
        and (region in {"cn", "china", "中国", "中华人民共和国", "中国大陆"} or "中国" in region or "china" in region)
    )


def eligible_companies(companies: Iterable[dict]) -> list[dict]:
    return [c for c in companies if c.get("id") and c.get("name") and is_china_company(c)]


def _source_date(headers) -> str:
    raw = str(headers.get("Date") or "")
    if not raw:
        return ""
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc).date().isoformat()
    except (TypeError, ValueError, OverflowError):
        return ""


def official_report() -> tuple[bytes, dict]:
    query = urllib.parse.urlencode({"SHOWTYPE": "xlsx", "CATALOGID": "1110", "TABKEY": "tab1"})
    request = urllib.request.Request(
        f"{SZSE_REPORT}?{query}",
        headers={
            "User-Agent": UA,
            "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.8",
            "Referer": SZSE_LIST_PAGE,
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        body = response.read()
        meta = {
            "sourceDate": _source_date(response.headers),
            "contentType": str(response.headers.get("Content-Type") or ""),
            "contentDisposition": str(response.headers.get("Content-Disposition") or ""),
        }
    if not body.startswith(b"PK"):
        raise RuntimeError("SZSE stock-list report was not an XLSX/ZIP payload")
    return body, meta


def _column_index(ref: str) -> int:
    letters = re.match(r"([A-Z]+)", str(ref or "").upper())
    if not letters:
        return -1
    value = 0
    for char in letters.group(1):
        value = value * 26 + ord(char) - 64
    return value - 1


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.findall(".//m:t", XLSX_NS)) for si in root.findall("m:si", XLSX_NS)]


def _cell_value(cell: ET.Element, shared: list[str]) -> str:
    kind = cell.get("t") or ""
    if kind == "inlineStr":
        return "".join(t.text or "" for t in cell.findall(".//m:t", XLSX_NS)).strip()
    value = cell.find("m:v", XLSX_NS)
    raw = (value.text or "").strip() if value is not None else ""
    if kind == "s" and raw:
        try:
            return shared[int(raw)].strip()
        except (ValueError, IndexError):
            return ""
    return raw


def _clean_header(value: str) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def parse_report(xlsx_bytes: bytes) -> tuple[list[dict], dict]:
    with zipfile.ZipFile(io.BytesIO(xlsx_bytes)) as archive:
        if "xl/worksheets/sheet1.xml" not in archive.namelist():
            raise RuntimeError("SZSE XLSX missing sheet1")
        shared = _shared_strings(archive)
        root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows = root.findall(".//m:sheetData/m:row", XLSX_NS)
        if not rows:
            raise RuntimeError("SZSE XLSX contains no rows")

        header_cells = {}
        for cell in rows[0].findall("m:c", XLSX_NS):
            index = _column_index(cell.get("r", ""))
            header = _clean_header(_cell_value(cell, shared))
            if index >= 0 and header:
                header_cells[index] = HEADER_MAP.get(header, "")
        required = {"fullLegalName", "aStockCode", "aStockAbbreviation"}
        if not required.issubset(set(header_cells.values())):
            raise RuntimeError("SZSE XLSX headers do not match the expected stock-list schema")

        records = []
        for row in rows[1:]:
            record = {}
            for cell in row.findall("m:c", XLSX_NS):
                index = _column_index(cell.get("r", ""))
                key = header_cells.get(index, "")
                if key:
                    record[key] = _cell_value(cell, shared)
            if record.get("fullLegalName") and (record.get("aStockCode") or record.get("bStockCode")):
                records.append(record)
    return records, {"recordsScanned": len(records)}


def reference_from_row(company: dict, row: dict, source_date: str) -> dict:
    code = str(row.get("aStockCode") or row.get("bStockCode") or "").strip()
    abbreviation = str(row.get("aStockAbbreviation") or row.get("bStockAbbreviation") or "").strip()
    listing_date = str(row.get("aListingDate") or row.get("bListingDate") or "").strip()
    full_name = str(row.get("fullLegalName") or "").strip()
    fields = {
        "exchange": "SZSE",
        "securityCode": code,
        "securityAbbreviation": abbreviation,
        "fullLegalName": full_name,
        "englishName": str(row.get("englishName") or "").strip(),
        "board": str(row.get("board") or "").strip(),
        "listingDate": listing_date,
        "industry": str(row.get("industry") or "").strip(),
        "registeredAddress": str(row.get("registeredAddress") or "").strip(),
        "province": str(row.get("province") or "").strip(),
        "city": str(row.get("city") or "").strip(),
        "website": str(row.get("website") or "").strip(),
        "reportDate": source_date,
    }
    fields = {k: v for k, v in fields.items() if v not in (None, "")}
    return {
        "companyId": company["id"],
        "provider": PROVIDER,
        "jurisdiction": "CN",
        "referenceType": "DISCLOSURE_REGISTRY",
        "sourceRecordId": f"SZSE:{code}",
        "sourceOfRecord": SOURCE_OF_RECORD,
        "sourceUrl": SZSE_LIST_PAGE,
        "sourceDate": source_date or listing_date,
        "confidence": "HIGH",
        "bindingBasis": "EXACT_FULL_LEGAL_NAME_IN_OFFICIAL_SZSE_STOCK_LIST_REPORT",
        "scope": f"深圳证券交易所股票列表将证券代码 {code} 与完整公司名称“{full_name}”直接关联；当前公司空间名称与该完整名称精确一致。",
        "caveat": "该记录只支持深交所股票列表中的上市/披露主体、证券代码及有限公开字段；它不是全国工商主体唯一性核验，不升级 GSXT 法律主体身份，也不支持对公司合规、劳动条件、产品质量或投资价值作整体判断。",
        "fields": fields,
    }


def match_references(companies: Iterable[dict], rows: list[dict], source_date: str) -> tuple[list[dict], dict]:
    eligible = eligible_companies(companies)
    by_name: dict[str, list[dict]] = {}
    for row in rows:
        by_name.setdefault(normalize_name(row.get("fullLegalName", "")), []).append(row)
    references = []
    ambiguous = []
    matched = 0
    for company in eligible:
        candidates = by_name.get(normalize_name(company["name"]), [])
        if len(candidates) == 1:
            matched += 1
            references.append(reference_from_row(company, candidates[0], source_date))
        elif len(candidates) > 1:
            ambiguous.append({"companyId": company["id"], "exactOfficialRows": len(candidates)})
    return references, {
        "eligibleCompanies": len(eligible),
        "exactFullNameMatches": matched,
        "uniqueReferences": len(references),
        "ambiguousCompanies": ambiguous,
    }


def publish_references(origin: str, references: list[dict]) -> int:
    if not references:
        return 0
    token = load_agent_token()
    saved = 0
    for start in range(0, len(references), 250):
        result = http_json(
            f"{origin.rstrip('/')}/api/community-agent/official-references",
            token=token,
            method="POST",
            payload={"items": references[start:start + 250]},
        )
        saved += int(result.get("savedCount", 0))
    return saved


def load_companies(origin: str, companies_file: str = "") -> list[dict]:
    if companies_file:
        data = json.loads(Path(companies_file).read_text(encoding="utf-8"))
        return data.get("items", data) if isinstance(data, dict) else data
    data = http_json(f"{origin.rstrip('/')}/api/companies")
    return data.get("items", [])


def run(args) -> dict:
    companies = load_companies(args.origin, args.companies_file)
    eligible = eligible_companies(companies)
    if not eligible:
        result = {
            "status": "PASS_NO_ELIGIBLE_COMPANIES",
            "provider": PROVIDER,
            "eligibleCompanies": 0,
            "sourceRequests": 0,
            "recordsScanned": 0,
            "exactFullNameMatches": 0,
            "uniqueReferences": 0,
            "publishedReferences": 0,
            "publishRequested": bool(args.publish),
        }
    else:
        if args.xlsx_file:
            xlsx_bytes = Path(args.xlsx_file).read_bytes()
            meta = {"sourceDate": args.source_date or "", "fixture": True}
            source_requests = 0
        else:
            xlsx_bytes, meta = official_report()
            source_requests = 1
        rows, parse_metrics = parse_report(xlsx_bytes)
        references, metrics = match_references(eligible, rows, meta.get("sourceDate", ""))
        published = publish_references(args.origin, references) if args.publish else 0
        result = {
            "status": "PASS" if not metrics["ambiguousCompanies"] else "PASS_WITH_AMBIGUOUS_OFFICIAL_ROWS_SKIPPED",
            "provider": PROVIDER,
            "sourceUrl": SZSE_LIST_PAGE,
            "reportUrl": SZSE_REPORT,
            "sourceDate": meta.get("sourceDate", ""),
            "sourceRequests": source_requests,
            **parse_metrics,
            **metrics,
            "publishedReferences": published,
            "publishRequested": bool(args.publish),
        }
    if args.output:
        path = Path(args.output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser()
    p.add_argument("--origin", default=DEFAULT_ORIGIN)
    p.add_argument("--companies-file", default="")
    p.add_argument("--xlsx-file", default="")
    p.add_argument("--source-date", default="")
    p.add_argument("--publish", action="store_true")
    p.add_argument("--output", default="")
    return p


if __name__ == "__main__":
    print(json.dumps(run(parser().parse_args()), ensure_ascii=False))

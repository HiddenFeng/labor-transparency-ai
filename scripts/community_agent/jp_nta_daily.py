#!/usr/bin/env python3
"""Collect bounded Japan NTA Corporate Number daily-delta references.

The collector uses the National Tax Agency Corporate Number Publication Site's normal public
Download function. It only accesses the source when the project already has a Japan company
space. An exact normalized legal-name match in the daily delta becomes an
OFFICIAL_SOURCE_REFERENCE only when that name maps to one corporate number in the file.
This does not upgrade the company-intelligence legal identity state because a daily delta is
not a nationwide uniqueness search.
"""
from __future__ import annotations

import argparse
import http.cookiejar
import io
import json
import re
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Iterable

if __package__:
    from .nmpa_udi_daily import DEFAULT_ORIGIN, http_json, load_agent_token, normalize_name
else:
    from nmpa_udi_daily import DEFAULT_ORIGIN, http_json, load_agent_token, normalize_name

NTA_ROOT = "https://www.houjin-bangou.nta.go.jp/"
NTA_DAILY_PAGE = "https://www.houjin-bangou.nta.go.jp/download/sabun/index.html"
NTA_TERMS = "https://www.houjin-bangou.nta.go.jp/en/riyokiyaku/"
SOURCE_OF_RECORD = "国税庁法人番号公表サイト"
EXPECTED_PGP_FINGERPRINT = "F4109E821F0DE67C4BA1947C4BCD87A24D615230"
UA = "LaborTransparencyPublicInterest/0.8.4 Japan-NTA-Corporate-Number-Agent"
TOKEN_NAME = "jp.go.nta.houjin_bangou.framework.web.common.CNSFWTokenProcessor.request.token"


def is_japan_company(company: dict) -> bool:
    region = str(company.get("region") or "").strip().casefold()
    compact = re.sub(r"\s+", "", region)
    return bool(not company.get("synthetic") and (compact in {"jp", "japan", "日本", "日本国"} or "日本" in compact or "japan" in compact))


def eligible_companies(companies: Iterable[dict]) -> list[dict]:
    return [c for c in companies if c.get("id") and c.get("name") and is_japan_company(c)]


def reiwa_to_iso(year: str, month: str, day: str) -> str:
    y = 2018 + int(year)
    return f"{y:04d}-{int(month):02d}-{int(day):02d}"


def latest_xml_file_metadata(page_html: str) -> dict:
    marker = 'id="xml-unicode"'
    if marker not in page_html:
        raise RuntimeError("NTA daily page does not contain XML/Unicode section")
    section = page_html.split(marker, 1)[1]
    match = re.search(r"令和\s*(\d+)年\s*(\d+)月\s*(\d+)日.*?doDownload\((\d+)\)", section, re.S)
    if not match:
        raise RuntimeError("NTA daily page has no current XML/Unicode download row")
    return {
        "downloadDate": reiwa_to_iso(match.group(1), match.group(2), match.group(3)),
        "fileNo": match.group(4),
    }


def csrf_token(page_html: str) -> str:
    pattern = rf'name="{re.escape(TOKEN_NAME)}" value="([^"]+)"'
    match = re.search(pattern, page_html)
    if not match:
        raise RuntimeError("NTA daily page CSRF token missing")
    return match.group(1)


def official_daily_zip() -> tuple[bytes, dict]:
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    headers = {"User-Agent": UA, "Accept": "text/html,application/octet-stream;q=0.9,*/*;q=0.8"}
    with opener.open(urllib.request.Request(NTA_DAILY_PAGE, headers=headers), timeout=30) as response:
        page_html = response.read().decode("utf-8", "ignore")
    meta = latest_xml_file_metadata(page_html)
    token = csrf_token(page_html)
    body = urllib.parse.urlencode({TOKEN_NAME: token, "event": "download", "selDlFileNo": meta["fileNo"]}).encode("ascii")
    request = urllib.request.Request(
        NTA_DAILY_PAGE,
        method="POST",
        data=body,
        headers={**headers, "Content-Type": "application/x-www-form-urlencoded"},
    )
    with opener.open(request, timeout=45) as response:
        content = response.read()
        content_type = str(response.headers.get("content-type") or "")
        disposition = str(response.headers.get("content-disposition") or "")
    if not content.startswith(b"PK"):
        raise RuntimeError(f"NTA daily download was not a ZIP ({content_type})")
    meta.update({"contentType": content_type, "contentDisposition": disposition, "sourceUrl": NTA_DAILY_PAGE})
    return content, meta


def zip_xml_and_signature(zip_bytes: bytes) -> tuple[bytes, dict]:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        names = archive.namelist()
        xml_names = [name for name in names if name.lower().endswith(".xml")]
        asc_names = [name for name in names if name.lower().endswith(".asc")]
        if len(xml_names) != 1:
            raise RuntimeError(f"expected exactly one XML in NTA daily ZIP, got {len(xml_names)}")
        return archive.read(xml_names[0]), {
            "xmlFile": xml_names[0],
            "signatureFile": asc_names[0] if asc_names else "",
            "signatureFilePresent": bool(asc_names),
            "expectedPgpFingerprint": EXPECTED_PGP_FINGERPRINT,
            "signatureVerification": "SIGNATURE_PRESENT_NOT_CRYPTOGRAPHICALLY_VERIFIED",
        }


def xml_row(elem: ET.Element) -> dict[str, str]:
    return {child.tag: (child.text or "").strip() for child in list(elem)}


def reference_from_row(company: dict, row: dict[str, str], source_date: str, signature_meta: dict) -> dict:
    corporate_number = row.get("corporateNumber", "")
    legal_name = row.get("name", "")
    fields = {
        "corporateNumber": corporate_number,
        "legalName": legal_name,
        "prefectureName": row.get("prefectureName", ""),
        "cityName": row.get("cityName", ""),
        "kind": row.get("kind", ""),
        "assignmentDate": row.get("assignmentDate", ""),
        "updateDate": row.get("updateDate", ""),
        "changeDate": row.get("changeDate", ""),
        "closeDate": row.get("closeDate", ""),
        "closeCause": row.get("closeCause", ""),
        "successorCorporateNumber": row.get("successorCorporateNumber", ""),
        "enName": row.get("enName", ""),
        "furigana": row.get("furigana", ""),
        "process": row.get("process", ""),
        "latest": row.get("latest", ""),
        "signatureFilePresent": bool(signature_meta.get("signatureFilePresent")),
        "signatureVerification": signature_meta.get("signatureVerification", ""),
    }
    fields = {key: value for key, value in fields.items() if value not in (None, "")}
    return {
        "companyId": company["id"],
        "provider": "JP_NTA_CORPORATE_NUMBER",
        "jurisdiction": "JP",
        "referenceType": "LEGAL_ENTITY_REGISTRY",
        "sourceRecordId": corporate_number,
        "sourceOfRecord": SOURCE_OF_RECORD,
        "sourceUrl": NTA_DAILY_PAGE,
        "sourceDate": row.get("updateDate") or source_date,
        "confidence": "MEDIUM",
        "bindingBasis": "EXACT_NAME_IN_OFFICIAL_DAILY_DELTA_NOT_NATIONAL_UNIQUENESS",
        "scope": f"国税庁法人番号公表サイトの日次差分で、名称“{legal_name}”がこの会社空间名称と完全一致した法人番号记录。",
        "caveat": "该记录来自日本国税厅法人番号公开日差分，只支持这条法人番号、名称及有限登记信息与当前公司空间名称的精确匹配；日差分不是全国全量唯一性检索，因此不会自动升级平台的法律主体身份，也不支持劳动、产品质量或违法结论。",
        "fields": fields,
    }


def parse_references(xml_bytes: bytes, companies: Iterable[dict], source_date: str, signature_meta: dict | None = None) -> tuple[list[dict], dict]:
    signature_meta = signature_meta or {}
    eligible = eligible_companies(companies)
    by_name: dict[str, list[dict]] = {}
    for company in eligible:
        by_name.setdefault(normalize_name(company["name"]), []).append(company)
    matches: dict[str, dict[str, list[dict[str, str]]]] = {company["id"]: {} for company in eligible}
    scanned = 0
    for _, elem in ET.iterparse(io.BytesIO(xml_bytes), events=("end",)):
        if elem.tag != "corporation":
            continue
        scanned += 1
        row = xml_row(elem)
        if row.get("latest") not in {"", "1"}:
            elem.clear(); continue
        name_key = normalize_name(row.get("name", ""))
        for company in by_name.get(name_key, []):
            number = row.get("corporateNumber", "")
            if number:
                matches[company["id"]].setdefault(number, []).append(row)
        elem.clear()
    references = []
    ambiguous = []
    matched_company_ids = set()
    for company in eligible:
        numbers = matches.get(company["id"], {})
        if len(numbers) > 1:
            ambiguous.append({"companyId": company["id"], "exactCorporateNumbers": len(numbers)})
            continue
        if not numbers:
            continue
        corporate_number, rows = next(iter(numbers.items()))
        row = sorted(rows, key=lambda x: (x.get("updateDate", ""), int(x.get("sequenceNumber") or 0)), reverse=True)[0]
        references.append(reference_from_row(company, row, source_date, signature_meta))
        matched_company_ids.add(company["id"])
    return references, {
        "recordsScanned": scanned,
        "eligibleCompanies": len(eligible),
        "matchedCompanies": len(matched_company_ids),
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
            "provider": "JP_NTA_CORPORATE_NUMBER",
            "eligibleCompanies": 0,
            "sourceRequests": 0,
            "recordsScanned": 0,
            "matchedCompanies": 0,
            "uniqueReferences": 0,
            "publishedReferences": 0,
            "publishRequested": bool(args.publish),
        }
        if args.output:
            path = Path(args.output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        return result

    source_requests = 0
    if args.zip_file:
        zip_bytes = Path(args.zip_file).read_bytes()
        source_date = args.source_date or ""
        download_meta = {"downloadDate": source_date, "sourceUrl": NTA_DAILY_PAGE, "fixture": True}
    else:
        zip_bytes, download_meta = official_daily_zip();source_requests = 2
        source_date = download_meta["downloadDate"]
    xml_bytes, signature_meta = zip_xml_and_signature(zip_bytes)
    references, metrics = parse_references(xml_bytes, eligible, source_date, signature_meta)
    published = publish_references(args.origin, references) if args.publish else 0
    result = {
        "status": "PASS" if not metrics["ambiguousCompanies"] else "PASS_WITH_AMBIGUOUS_NAMES_SKIPPED",
        "provider": "JP_NTA_CORPORATE_NUMBER",
        "sourceUrl": NTA_DAILY_PAGE,
        "termsUrl": NTA_TERMS,
        "downloadDate": source_date,
        "sourceRequests": source_requests,
        "signatureFilePresent": signature_meta.get("signatureFilePresent", False),
        "signatureVerification": signature_meta.get("signatureVerification", ""),
        **metrics,
        "publishedReferences": published,
        "publishRequested": bool(args.publish),
    }
    if args.output:
        path = Path(args.output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return result


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser()
    p.add_argument("--origin", default=DEFAULT_ORIGIN)
    p.add_argument("--companies-file", default="")
    p.add_argument("--zip-file", default="")
    p.add_argument("--source-date", default="")
    p.add_argument("--publish", action="store_true")
    p.add_argument("--output", default="")
    return p


if __name__ == "__main__":
    print(json.dumps(run(parser().parse_args()), ensure_ascii=False))

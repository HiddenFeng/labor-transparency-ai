#!/usr/bin/env python3
"""Strict Shanghai Stock Exchange listing references for China company spaces."""

from __future__ import annotations

import argparse
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterable

if __package__:
    from .nmpa_udi_daily import DEFAULT_ORIGIN, http_json, load_agent_token, normalize_name
else:
    from nmpa_udi_daily import DEFAULT_ORIGIN, http_json, load_agent_token, normalize_name

PROVIDER = "CN_SSE_LISTING"
SOURCE_OF_RECORD = "上海证券交易所"
SSE_DIRECTORY = "https://www.sse.com.cn/js/common/ssesuggestdata.js"
SSE_QUERY = "https://query.sse.com.cn/commonQuery.do"
SSE_COMPANY_PAGE = "https://www.sse.com.cn/assortment/stock/list/info/company/index.shtml"
SSE_SQL_ID = "COMMON_SSE_CP_GPJCTPZ_GPLB_GPGK_GSGK_C"
UA = "LaborTransparencyPublicInterest/0.8.6 SSE-Listing-Agent"
MAX_CANDIDATES_PER_COMPANY = 8


def is_china_company(company: dict) -> bool:
    region = normalize_name(company.get("region", ""))
    return bool(
        not company.get("synthetic")
        and (region in {"cn", "china", "中国", "中华人民共和国", "中国大陆"} or "中国" in region or "china" in region)
    )


def eligible_companies(companies: Iterable[dict]) -> list[dict]:
    return [c for c in companies if c.get("id") and c.get("name") and is_china_company(c)]


def source_bytes(url: str, *, referer: str, timeout: int = 30) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": "application/json,text/javascript,*/*;q=0.8", "Referer": referer},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def parse_directory(script_text: str) -> tuple[list[dict], str]:
    date_match = re.search(r"//staticDate=(\d{4}-\d{2}-\d{2})", script_text)
    snapshot = date_match.group(1) if date_match else ""
    rows = [
        {"securityCode": m.group(1), "securityAbbreviation": m.group(2)}
        for m in re.finditer(r'_t\.push\(\{val:"(\d{6})",val2:"([^"\\]+)",val3:"[^"\\]*"\}\);', script_text)
    ]
    if not rows:
        raise RuntimeError("SSE public security directory contained no parsable stock rows")
    return rows, snapshot


def candidate_security_name(value: str) -> str:
    # Trading-state decorations are candidate-discovery only; the later FULL_NAME gate is exact.
    text = str(value or "").strip()
    return re.sub(r"^(?:\*?ST|XD|XR|DR|N|C)+", "", text, flags=re.I).strip()


def candidate_codes(company_name: str, directory: Iterable[dict]) -> list[str]:
    target = normalize_name(company_name)
    out = []
    for row in directory:
        code = str(row.get("securityCode") or "")
        short = normalize_name(candidate_security_name(row.get("securityAbbreviation", "")))
        if re.fullmatch(r"\d{6}", code) and len(short) >= 2 and short in target:
            out.append(code)
            if len(out) >= MAX_CANDIDATES_PER_COMPANY:
                break
    return out


def parse_jsonp(raw: bytes) -> dict:
    text = raw.decode("utf-8", "replace").strip()
    match = re.match(r"^[A-Za-z_$][\w$]*\((.*)\)\s*;?$", text, re.S)
    if not match:
        raise RuntimeError("SSE company overview response was not expected JSONP")
    value = json.loads(match.group(1))
    if not isinstance(value, dict):
        raise RuntimeError("SSE company overview payload was not an object")
    return value


def official_directory() -> tuple[list[dict], str]:
    raw = source_bytes(
        SSE_DIRECTORY,
        referer="https://www.sse.com.cn/assortment/stock/list/share/",
    )
    return parse_directory(raw.decode("utf-8", "replace"))


def official_company_overview(security_code: str) -> dict | None:
    callback = "ltpSseCallback"
    query = urllib.parse.urlencode({
        "isPagination": "false",
        "sqlId": SSE_SQL_ID,
        "COMPANY_CODE": security_code,
        "jsonCallBack": callback,
    })
    company_url = f"{SSE_COMPANY_PAGE}?COMPANY_CODE={security_code}"
    payload = parse_jsonp(source_bytes(f"{SSE_QUERY}?{query}", referer=company_url))
    rows = payload.get("result") or []
    if not isinstance(rows, list):
        raise RuntimeError("SSE company overview result was not a list")
    exact = [
        row for row in rows
        if isinstance(row, dict) and str(row.get("COMPANY_CODE") or "").strip() == security_code
    ]
    return exact[0] if len(exact) == 1 else None


def iso_date(value: str) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}" if len(digits) == 8 else ""


def reference_from_overview(company: dict, row: dict, directory_date: str) -> dict:
    code = str(row.get("COMPANY_CODE") or "").strip()
    full_name = str(row.get("FULL_NAME") or "").strip()
    listing_date = iso_date(row.get("A_LIST_DATE") or row.get("B_LIST_DATE") or "")
    fields = {
        "exchange": "SSE",
        "securityCode": code,
        "securityAbbreviation": str(row.get("SECURITY_ABBR_A_CN") or row.get("COMPANY_ABBR") or "").strip(),
        "fullLegalName": full_name,
        "securityType": str(row.get("SEC_TYPE") or "").strip(),
        "listingDate": listing_date,
        "listingStatus": str(row.get("STATE_CODE_A_DESC") or "").strip(),
        "industry": str(row.get("CSRC_GREAT_CODE_DESC") or row.get("CSRC_CODE_DESC") or "").strip(),
        "registeredArea": str(row.get("AREA_NAME") or "").strip(),
        "directoryDate": directory_date,
    }
    fields = {key: value for key, value in fields.items() if value not in (None, "")}
    return {
        "companyId": company["id"],
        "provider": PROVIDER,
        "jurisdiction": "CN",
        "referenceType": "DISCLOSURE_REGISTRY",
        "sourceRecordId": f"SSE:{code}",
        "sourceOfRecord": SOURCE_OF_RECORD,
        "sourceUrl": f"{SSE_COMPANY_PAGE}?COMPANY_CODE={code}",
        "sourceDate": directory_date or listing_date,
        "confidence": "HIGH",
        "bindingBasis": "SSE_SECURITY_CODE_CANDIDATE_THEN_EXACT_FULL_LEGAL_NAME_IN_OFFICIAL_COMPANY_OVERVIEW",
        "scope": f"上海证券交易所公司概况将证券代码 {code} 与完整公司名称“{full_name}”直接关联；当前公司空间名称与该完整名称精确一致。",
        "caveat": "该记录只支持上交所证券代码、上市/披露主体名称及本条概况字段的官方关联；它不是全国工商主体唯一性核验，不升级 GSXT 法律主体身份，也不支持对公司合规、劳动条件、产品质量或投资价值作整体判断。",
        "fields": fields,
    }


def match_references(
    companies: Iterable[dict],
    directory: list[dict],
    directory_date: str,
    overview_loader=official_company_overview,
) -> tuple[list[dict], dict]:
    eligible = eligible_companies(companies)
    cache: dict[str, dict | None] = {}
    references = []
    ambiguous = []
    candidate_count = 0
    exact_count = 0
    for company in eligible:
        codes = candidate_codes(company["name"], directory)
        candidate_count += len(codes)
        exact_rows = []
        for code in codes:
            if code not in cache:
                cache[code] = overview_loader(code)
            row = cache[code]
            if row and normalize_name(row.get("FULL_NAME", "")) == normalize_name(company["name"]):
                exact_rows.append(row)
        if len(exact_rows) == 1:
            exact_count += 1
            references.append(reference_from_overview(company, exact_rows[0], directory_date))
        elif len(exact_rows) > 1:
            ambiguous.append({"companyId": company["id"], "exactOfficialRows": len(exact_rows)})
    return references, {
        "eligibleCompanies": len(eligible),
        "candidateSecurityCodes": candidate_count,
        "detailRequests": len(cache),
        "exactFullNameMatches": exact_count,
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
            "candidateSecurityCodes": 0,
            "detailRequests": 0,
            "exactFullNameMatches": 0,
            "uniqueReferences": 0,
            "publishedReferences": 0,
            "publishRequested": bool(args.publish),
        }
    else:
        if args.directory_file:
            directory, directory_date = parse_directory(Path(args.directory_file).read_text(encoding="utf-8"))
            source_requests = 0
        else:
            directory, directory_date = official_directory()
            source_requests = 1
        references, metrics = match_references(eligible, directory, directory_date)
        source_requests += metrics["detailRequests"]
        published = publish_references(args.origin, references) if args.publish else 0
        result = {
            "status": "PASS" if not metrics["ambiguousCompanies"] else "PASS_WITH_AMBIGUOUS_OFFICIAL_ROWS_SKIPPED",
            "provider": PROVIDER,
            "sourceUrl": "https://www.sse.com.cn/assortment/stock/list/share/",
            "directoryDate": directory_date,
            "sourceRequests": source_requests,
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
    p.add_argument("--directory-file", default="")
    p.add_argument("--publish", action="store_true")
    p.add_argument("--output", default="")
    return p


if __name__ == "__main__":
    print(json.dumps(run(parser().parse_args()), ensure_ascii=False))

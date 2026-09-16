#!/usr/bin/env python3
"""Collect exact-match CSRC administrative-penalty decisions for existing China companies."""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlsplit

if __package__:
    from .nmpa_udi_daily import DEFAULT_ORIGIN, UA, http_bytes, http_json, load_agent_token, normalize_name
else:
    from nmpa_udi_daily import DEFAULT_ORIGIN, UA, http_bytes, http_json, load_agent_token, normalize_name

PROVIDER = "CN_CSRC_PENALTY"
SOURCE_OF_RECORD = "中国证券监督管理委员会"
SEARCH_URL = "https://www.csrc.gov.cn/guestweb4/s"
CSRC_ROOT = "https://www.csrc.gov.cn/"


def is_china_region(value: str) -> bool:
    v = str(value or "").strip().casefold()
    return v in {"cn", "china", "中国", "中华人民共和国", "中国大陆", "mainland china"} or "中国" in v


def eligible_companies(companies):
    return [c for c in companies if not c.get("synthetic") and is_china_region(c.get("region", "")) and len(str(c.get("name", "")).strip()) >= 3]


def strip_tags(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return " ".join(html.unescape(value).split())


def post_search(name: str, timeout: int = 30) -> bytes:
    payload = urllib.parse.urlencode({
        "searchWord": name,
        "uc": "1",
        "siteCode": "bm56000001",
        "column": "全部",
        "button": "提交",
    }).encode("utf-8")
    req = urllib.request.Request(
        SEARCH_URL, data=payload, method="POST",
        headers={"User-Agent": UA, "Accept": "text/html,*/*", "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()
    except Exception:
        completed = subprocess.run(
            ["curl", "--fail-with-body", "--silent", "--show-error", "--location", "--max-time", str(timeout),
             "--header", f"User-Agent: {UA}", "--header", "Content-Type: application/x-www-form-urlencoded",
             "--data-binary", "@-", SEARCH_URL],
            input=payload, capture_output=True, check=False, timeout=timeout + 5,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"CSRC search failed ({completed.returncode})")
        return completed.stdout


def canonical_csrc_url(raw: str) -> str:
    value = html.unescape(str(raw or "")).strip().replace("\r", "").replace("\n", "")
    if value.startswith("//"):
        value = "https:" + value
    elif value.startswith("/"):
        value = urljoin(CSRC_ROOT, value)
    try:
        u = urlsplit(value)
    except ValueError:
        return ""
    if u.scheme != "https" or u.hostname != "www.csrc.gov.cn" or "/csrc/c101928/" not in u.path or not u.path.endswith("/content.shtml"):
        return ""
    return urllib.parse.urlunsplit((u.scheme, u.netloc, u.path, "", ""))


def parse_search_results(raw: bytes) -> list[dict]:
    text = raw.decode("utf-8", "ignore")
    starts = [m.start() for m in re.finditer(r'<div\s+class=["\']wordGuide\b', text, flags=re.I)]
    rows = []
    for i, start in enumerate(starts):
        block = text[start: starts[i + 1] if i + 1 < len(starts) else min(len(text), start + 24000)]
        href_match = re.search(r'href=["\']([^"\']*?/csrc/c101928/[^"\']*?/content\.shtml\s*)["\']', block, flags=re.I | re.S)
        if not href_match:
            continue
        url = canonical_csrc_url(href_match.group(1))
        if not url:
            continue
        title_match = re.search(r'class=["\'][^"\']*titleSelf[^"\']*["\'][^>]*>(.*?)</a>', block, flags=re.I | re.S)
        summary_match = re.search(r'<p\s+class=["\']summaryFont["\'][^>]*>(.*?)</p>', block, flags=re.I | re.S)
        date_match = re.search(r'<span\s+class=["\']sourceDateFont["\'][^>]*>\s*(20\d{2}-\d{2}-\d{2})\s*</span>', block, flags=re.I | re.S)
        rows.append({
            "url": url,
            "title": strip_tags(title_match.group(1)) if title_match else "中国证券监督管理委员会行政处罚决定书",
            "summary": strip_tags(summary_match.group(1))[:1600] if summary_match else "",
            "date": date_match.group(1) if date_match else "",
        })
    seen = set(); unique = []
    for row in rows:
        if row["url"] in seen:
            continue
        seen.add(row["url"]); unique.append(row)
    return unique


def decision_number(text: str) -> str:
    m = re.search(r"〔\s*(20\d{2})\s*〕\s*([0-9]+)\s*号", text)
    return f"〔{m.group(1)}〕{m.group(2)}号" if m else ""


def source_record_id(url: str) -> str:
    m = re.search(r"/(c\d+)/content\.shtml", url)
    return m.group(1) if m else url.rsplit("/", 2)[-2][:120]


def page_date(text: str, fallback: str = "") -> str:
    for pattern in (r"(20\d{2}-\d{2}-\d{2})", r"(20\d{2})年(\d{1,2})月(\d{1,2})日"):
        m = re.search(pattern, text)
        if not m:
            continue
        if len(m.groups()) == 1:
            return m.group(1)
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return fallback


def exact_party_in_decision(text: str, company_name: str) -> bool:
    name = str(company_name or "").strip()
    if not name:
        return False
    pattern = rf"当事人\s*[：:]\s*{re.escape(name)}(?=\s*[（(，,；;。]|\s*住所\s*[：:])"
    return re.search(pattern, text) is not None


def event_from_decision(company: dict, result: dict, raw: bytes) -> dict | None:
    text = strip_tags(raw.decode("utf-8", "ignore"))
    if not exact_party_in_decision(text, company.get("name", "")):
        return None
    number = decision_number(text)
    date = result.get("date") or page_date(text)
    summary = f"中国证监会公开的行政处罚决定将{company['name']}列为当事人"
    if number:
        summary += f"，决定书编号为{number}"
    if date:
        summary += f"，公开日期为{date}"
    summary += "。具体违法事实、责任认定、处罚内容、涉及期间以及后续救济/更正状态以官方决定书原文为准。"
    return {
        "companyId": company["id"],
        "provider": PROVIDER,
        "jurisdiction": "CN",
        "eventType": "ADMINISTRATIVE_PENALTY",
        "title": (result.get("title") or "中国证券监督管理委员会行政处罚决定书")[:300],
        "summary": summary[:1600],
        "eventDate": date,
        "decisionNo": number,
        "status": "ADMINISTRATIVE_PENALTY_DECISION_PUBLISHED",
        "sourceRecordId": source_record_id(result["url"]),
        "sourceOfRecord": SOURCE_OF_RECORD,
        "sourceUrl": result["url"],
        "sourceDate": date,
        "confidence": "HIGH",
        "scope": "中国证监会公开的这一份具体行政处罚决定及其载明的当事人、事实、决定和日期。",
        "caveat": "该决定仅支持决定书明确记载的证券监管行政处罚事实和所涉期间/主体；不能自动扩张为企业其他业务、其他期间的违法结论，也不替代行政复议、诉讼或后续更正状态。",
        "attributes": {"decisionNumber": number} if number else {},
    }


def collect(companies, *, search=post_search, fetch=http_bytes) -> tuple[list[dict], dict]:
    eligible = eligible_companies(companies)
    events = []; search_requests = 0; detail_requests = 0; search_results = 0; errors = []
    for company in eligible:
        try:
            rows = parse_search_results(search(company["name"], timeout=30)); search_requests += 1; search_results += len(rows)
        except Exception as exc:
            search_requests += 1; errors.append({"stage": "search", "companyId": company["id"], "error": type(exc).__name__}); continue
        for row in rows[:12]:
            # The official search is phrase-based. Require the exact full company name in the result snippet before detail retrieval.
            if normalize_name(company["name"]) not in normalize_name(row.get("summary", "")):
                continue
            try:
                raw = fetch(row["url"], timeout=30); detail_requests += 1
                event = event_from_decision(company, row, raw)
                if event:
                    events.append(event)
            except Exception as exc:
                detail_requests += 1; errors.append({"stage": "detail", "companyId": company["id"], "url": row["url"], "error": type(exc).__name__})
    seen = set(); unique = []
    for event in events:
        key = (event["companyId"], event["sourceRecordId"], event["eventType"])
        if key in seen:
            continue
        seen.add(key); unique.append(event)
    return unique, {
        "eligibleCompanies": len(eligible), "searchRequests": search_requests, "searchResults": search_results,
        "detailRequests": detail_requests, "uniqueEvents": len(unique), "errors": errors,
    }


def load_companies(origin: str, companies_file: str = "") -> list[dict]:
    if companies_file:
        data = json.loads(Path(companies_file).read_text(encoding="utf-8"))
        return data.get("items", data) if isinstance(data, dict) else data
    return http_json(f"{origin.rstrip('/')}/api/companies").get("items", [])


def publish_events(origin: str, items: list[dict]) -> int:
    if not items:
        return 0
    result = http_json(
        f"{origin.rstrip('/')}/api/community-agent/official-events",
        token=load_agent_token(), method="POST", payload={"items": items}, timeout=45,
    )
    return int(result.get("savedCount", 0))


def run(args) -> dict:
    companies = load_companies(args.origin, args.companies_file)
    events, metrics = collect(companies)
    published = publish_events(args.origin, events) if args.publish else 0
    result = {
        "status": "PASS" if not metrics["errors"] else "PASS_WITH_SOURCE_ERRORS",
        "provider": PROVIDER, **metrics, "publishedEvents": published, "publishRequested": bool(args.publish),
    }
    if args.output:
        path = Path(args.output); path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def parser():
    p = argparse.ArgumentParser()
    p.add_argument("--origin", default=DEFAULT_ORIGIN)
    p.add_argument("--companies-file", default="")
    p.add_argument("--publish", action="store_true")
    p.add_argument("--output", default="")
    return p


if __name__ == "__main__":
    print(json.dumps(run(parser().parse_args()), ensure_ascii=False))

#!/usr/bin/env python3
"""Collect exact-match China SAMR defective-product recall events for existing company spaces.

The collector scans only a bounded number of public recall index pages. It fetches a detail
page only after the complete company name is present in the producer prefix of the recall title.
"""
from __future__ import annotations

import argparse
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

if __package__:
    from .nmpa_udi_daily import DEFAULT_ORIGIN, http_bytes, http_json, load_agent_token, normalize_name
else:
    from nmpa_udi_daily import DEFAULT_ORIGIN, http_bytes, http_json, load_agent_token, normalize_name

PROVIDER = "CN_SAMR_RECALL"
SOURCE_OF_RECORD = "国家市场监督管理总局缺陷产品召回技术中心"
VEHICLE_INDEX = "https://www.samrdprc.org.cn/qczh/qczhgg1/"
CONSUMER_INDEX = "https://www.samrdprc.org.cn/xfpzh/xfpzhgg/"
SOURCE_ROOT = "https://www.samrdprc.org.cn/"


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


def index_url(base: str, page: int) -> str:
    return base if page == 0 else urljoin(base, f"index_{page}.html")


def parse_index(raw: bytes, base: str, category: str) -> list[dict]:
    text = raw.decode("utf-8", "ignore")
    rows = []
    for block in re.findall(r"<li\b[^>]*>(.*?)</li>", text, flags=re.I | re.S):
        anchor = re.search(r"<a\b([^>]*)href=[\"']([^\"']+)[\"']([^>]*)>(.*?)</a>", block, flags=re.I | re.S)
        if not anchor:
            continue
        attrs = f"{anchor.group(1)} {anchor.group(3)}"
        title_match = re.search(r"title=[\"']([^\"']+)[\"']", attrs, flags=re.I | re.S)
        title = html.unescape(title_match.group(1)).strip() if title_match else strip_tags(anchor.group(4))
        if "召回" not in title:
            continue
        date_match = re.search(r"(20\d{2}-\d{2}-\d{2})", strip_tags(block))
        href = urljoin(base, html.unescape(anchor.group(2)).strip())
        if not href.startswith(SOURCE_ROOT):
            continue
        rows.append({"title": title, "url": href, "date": date_match.group(1) if date_match else "", "category": category})
    return rows


def title_producer_names(title: str) -> list[str]:
    prefix = str(title or "").split("召回", 1)[0].strip()
    prefix = re.sub(r"(?:再次|扩大|主动|自愿)$", "", prefix).strip(" ，、,；;：:")
    parts = [x.strip() for x in re.split(r"[、，,；;]|\s+和\s+", prefix) if x.strip()]
    return parts


def title_matches_company(title: str, company_name: str) -> bool:
    target = normalize_name(company_name)
    return any(normalize_name(x) == target for x in title_producer_names(title))


class CellParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.buf = []
        self.cells = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() in {"td", "th"}:
            self.active = True
            self.buf = []

    def handle_data(self, data):
        if self.active:
            self.buf.append(data)

    def handle_endtag(self, tag):
        if self.active and tag.lower() in {"td", "th"}:
            value = " ".join("".join(self.buf).split())
            if value:
                self.cells.append(value)
            self.active = False
            self.buf = []


def cell_pairs(raw: bytes) -> dict[str, str]:
    parser = CellParser()
    parser.feed(raw.decode("utf-8", "ignore"))
    pairs = {}
    labels = {
        "生产者名称", "召回实施时间", "召回车辆总数量", "缺陷描述", "可能造成的后果", "召回维修措施",
        "产品名称", "召回产品数量", "召回数量", "召回范围", "主要问题", "存在的问题", "改进措施"
    }
    cells = parser.cells
    for i, cell in enumerate(cells[:-1]):
        if cell in labels and cell not in pairs:
            pairs[cell] = cells[i + 1]
    return pairs


def recall_number(raw: bytes) -> str:
    text = strip_tags(raw.decode("utf-8", "ignore"))
    m = re.search(r"召回编号[：:]\s*([A-Za-z0-9-]{4,80})", text)
    return m.group(1) if m else ""


def record_id_from_url(url: str) -> str:
    m = re.search(r"t(\d+)_([0-9]+)\.html", url)
    return f"{m.group(1)}-{m.group(2)}" if m else url.rsplit("/", 1)[-1][:120]


def event_from_detail(company: dict, row: dict, raw: bytes) -> dict | None:
    pairs = cell_pairs(raw)
    producer = pairs.get("生产者名称", "")
    if producer and normalize_name(producer) != normalize_name(company.get("name", "")):
        return None
    page_text = strip_tags(raw.decode("utf-8", "ignore"))
    if normalize_name(company.get("name", "")) not in normalize_name(page_text):
        return None
    number = recall_number(raw) or record_id_from_url(row["url"])
    defect = pairs.get("缺陷描述") or pairs.get("主要问题") or pairs.get("存在的问题") or ""
    repair = pairs.get("召回维修措施") or pairs.get("改进措施") or ""
    count = pairs.get("召回车辆总数量") or pairs.get("召回产品数量") or pairs.get("召回数量") or ""
    execution = pairs.get("召回实施时间", "")
    summary_parts = []
    if count:
        summary_parts.append(f"召回数量：{count}")
    if execution:
        summary_parts.append(f"实施时间：{execution}")
    if defect:
        summary_parts.append(f"公告缺陷描述：{defect[:700]}")
    if repair:
        summary_parts.append(f"召回措施：{repair[:500]}")
    attrs = {
        "recallNumber": number,
        "category": row["category"],
        "producerName": producer or company.get("name", ""),
        "recallCount": count,
        "implementationPeriod": execution,
        "defectDescription": defect[:800],
        "remedy": repair[:700],
    }
    attrs = {k: v for k, v in attrs.items() if v}
    return {
        "companyId": company["id"],
        "provider": PROVIDER,
        "jurisdiction": "CN",
        "eventType": "PRODUCT_RECALL",
        "title": row["title"][:300],
        "summary": "；".join(summary_parts)[:1600],
        "eventDate": row.get("date", ""),
        "decisionNo": number,
        "status": "OFFICIAL_RECALL_NOTICE",
        "sourceRecordId": record_id_from_url(row["url"]),
        "sourceOfRecord": SOURCE_OF_RECORD,
        "sourceUrl": row["url"],
        "sourceDate": row.get("date", ""),
        "confidence": "HIGH",
        "scope": "国家市场监督管理总局缺陷产品召回技术中心公开的这一条具体汽车/消费品召回公告。",
        "caveat": "该官方公告仅支持这一次具体召回活动、涉及产品范围及公告所述缺陷/措施；不能据此推断企业全部产品质量、安全水平、违法情况或当前所有产品状态。",
        "attributes": attrs,
    }


def collect(companies, *, pages: int = 2, fetch=http_bytes) -> tuple[list[dict], dict]:
    eligible = eligible_companies(companies)
    if not eligible:
        return [], {"eligibleCompanies": 0, "indexRequests": 0, "detailRequests": 0, "indexRecords": 0, "exactTitleMatches": 0, "uniqueEvents": 0, "errors": []}
    index_rows = []
    errors = []
    index_requests = 0
    for base, category in ((VEHICLE_INDEX, "vehicle"), (CONSUMER_INDEX, "consumer_product")):
        for page in range(max(1, min(5, int(pages)))):
            url = index_url(base, page)
            try:
                index_rows.extend(parse_index(fetch(url, timeout=30), base, category))
                index_requests += 1
            except Exception as exc:
                index_requests += 1
                errors.append({"stage": "index", "url": url, "error": type(exc).__name__})
    matched = []
    title_matches = 0
    detail_rejected = 0
    detail_requests = 0
    for company in eligible:
        for row in index_rows:
            if not title_matches_company(row["title"], company["name"]):
                continue
            title_matches += 1
            try:
                raw = fetch(row["url"], timeout=30)
                detail_requests += 1
                event = event_from_detail(company, row, raw)
                if event:
                    matched.append(event)
                else:
                    detail_rejected += 1
            except Exception as exc:
                detail_requests += 1
                errors.append({"stage": "detail", "companyId": company["id"], "url": row["url"], "error": type(exc).__name__})
    seen = set()
    unique = []
    for item in matched:
        key = (item["companyId"], item["sourceRecordId"], item["eventType"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique, {
        "eligibleCompanies": len(eligible),
        "indexRequests": index_requests,
        "detailRequests": detail_requests,
        "indexRecords": len(index_rows),
        "exactTitleMatches": title_matches,
        "detailAccepted": len(matched),
        "detailRejected": detail_rejected,
        "uniqueEvents": len(unique),
        "errors": errors,
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
    events, metrics = collect(companies, pages=args.pages)
    published = publish_events(args.origin, events) if args.publish else 0
    result = {
        "status": "PASS" if not metrics["errors"] else "PASS_WITH_SOURCE_ERRORS",
        "provider": PROVIDER,
        **metrics,
        "publishedEvents": published,
        "publishRequested": bool(args.publish),
    }
    if args.output:
        path = Path(args.output); path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def parser():
    p = argparse.ArgumentParser()
    p.add_argument("--origin", default=DEFAULT_ORIGIN)
    p.add_argument("--companies-file", default="")
    p.add_argument("--pages", type=int, default=2)
    p.add_argument("--publish", action="store_true")
    p.add_argument("--output", default="")
    return p


if __name__ == "__main__":
    print(json.dumps(run(parser().parse_args()), ensure_ascii=False))

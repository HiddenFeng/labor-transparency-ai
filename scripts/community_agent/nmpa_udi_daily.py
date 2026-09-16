#!/usr/bin/env python3
"""Collect bounded China NMPA UDI company→product relations from the official daily feed.

This script deliberately stores/publishes only records that exactly match companies already
present in Labor Transparency. It never republishes the bulk UDI dataset.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
import unicodedata
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Iterable

DEFAULT_ORIGIN = "https://workermanifestfellowship.dpdns.org"
DEFAULT_RSS = "https://udi.nmpa.gov.cn/rss/download.html?files=daily"
SOURCE_OF_RECORD = "国家药品监督管理局医疗器械唯一标识数据库"
SOURCE_ROOT = "https://udi.nmpa.gov.cn/"
UA = "LaborTransparencyPublicInterest/0.8.4 NMPA-UDI-Agent"
KEYCHAIN_SERVICE = "labor-transparency-community-agent"


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value or ""))
    return re.sub(r"\s+", "", value).casefold()


def _curl_request(url: str, *, timeout: int = 45, method: str = "GET", body=None, token: str = "", accept: str = "*/*") -> bytes:
    args = [
        "curl", "--fail-with-body", "--silent", "--show-error", "--location",
        "--max-time", str(max(1, int(timeout))), "--request", method,
        "--header", f"User-Agent: {UA}", "--header", f"Accept: {accept}",
    ]
    if body is not None:
        args += ["--header", "Content-Type: application/json", "--data-binary", "@-"]
    read_fd = None
    if token:
        # Keep bearer credentials out of argv/process listings and project files.
        read_fd, write_fd = os.pipe()
        try:
            os.write(write_fd, f"Authorization: Bearer {token}\n".encode("utf-8"))
        finally:
            os.close(write_fd)
        args += ["--header", f"@/dev/fd/{read_fd}"]
    try:
        completed = subprocess.run(
            [*args, url], input=body, capture_output=True, check=False,
            timeout=max(2, int(timeout) + 5), pass_fds=(() if read_fd is None else (read_fd,)),
        )
    finally:
        if read_fd is not None:
            os.close(read_fd)
    if completed.returncode != 0:
        message = completed.stderr.decode("utf-8", "replace").strip()[:500]
        raise RuntimeError(f"curl request failed ({completed.returncode}): {message}")
    return completed.stdout


def _d1_control_fallback(url: str, *, method: str = "GET", payload=None, token: str = ""):
    parsed = urllib.parse.urlsplit(url)
    allowed_hosts = {
        "workermanifestfellowship.dpdns.org",
        "labor-transparency-api.labor-transparency-public.workers.dev",
    }
    if parsed.hostname not in allowed_hosts or parsed.query or parsed.fragment:
        raise RuntimeError("D1 control fallback is only available for canonical production API paths")
    write = method.upper() not in {"GET", "HEAD"}
    if write and not token:
        raise RuntimeError("D1 control fallback refuses trusted mutations without a community Agent credential")
    bridge = Path(__file__).with_name("d1_fallback.mjs")
    raw_payload = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    completed = subprocess.run(
        ["node", str(bridge), method.upper(), parsed.path], input=raw_payload,
        capture_output=True, check=False, timeout=90,
    )
    if completed.returncode != 0:
        message = completed.stderr.decode("utf-8", "replace").strip()[-1000:]
        raise RuntimeError(f"Wrangler D1 control fallback failed ({completed.returncode}): {message}")
    return json.loads(completed.stdout.decode("utf-8"))


def http_bytes(url: str, *, timeout: int = 45) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()
    except Exception:
        return _curl_request(url, timeout=timeout)


def http_json(url: str, *, token: str = "", method: str = "GET", payload=None, timeout: int = 45):
    headers = {"User-Agent": UA, "Accept": "application/json"}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    # LocalAgentRuntime runs on this Mac, where Python's system TLS stack has shown
    # intermittent handshake failures to the canonical production/API hosts while
    # system curl remains healthy. Use curl directly for those two bounded hosts;
    # keep urllib-first behavior for ordinary public-source APIs.
    if url.startswith(DEFAULT_ORIGIN) or url.startswith("https://labor-transparency-api.labor-transparency-public.workers.dev"):
        try:
            raw = _curl_request(url, timeout=min(timeout,8), method=method, body=body, token=token, accept="application/json")
        except Exception:
            return _d1_control_fallback(url, method=method, payload=payload, token=token)
    else:
        req = urllib.request.Request(url, method=method, headers=headers, data=body)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                raw = response.read()
        except Exception:
            raw = _curl_request(url, timeout=timeout, method=method, body=body, token=token, accept="application/json")
    return json.loads(raw.decode("utf-8"))


def load_agent_token() -> str:
    value = os.environ.get("LTP_COMMUNITY_AGENT_TOKEN", "").strip()
    if value:
        return value
    if sys_platform_is_macos():
        try:
            found = subprocess.run(
                ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
                check=True, capture_output=True, text=True, timeout=5,
            ).stdout.strip()
            if found:
                return found
        except (subprocess.SubprocessError, FileNotFoundError):
            pass
    raise RuntimeError("community Agent credential is not configured in environment or macOS Keychain")


def sys_platform_is_macos() -> bool:
    import sys
    return sys.platform == "darwin"


def latest_feed_item(rss_bytes: bytes) -> dict:
    root = ET.fromstring(rss_bytes)
    item = root.find("./channel/item")
    if item is None:
        raise RuntimeError("NMPA UDI daily RSS has no item")
    def txt(name: str) -> str:
        node = item.find(name)
        return (node.text or "").strip() if node is not None else ""
    link = txt("link")
    if not link.startswith("https://"):
        raise RuntimeError("NMPA UDI daily RSS returned a non-HTTPS download URL")
    return {"title": txt("title"), "description": txt("description"), "pubDate": txt("pubDate"), "link": link}


def company_index(companies: Iterable[dict]) -> dict[str, dict]:
    out = {}
    for company in companies:
        if company.get("synthetic"):
            continue
        key = normalize_name(company.get("name", ""))
        if key:
            out[key] = company
    return out


def text_map(device: ET.Element) -> dict[str, str]:
    return {child.tag: (child.text or "").strip() for child in list(device)}


def relation_from_device(company: dict, row: dict[str, str], source_url: str) -> dict | None:
    product = row.get("cpmctymc") or row.get("spmc")
    record_key = row.get("deviceRecordKey") or row.get("zxxsdycpbs")
    if not product or not record_key:
        return None
    description = row.get("cpms", "")[:800]
    attributes = {
        "udiDi": row.get("zxxsdycpbs", ""),
        "tradeName": row.get("spmc", ""),
        "model": row.get("ggxh", ""),
        "unifiedSocialCreditCode": row.get("tyshxydm", ""),
        "registrationOrFilingNumber": row.get("zczbhhzbapzbh", ""),
        "registrantName": row.get("ylqxzcrbarmc", ""),
        "registrantEnglishName": row.get("ylqxzcrbarywmc", ""),
        "deviceCategory": row.get("qxlb", ""),
        "classificationCode": row.get("flbm", ""),
        "productCategory": row.get("cplb", ""),
        "modelOrSpecification": row.get("ggxh", ""),
        "description": description,
        "versionStatus": row.get("versionStauts", ""),
        "versionNumber": row.get("versionNumber", ""),
    }
    attributes = {k: v for k, v in attributes.items() if v not in (None, "")}
    return {
        "companyId": company["id"],
        "provider": "CN_NMPA_UDI",
        "jurisdiction": "CN",
        "relationType": "COMPANY_REGISTERS_PRODUCT",
        "objectType": "product",
        "objectName": product,
        "objectExternalId": row.get("zxxsdycpbs", "") or record_key,
        "sourceRecordId": record_key,
        "sourceOfRecord": SOURCE_OF_RECORD,
        "sourceUrl": source_url or SOURCE_ROOT,
        "sourceDate": row.get("versionTime", "") if re.fullmatch(r"\d{4}-\d{2}-\d{2}", row.get("versionTime", "")) else "",
        "confidence": "HIGH",
        "scope": f"NMPA UDI 记录中的注册人/备案人“{row.get('ylqxzcrbarmc','')}”与该医疗器械产品标识的关系。",
        "caveat": "该官方记录只支持此注册人/备案人与该条医疗器械 UDI/注册备案记录的具体关系；不代表平台认定产品整体质量、安全性、疗效，也不代表该公司的完整产品目录。",
        "attributes": attributes,
    }


def parse_relations(xml_file, companies: Iterable[dict], source_url: str) -> tuple[list[dict], dict]:
    by_name = company_index(companies)
    relations = []
    scanned = 0
    matched_devices = 0
    matched_companies = set()
    for event, elem in ET.iterparse(xml_file, events=("end",)):
        if elem.tag != "device":
            continue
        scanned += 1
        row = text_map(elem)
        company = by_name.get(normalize_name(row.get("ylqxzcrbarmc", "")))
        if company:
            relation = relation_from_device(company, row, source_url)
            if relation:
                relations.append(relation)
                matched_devices += 1
                matched_companies.add(company["id"])
        elem.clear()
    # Deterministic dedupe in case one release repeats the same device record.
    seen = set()
    unique = []
    for rel in relations:
        key = (rel["companyId"], rel["sourceRecordId"], rel["objectExternalId"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(rel)
    return unique, {
        "recordsScanned": scanned,
        "matchedDevices": matched_devices,
        "uniqueRelations": len(unique),
        "matchedCompanies": len(matched_companies),
    }


def extract_xml_from_zip(zip_path: Path, target_dir: Path) -> Path:
    with zipfile.ZipFile(zip_path) as archive:
        xml_names = [name for name in archive.namelist() if name.lower().endswith(".xml")]
        if len(xml_names) != 1:
            raise RuntimeError(f"expected one XML in NMPA daily ZIP, got {len(xml_names)}")
        archive.extract(xml_names[0], target_dir)
        return target_dir / xml_names[0]


def publish_relations(origin: str, token: str, relations: list[dict]) -> int:
    saved = 0
    for start in range(0, len(relations), 250):
        batch = relations[start:start + 250]
        result = http_json(f"{origin.rstrip('/')}/api/community-agent/official-relations", token=token, method="POST", payload={"items": batch})
        saved += int(result.get("savedCount", 0))
    return saved


def load_companies(origin: str, companies_file: str = "") -> list[dict]:
    if companies_file:
        data = json.loads(Path(companies_file).read_text(encoding="utf-8"))
        return data.get("items", data) if isinstance(data, dict) else data
    data = http_json(f"{origin.rstrip('/')}/api/companies")
    return data.get("items", [])


def run(args) -> dict:
    origin = args.origin.rstrip("/")
    companies = load_companies(origin, args.companies_file)
    feed = {"title": "fixture", "description": "", "pubDate": "", "link": args.source_url or SOURCE_ROOT}
    with tempfile.TemporaryDirectory(prefix="ltp-nmpa-udi-") as temp:
        temp_dir = Path(temp)
        if args.xml_file:
            xml_path = Path(args.xml_file)
        else:
            if args.zip_file:
                zip_path = Path(args.zip_file)
                source_url = args.source_url or SOURCE_ROOT
            else:
                feed = latest_feed_item(http_bytes(args.rss_url))
                source_url = feed["link"]
                zip_path = temp_dir / "daily.zip"
                zip_path.write_bytes(http_bytes(source_url, timeout=90))
            xml_path = extract_xml_from_zip(zip_path, temp_dir)
        relations, metrics = parse_relations(xml_path, companies, args.source_url or feed["link"])
        published = 0
        if args.publish and relations:
            token = load_agent_token()
            published = publish_relations(origin, token, relations)
        result = {
            "status": "PASS",
            "provider": "CN_NMPA_UDI",
            "feed": {"title": feed["title"], "pubDate": feed["pubDate"], "sourceUrl": args.source_url or feed["link"]},
            "companiesConsidered": len(company_index(companies)),
            **metrics,
            "publishedRelations": published,
            "publishRequested": bool(args.publish),
        }
        if args.output:
            Path(args.output).parent.mkdir(parents=True, exist_ok=True)
            Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return result


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser()
    p.add_argument("--origin", default=DEFAULT_ORIGIN)
    p.add_argument("--rss-url", default=DEFAULT_RSS)
    p.add_argument("--companies-file", default="")
    p.add_argument("--zip-file", default="")
    p.add_argument("--xml-file", default="")
    p.add_argument("--source-url", default="")
    p.add_argument("--publish", action="store_true")
    p.add_argument("--output", default="")
    return p


if __name__ == "__main__":
    result = run(parser().parse_args())
    print(json.dumps(result, ensure_ascii=False))

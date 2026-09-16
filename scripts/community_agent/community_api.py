#!/usr/bin/env python3
"""Small authenticated CLI for the daily community Agent.

The browser/runtime Agent should use this instead of hand-building HTTP requests.
Token is read only from LTP_COMMUNITY_AGENT_TOKEN.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from scripts.community_agent.nmpa_udi_daily import DEFAULT_ORIGIN, http_json, load_agent_token


def load_payload(path: str):
    if path == "-":
        return json.load(sys.stdin)
    return json.loads(Path(path).read_text(encoding="utf-8"))


def call(origin: str, path: str, *, method="GET", payload=None):
    return http_json(f"{origin.rstrip('/')}{path}", token=load_agent_token(), method=method, payload=payload)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--origin", default=DEFAULT_ORIGIN)
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("state")
    sub.add_parser("queue")
    r = sub.add_parser("respond")
    r.add_argument("feedback_id")
    r.add_argument("--decision", choices=["answered","accepted","planned","declined","needs_more_info"], default="answered")
    r.add_argument("--answer", required=True)
    r.add_argument("--action", action="append", default=[])
    a = sub.add_parser("announce")
    a.add_argument("json_file")
    dr = sub.add_parser("daily-run")
    dr.add_argument("json_file")
    args = p.parse_args()
    if args.command == "state":
        out = call(args.origin, "/api/community-agent/state")
    elif args.command == "queue":
        out = call(args.origin, "/api/community-agent/queue")
    elif args.command == "respond":
        out = call(args.origin, f"/api/community-agent/feedback/{args.feedback_id}/respond", method="POST", payload={"decision":args.decision,"answer":args.answer,"actions":args.action})
    elif args.command == "announce":
        out = call(args.origin, "/api/community-agent/announcements", method="POST", payload=load_payload(args.json_file))
    elif args.command == "daily-run":
        out = call(args.origin, "/api/community-agent/daily-run", method="POST", payload=load_payload(args.json_file))
    else:
        raise RuntimeError("unsupported command")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

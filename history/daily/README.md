# Daily community operations history

This directory is the durable project-local record for the Beijing-time 18:00 operations pass and 19:00 review pass.

Each day uses `history/daily/YYYY-MM-DD/` and may contain:

- `nmpa-udi.json` — bounded NMPA UDI collection metrics only, not the bulk source dataset.
- `eu-ted.json` — bounded EU TED collection metrics only; specific matching notice URLs remain in official relation records.
- `announcement.json` — public announcement payload actually submitted to the Web API.
- `run-18.json` — phase-18 database run record payload.
- `18-operations.md` — what the 18:00 Agent actually completed and what remained.
- `run-19.json` — phase-19 database run record payload.
- `19-review.md` — independent completion review and continuation evidence.
- `summary.md` — final total record for the day.

Do not copy user feedback message text, private advisory text, tokens, session cookies, personal identifiers, or source bulk datasets into this directory. Feedback may be referenced by opaque feedback ID, type, decision and aggregate count only.

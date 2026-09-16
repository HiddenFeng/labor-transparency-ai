# Daily Agent Operations — LocalAgentRuntime

Date: 2026-09-16
Timezone: `Asia/Shanghai`

## Schedule contract

Two independent LocalAgentRuntime fixed recurring invocations run every 86,400 seconds after their initial Beijing-time anchor:

- 18:00 — daily community/data operations. Authority: `agents/DAILY_COMMUNITY_AGENT.md`.
- 19:00 — independent completion review and continuation. Authority: `agents/DAILY_COMMUNITY_REVIEW_AGENT.md`.

The platform intentionally does **not** poll or monitor whether an Agent is actively working between these invocations. The 19:00 pass reads project/database evidence and continues incomplete work where appropriate.

Conversation URLs and fixed-run IDs are recorded below only after successful LocalAgentRuntime creation. They are operational references, not public website data.

## Local credential

`LTP_COMMUNITY_AGENT_TOKEN` is a Cloudflare Worker secret and must never be committed. On the project Mac, helper scripts also support macOS Keychain service:

`labor-transparency-community-agent`

Do not print or copy the credential into daily logs, announcements, chat prompts, screenshots or QA artifacts.

## Supported daily commands

Read state:

`python3 scripts/community_agent/community_api.py state`

Read pending feedback:

`python3 scripts/community_agent/community_api.py queue`

Collect/publish current official relation matches:

`python3 scripts/community_agent/nmpa_udi_daily.py --publish --output history/daily/YYYY-MM-DD/nmpa-udi.json`

`python3 scripts/community_agent/eu_ted_daily.py --publish --output history/daily/YYYY-MM-DD/eu-ted.json`

Respond to one feedback item:

`python3 scripts/community_agent/community_api.py respond <feedback-id> --decision planned --answer "..." --action "..."`

Publish/update the day's announcement from JSON:

`python3 scripts/community_agent/community_api.py announce history/daily/YYYY-MM-DD/announcement.json`

Record phase 18/19 from JSON:

`python3 scripts/community_agent/community_api.py daily-run history/daily/YYYY-MM-DD/run-18.json`

## Daily durable evidence

All local daily evidence goes under:

`history/daily/YYYY-MM-DD/`

Expected files when applicable:
- `nmpa-udi.json`
- `eu-ted.json`
- `announcement.json`
- `run-18.json`
- `18-operations.md`
- `run-19.json`
- `19-review.md`
- `summary.md`

User feedback message text is not copied into public announcements or project history. Daily logs may use feedback IDs, type, decision and non-sensitive aggregate counts.

## Web announcement contract

A public announcement is not a changelog dump. It should answer in plain language:
1. what became easier or more useful today;
2. what public information was added/updated;
3. which official/public sources support it;
4. what remains unknown or incomplete.

Announcements must not imply that a source record proves company quality, legality or wrongdoing beyond its exact scope.

## LocalAgentRuntime bindings

Installed 2026-09-16. The initial conversation messages only bound/read the role instructions; they did not execute scheduled daily collection. Caller-managed direct slots were explicitly released after Runtime discovered each route, without reading or monitoring remote answers.

- 18:00 conversation URL: `https://chatgpt.com/c/6aaa3b01-bf7c-83ea-a3ae-2a33b1e06de3`
- 18:00 fixed-run ID: `fx_0ae10ddc598947738441`
- 18:00 first scheduled trigger: `2026-09-16T10:00:00.479Z` = `2026-09-16 18:00:00.479 Asia/Shanghai`
- 19:00 conversation URL: `https://chatgpt.com/c/6aaa3bc2-5d90-83ea-ac3d-b28f397abdc0`
- 19:00 fixed-run ID: `fx_061391ba3d304dea8a8d`
- 19:00 first scheduled trigger: `2026-09-16T11:00:00.495Z` = `2026-09-16 19:00:00.495 Asia/Shanghai`
- recurrence: `86400` seconds for both tasks.
- Runtime task status at installation: `READY / enabled=true`.

Two initially-created fixed tasks that rounded the first delay down by less than one second were explicitly stopped before any scheduled occurrence; the IDs above are the corrected ceil-to-next-second tasks and are the only active daily bindings for this feature.

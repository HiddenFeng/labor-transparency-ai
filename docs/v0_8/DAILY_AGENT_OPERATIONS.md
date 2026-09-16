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

Collect/publish current official reference/relation/event matches. China companies are checked first:

`python3 scripts/community_agent/nmpa_udi_daily.py --publish --output history/daily/YYYY-MM-DD/nmpa-udi.json`

`python3 scripts/community_agent/cn_samr_recall_daily.py --publish --output history/daily/YYYY-MM-DD/cn-samr-recall.json`

`python3 scripts/community_agent/cn_csrc_penalty_daily.py --publish --output history/daily/YYYY-MM-DD/cn-csrc-penalty.json`

`python3 scripts/community_agent/eu_ted_daily.py --publish --output history/daily/YYYY-MM-DD/eu-ted.json`

`python3 scripts/community_agent/jp_nta_daily.py --publish --output history/daily/YYYY-MM-DD/jp-nta.json`

NMPA/TED records are scoped `OFFICIAL_SOURCE_RELATION`; SAMR recall and CSRC penalty records are scoped `OFFICIAL_SOURCE_EVENT`; Japan NTA daily-delta records are `OFFICIAL_SOURCE_REFERENCE`, not machine legal-identity upgrades. A zero-match result remains an explicit coverage result, never proof that no event/relationship exists outside the connected source scope.

### Command-line network fallback

Normal daily commands first use the canonical production `/api` surface. On this Mac, browser traffic and command-line traffic may take different network routes; direct Python/curl access to Vercel/Cloudflare can therefore be temporarily unavailable even while the public site is healthy.

The shared HTTP helper has one bounded fallback for that case: `scripts/community_agent/d1_fallback.mjs`. It uses the already-authenticated local Wrangler CLI to access the same production D1, reads the current revision/state, acquires the existing `ltp_write_lock`, calls the same domain validation/mutator functions, persists **only** `officialReferences`, `officialRelations`, `officialEvents`, `communityFeedback`, `communityFeedbackResponses`, `publicAnnouncements`, and `agentDailyRuns`, increments the state revision, then reads the revision back. It does not expose arbitrary SQL to the Agent and must never be extended to mutate companies, ballots, contributions, advisory records, or companyResearch as a convenience shortcut.

Trusted POST fallback is refused unless the caller already supplied the community-Agent credential. The Wrangler login on the project Mac is a second local authority boundary; neither credential nor Wrangler output containing account secrets may be copied into project history or announcements.

If both the normal API path and this bounded fallback fail, record `PARTIAL`/`FAILED` with the concrete error and let the 19:00 review pass continue. Do not improvise raw D1 SQL.

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
- `jp-nta.json`
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

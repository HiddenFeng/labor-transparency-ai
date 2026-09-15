# EdgeOne adapter — historical PoC only

This directory is retained for auditability of the v0.8.1 Mainland-path proof of concept.

It is **not part of the current production deployment path** and is **not a release gate**. The accepted production path is Vercel + Cloudflare Worker + D1, with GitHub Pages as a read-only fallback.

Current privacy policy forbids treating Tencent Cloud / EdgeOne account completion, real-name verification, identity documents or payment-method setup as required project work. Do not reactivate this adapter or perform Tencent account actions unless the user makes a new explicit decision accepting those provider/privacy implications.

The local build/proxy test can be retained as historical regression evidence. External deployment scripts are fail-closed unless `LTP_ENABLE_LEGACY_EDGEONE=true` is explicitly set after such a future decision.

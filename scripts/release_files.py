"""Explicit source release allowlist. Runtime data is never eligible."""
from pathlib import Path
ROOT_NAMES={'README.md','AGENTS.md','LICENSE','LICENSE-DATA.md','CONTRIBUTING.md','THIRD_PARTY_NOTICES.md','.gitignore','.dockerignore','requirements.txt','requirements-dev.txt'}
DIRS={'app','tests','scripts','examples','deploy','site-src','public-site','.github','agents','social','sites-app','cloudflare-backend'}
QA_NAMES={'verification.json','update_manifest.json','live-source.json','production-security.json','caddy-staging.json','launchd-supervision.json','clamav-real.json','round4-verification.json'}
QA_V07_NAMES={'verification.json','sites-browser-v071.json','sites-browser-v072.json','company-research-audit.json','live-source.json'}
QA_V08_NAMES={'verification.json','browser-independent.json','browser-v081.json','company-intelligence-audit.json','live-company-sources.json','live-company-intelligence.json','cloudflare-live-research.json','http-summary-v081.json','edgeone-mainland-preview-v081.json','public-deployment-v081.json','account-migration-v081.json'}
FORBIDDEN_PARTS={'__pycache__','node_modules','.venv','local-data','private','uploads','backups','.ltp-backups','.git','dist','.local','.wrangler','.vercel'}
FORBIDDEN_NAMES={'.dev.vars','.production.secrets','wrangler.production.jsonc'}
FORBIDDEN_EXT={'.db','.sqlite','.sqlite3','.key','.pem','.p12','.pfx','.ttf','.otf','.woff','.woff2','.zip','.pyc'}
def release_files(root):
    root=Path(root);files=[]
    for p in sorted(root.rglob('*')):
        rel=p.relative_to(root);parts=rel.parts
        if any(k in FORBIDDEN_PARTS for k in parts):continue
        if p.is_symlink():raise ValueError('发布目录中存在符号链接：'+str(rel))
        if not p.is_file():continue
        if p.suffix.lower() in FORBIDDEN_EXT or p.name.startswith('.env') or p.name in FORBIDDEN_NAMES:continue
        allowed=str(rel) in ROOT_NAMES or parts[0] in DIRS or (parts[0]=='docs' and len(parts)>2 and parts[1] in ('v0_4','v0_5','v0_6','v0_7','v0_8')) or (parts[:2]==('qa','v0_6') and p.name in QA_NAMES) or str(rel)=='qa/v0_6/browser/result.json' or (parts[:2]==('qa','v0_7') and p.name in QA_V07_NAMES) or (parts[:2]==('qa','v0_8') and p.name in QA_V08_NAMES)
        if allowed:files.append(p)
    return files

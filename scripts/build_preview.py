"""Rebuild current full whitepaper; does not create a second offline API engine."""
from pathlib import Path
import mistune
ROOT=Path(__file__).resolve().parents[1]
combined=(ROOT/'docs/白皮书增补_v0.3.md').read_text()+"\n\n---\n\n"+(ROOT/'docs/完整白皮书_v0.2_含原基线.md').read_text()
(ROOT/'docs/完整白皮书_v0.3_含历史基线.md').write_text(combined)
(ROOT/'app/web/whitepaper.html').write_text(mistune.create_markdown(escape=True,plugins=['table'])(combined))
print('Full whitepaper rebuilt. Use the server for v0.3 UI.')

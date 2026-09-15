# 第三方组件与素材

本项目原创代码按LICENSE公开；以下依赖权利不因本项目禁商用而被重新限制：

- Python运行时、标准库：PSF及其随附许可。
- FastAPI、Pydantic、Uvicorn：各上游组件的MIT或BSD许可，以锁定发行包LICENSE为准。
- cryptography：上游Apache-2.0/BSD条款，以安装发行包为准。
- httpx、Playwright：测试工具，遵守各发行包许可；不将其当作本项目原创。
- Node.js：仅用于工具与测试，以运行时随附许可为准。
- workers.jpg：承接前版生成的示意素材，不代表真实劳动者、真实公司或真实社区数据。

本发布包不含字体文件、node_modules、Python虚拟环境或第三方网站的全文镜像。正式发布前仍需对最终锁定的依赖和新引入素材进行许可证清单检查；本说明不是已完成全面法律审计的声明。


## v0.5 GLEIF reference data (network opt-in only)

Upstream API: https://www.gleif.org/en/lei-data/gleif-api
Open-data terms: https://www.gleif.org/en/about/open-data (CC0).
The project's nonprofit-use source license does not replace upstream rights. Legal-entity and accounting-consolidation relationships do not certify labor conditions, products, or a complete supply chain. Source metadata retains upstream attribution, retrieval time and content fingerprint. Runtime raw response caches are not a source-code release input. Live API compatibility remains unverified in this environment; see qa/v0_5/live-source.json.

## v0.8.1 public company-data sources

The v0.8.1 research candidate uses public-source metadata and bounded API/dataset queries. The project does not mirror third-party websites wholesale and does not override upstream licenses, terms, rate limits, or account requirements.

- **Wikidata** — contextual company metadata such as industry/product/brand/HQ/organization links and official website. Upstream data is CC0. Community graph assertions are treated as contextual candidates and may not override higher-authority official sources.
- **U.S. SEC EDGAR** — U.S. public-company filing metadata and selected XBRL company facts. Records remain U.S. government/public filing data; shared/cloud egress may be rate-limited or blocked and failures are preserved as source gaps.
- **NLRB public case/representation records** — used for procedural case, charge, petition, and voluntary-recognition records. The source of record remains the National Labor Relations Board; a filing/case is not automatically a finding of employer illegality.
- **U.S. Department of Labor / OSHA enforcement data** — inspection/citation records are scoped to the recorded establishment/event and must not be generalized to the whole company.
- **U.S. Department of Labor / Wage and Hour Division compliance-action data** — case-specific concluded enforcement fields may be described within their recorded period/scope; they do not describe all company locations or periods.
- **Federal Mediation and Conciliation Service (FMCS)** — F-7 bargaining notices and work-stoppage event data. These records describe bargaining/event facts, not automatic legal-fault conclusions.
- **U.S. Department of Labor / OLMS public disclosure room** — LM employer/consultant disclosure records are statutory disclosure records; they are not automatically equivalent to an unfair-labor-practice finding.
- **USAspending.gov** — U.S. federal award/contract records. A specific award may support a specific government-customer/award relationship but not the company's complete customer, supplier, or supply-chain network.
- **LaborData structured mirrors** — used as a query-friendly mirror for several U.S. public labor datasets. The relevant government agency remains the source of record. Mirror provenance is retained in the source registry and evidence metadata.
- **OpenCorporates** — optional adapter only. It stays disabled without an API token and an explicit license/redistribution review because API/open-data terms may include ODbL/share-alike or commercial conditions.
- **Open Supply Hub** — optional adapter only. It stays disabled without the required token/subscription and provenance review. Facility/contributor records are candidates until relationship scope is independently checked.

The machine-readable source and license/access registry is `docs/v0_8/source-registry.json`. The project's noncommercial public-interest source license does not remove or narrow any pre-existing upstream rights in public-domain, CC0, ODbL, government, or other third-party data.

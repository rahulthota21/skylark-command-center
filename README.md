# Skylark Command Center

**An evidence-backed, read-only monday.com Business Intelligence agent for founder and executive questions.**

> **Live demo:** https://skylark-command-center.vercel.app/

Skylark Command Center connects dynamically to a Sales Pipeline board and a Project Execution / Work Orders board in monday.com. It turns natural-language questions into defensible business analysis, while surfacing assumptions, source evidence, data quality, and uncertainty.

## Why this is different

Many BI chat prototypes send a spreadsheet to an LLM and trust it to summarize. This application takes a more reliable approach:

- **Live monday.com reads at runtime** — no production CSV/Excel/JSON fallback.
- **Read-only API behavior** — the app has no monday GraphQL mutations.
- **Deterministic math** — TypeScript calculates filters, totals, risk logic, and joins.
- **Constrained AI** — an LLM interprets intent and refines prose only after calculations are complete.
- **Evidence-first output** — every answer carries contributing monday item references.
- **Data quality is visible** — missing values, ambiguous dates, unmapped statuses, currency issues, and uncertain joins are disclosed instead of hidden.

## Features

- Conversational founder-level questions across Deals and Work Orders
- Dynamic monday board-schema discovery and semantic column mapping
- Cursor-paginated board retrieval
- Resilient parsing of nulls, amounts, probabilities, dates, statuses, and sectors
- Conservative cross-board account/customer matching
- Pipeline, weighted pipeline, sector comparison, execution-health, billing/collections, and risk analysis
- Evidence links to source monday items
- “Data readiness” panel with field mapping and parse coverage
- One-click Leadership Update with copy/download Markdown
- Live-sync status, force Refresh, safe setup and error states

## Architecture

```text
Browser (Next.js client)
        │
        ├── GET /api/health       ─┐
        ├── POST /api/refresh     │
        ├── POST /api/ask         │ server only
        └── POST /api/leadership  │
                                  ▼
                         monday GraphQL client
                         • schema discovery
                         • items_page pagination
                         • bounded retry / safe errors
                                  ▼
                  normalization + semantic mapping
                  • dates / money / probability / status
                  • sector aliases / source preservation
                  • conservative entity resolution
                                  ▼
                     deterministic analytics engine
                                  ▼
                 optional LLM planner + narrator
                 (sanitized schema / aggregates only)
```

## Runtime data flow

1. The server retrieves metadata and all rows from both configured monday boards.
2. The normalization layer preserves raw values and creates typed Deal and Work Order records.
3. A semantic mapper identifies business fields from live column titles/types rather than relying on fixed imported column IDs.
4. The planner converts the user question into a validated intent.
5. TypeScript applies filters and calculates metrics; it also records evidence, assumptions, and caveats.
6. The optional LLM receives only sanitized, calculated facts to create a concise executive narrative.
7. The UI displays the answer, source records, data-quality notes, and suggested follow-ups.

## Why direct monday API instead of MCP?

The assignment permits both API and MCP. I selected the direct GraphQL API because it provides deterministic server-side deployment, clear pagination, robust error handling, and a small surface area for a six-hour prototype. It also makes the read-only design easy to audit: the code contains queries only and no mutations.

The client uses `items_page` followed by `next_items_page` cursor pagination, so it does not assume a board has only a small number of records.

## monday.com board setup

Import the supplied source files as separate boards:

1. **Sales Pipeline** — `01_Deals_Import_Ready.csv`
2. **Project Execution** — `02_Work_Orders_Import_Ready.csv`

The received files are CSV exports despite their descriptive filenames. Use the prepared import copies in `../import-ready-files`; they preserve the business data. The work-order import copy removes one all-blank technical first line and places the unique `Serial #` field first.

For the exact real-source mapping and detected caveats, see [`DATA_PROFILE.md`](./DATA_PROFILE.md). For beginner click-by-click import instructions, see [`IMPORT_TO_MONDAY.md`](./IMPORT_TO_MONDAY.md).

Suggested monday types where source values permit them:

| Business concept | Deals board | Work Orders board |
|---|---|---|
| Primary record | Deal/account as Item Name | Work order/project as Item Name |
| Sector | Dropdown, Status, or Text | Dropdown, Status, or Text |
| Commercial/execution status | Deal Stage / Status | Project Status / Status |
| Amount | Numbers or Text | Numbers or Text |
| Dates | Expected Close Date | Due/End Date |
| Owner | People or Text | People or Text |
| Cross-board key | Customer/Account ID or Text | Customer/Account ID or Text |

Do not manually clean messy source values before testing. If a critical date/money column is too inconsistent to import as a typed monday field without losing its raw value, retain it as Text; the application will parse it safely and report failures.

### Dynamic semantic mapping

The app does not hardcode monday column IDs. It ranks likely columns by normalized title and type. Examples of recognized titles include:

- `Sector`, `Industry`, `Vertical`
- `Deal Stage`, `Sales Stage`, `Status`
- `Deal Value`, `Amount`, `Contract Value`
- `Expected Close Date`, `Close Date`
- `Project Status`, `Delivery Status`
- `Due Date`, `End Date`, `Delivery Date`

The expandable **Data readiness** panel shows live mappings and highlights low-confidence/missing fields. For the supplied trackers, the application deliberately prefers `Deal Status` for lifecycle, `Deal Stage` for funnel breakdown, `Tentative Close Date` for pipeline timing, `Probable End Date` for delivery timing, and inclusive-of-GST financial work-order fields for billing/collection comparisons.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local`.

```bash
MONDAY_API_TOKEN=
MONDAY_SALES_BOARD_ID=
MONDAY_WORK_ORDERS_BOARD_ID=

# Optional but recommended
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

### Security notes

- Tokens are read in server-only modules and are never sent to the browser.
- API inputs are validated and error responses do not expose stack traces or credentials.
- The monday integration issues only GraphQL queries; it never performs mutations.
- monday cell values are treated as untrusted data in LLM prompts. Embedded instructions in records are ignored.
- The LLM receives field catalogues and computed facts, not unrestricted board dumps.

## Local development

```bash
npm install
cp .env.example .env.local
# Add your private values to .env.local
npm run dev
```

Open `http://localhost:3000`.

## Tests and build validation

```bash
npm run lint
npm test
npm run build
```

Tests use fixtures only for unit testing and do not create a runtime data fallback. Coverage includes money, probability, date ambiguity, status normalization, conservative entity matching, mixed currency aggregation, weighted pipeline, and overdue work-order logic.

## Calculation definitions

| Term | Definition |
|---|---|
| Active pipeline | Deal records mapped to active, non-terminal sales stages. Won and Lost are excluded. |
| Weighted pipeline | Deal amount × valid reported probability. Missing/invalid probability is excluded, never assumed. |
| Current quarter | Calendar quarter in Asia/Kolkata unless user requests fiscal quarter. |
| At-risk work order | Explicitly at-risk status, or a safely parseable past due date on a non-complete mapped status. |
| Value linked to attention | Deal/project value associated with flagged records; it is not automatically recognized revenue. |
| Cross-board link | Explicit common ID where available; otherwise exact canonical account match, then high-threshold probable match disclosed to the user. |

### Data-quality rules

- Ambiguous numeric dates such as `03/04/2026` are not guessed.
- Amounts with different currencies are grouped rather than converted without an explicit FX assumption.
- Unknown statuses/stages remain visible and are excluded from calculations where classification would be unsafe.
- Records with missing data stay available for non-dependent analyses; the affected metric clearly states what was excluded.
- The supplied `Closure Probability` values are qualitative. When present, the explicit directional mapping is High = 75%, Medium = 50%, Low = 25% and weighted-pipeline answers disclose it.
- The supplied Deal Value lacks per-cell currency labels. The app applies a visible INR board-context assumption because companion Work Orders monetary fields are explicitly denominated in Rupees; it asks users to confirm before external reporting.
- The shared masked Deal Name produces some group-level rather than one-to-one joins; the app labels that limitation.
- When current-quarter wording conflicts with relevant active-pipeline dates, the agent asks for a clarification rather than returning a misleading empty result.

## Leadership Updates

The optional Leadership Update is intentionally implemented as an executive-ready point-in-time brief, not a claimed historical trend. It includes:

- Headline
- Pipeline snapshot
- Execution health
- Top risks
- Decisions/support requested
- Assumptions and data-confidence notes

Users can copy it as Markdown or download it as a `.md` file.

## Deployment to Vercel

1. Push this repository to a private or public GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Add all environment variables from `.env.example` in Vercel Project Settings → Environment Variables.
4. Deploy.
5. Open the deployment in an incognito browser and use **Refresh** to validate the live monday connection.
6. Do not put tokens in GitHub, screenshots, client-side variables, or the submission form.

No special Vercel configuration is required for this Next.js application.

## Suggested evaluator questions

- How is our pipeline looking for the energy sector this quarter?
- Compare sector performance across the pipeline.
- Which deals need executive attention?
- Which work orders are delayed or at risk?
- How are billing, collections, and receivables looking?
- Which accounts have active deals and delivery risk?
- Prepare a leadership update.
- What assumptions did the agent make?

## Demo checklist

See [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for a short evaluator walkthrough. The strongest proof of dynamic integration is to edit a value in monday.com, return to the deployed app, click **Refresh**, and show the live result update.

## Limitations and next steps

This focused prototype does not persist historical board snapshots, so it does not claim true week-over-week changes. More production time would add OAuth, role-based access, a mapping editor, historical snapshots, saved reports, and a manual review queue for probable entity matches.

## Run and deploy guide

If you are not a developer, follow [`RUN_AND_DEPLOY.md`](./RUN_AND_DEPLOY.md) step-by-step. It covers local testing, GitHub upload, Vercel deployment, environment variables, public testing, and submission.

## AI tools used

AI-assisted development was used where permitted by the assignment. The application itself uses an optional LLM only for structured question interpretation and executive narrative refinement. All numeric business logic is deterministic TypeScript and source-backed.

# Skylark Command Center

A read-only BI agent over monday.com that answers founder-level questions about the Sales Pipeline and Project Execution boards, and shows the evidence behind every number.

**Live demo:** https://skylark-command-center.vercel.app/

## What it does

- Connects to two monday.com boards at runtime - Sales Pipeline (deals) and Project Execution (work orders). No CSV fallback in production; if monday is unreachable, the app says so instead of showing stale or fake numbers.
- Turns a plain-English question into a calculated answer, not an LLM guess. TypeScript does all the filtering, totals, and risk logic. The LLM (optional) only turns the question into a structured intent and writes the final summary from numbers it's given - it never does the math itself.
- Shows its work: every answer links back to the specific monday items behind it, states its assumptions, and flags data-quality issues (missing dates, unclear currency, ambiguous joins) instead of hiding them.
- Asks for clarification when a question is genuinely ambiguous - e.g. "this quarter" when the board's active pipeline dates don't overlap the current quarter - rather than returning a technically-correct but misleading empty result.
- Generates a one-click Leadership Update (headline, pipeline, execution health, risks, decisions needed) that can be copied or downloaded as Markdown.

## Architecture

```text
Browser (Next.js client)
        │
        ├── GET /api/health
        ├── POST /api/refresh
        ├── POST /api/ask
        └── POST /api/leadership
                │  (server only)
                ▼
       monday GraphQL client
       - schema discovery, items_page pagination, bounded retries
                ▼
       normalization + semantic mapping
       - dates, money, probability, status; sector aliases; raw values preserved
                ▼
       deterministic analytics engine
                ▼
       optional LLM: question → intent, then facts → narrative
```

The server pulls schema + all rows from both boards, maps columns to business fields by title/type (not fixed column IDs, so it survives re-imports), runs the actual calculations in TypeScript, and only then hands the computed facts to an LLM to phrase as prose. The UI renders the answer alongside its source records and caveats.

## Why direct API instead of MCP

Both were allowed. I used monday's GraphQL API directly - it's easier to host securely, has predictable pagination (`items_page` / `next_items_page`, so it's not limited to small boards), and keeps the read-only guarantee easy to verify: the codebase contains queries only, no mutations.

## Setting up the monday.com boards

Import the two source files as separate boards:

1. **Sales Pipeline** ← `01_Deals_Import_Ready.csv`
2. **Project Execution** ← `02_Work_Orders_Import_Ready.csv`

Use the versions in `../import-ready-files` - they're the originals with one cosmetic fix each (see [`DATA_PROFILE.md`](./DATA_PROFILE.md) for exactly what changed and why). No business values were altered.

Column-type suggestions and full mapping decisions are in [`DATA_PROFILE.md`](./DATA_PROFILE.md). Click-by-click import steps are in [`IMPORT_TO_MONDAY.md`](./IMPORT_TO_MONDAY.md).

The app doesn't hardcode column IDs - it matches columns by normalized title (`Sector`/`Industry`/`Vertical`, `Deal Stage`/`Sales Stage`, `Deal Value`/`Amount`/`Contract Value`, etc.), so re-imported or renamed boards mostly keep working. The in-app **Data readiness** panel shows the live mapping and flags anything low-confidence.

## Environment variables

```bash
MONDAY_API_TOKEN=
MONDAY_SALES_BOARD_ID=
MONDAY_WORK_ORDERS_BOARD_ID=

# Optional - enables richer natural-language answers; core analysis works without it
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Copy `.env.example` to `.env.local` for local dev. Never commit `.env.local`.

**Security notes:** tokens are read server-side only and never reach the browser; the monday client issues queries only, never mutations; monday cell values are treated as untrusted text when passed to the LLM (no embedded-instruction injection); the LLM sees computed facts and a field catalogue, never a raw board dump.

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in your values
npm run dev
```

Open `http://localhost:3000`.

```bash
npm run lint
npm test
npm run build
```

Tests use fixtures for unit coverage only (money/date/probability parsing, status normalization, entity matching, weighted pipeline, overdue logic) - they don't create a runtime fallback path.

## Key definitions

| Term | Meaning |
|---|---|
| Active pipeline | Deals in a non-terminal stage. Won/Lost excluded. |
| Weighted pipeline | Deal amount × probability. Missing/invalid probability is excluded, never guessed. |
| Current quarter | Calendar quarter, Asia/Kolkata, unless the user asks for fiscal. |
| At-risk work order | Explicit at-risk status, or a parseable past-due date on a non-complete status. |
| Value linked to attention | Deal/project value tied to a flagged record - not recognized revenue. |
| Cross-board link | Exact match where a common ID exists; otherwise a disclosed probable match, never silently merged. |

Notable data-quality handling: ambiguous dates (`03/04/2026`) aren't guessed; mixed currencies are grouped, not auto-converted; unknown statuses stay visible but excluded from calculations where classifying them would be unsafe; `Closure Probability` (High/Medium/Low) is mapped to 75%/50%/25% and that mapping is disclosed in any answer using it; Deal Value has no per-cell currency marker, so the app applies a visible INR assumption (based on the Work Orders board's explicit Rupee labelling) rather than a silent one.

## Leadership Updates

Implemented as a point-in-time executive brief - headline, pipeline snapshot, execution health, top risks, decisions needed, data-confidence notes - copyable or downloadable as Markdown. It's a snapshot, not a trend line, since this prototype doesn't persist historical board states.

## Deploying to Vercel

See [`RUN_AND_DEPLOY.md`](./RUN_AND_DEPLOY.md) for the full click-by-click version. Short version: push to GitHub, import into Vercel, add the environment variables above under Project Settings, deploy, then verify in an incognito window using **Refresh**. Never put tokens in GitHub, screenshots, or the submission form.

## Try asking it

- How is our pipeline looking for the energy sector this quarter?
- Compare sector performance across the pipeline.
- Which deals need executive attention?
- Which work orders are delayed or at risk?
- How are billing, collections, and receivables looking?
- Prepare a leadership update.
- What assumptions did the agent make?

The clearest proof it's live and not hardcoded: edit a value in monday.com, hit Refresh in the app, and ask the same question again - see [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).

## What I'd do with more time

OAuth + per-user board access, a visual column-mapping editor, persisted historical snapshots for real trend analysis, a review queue for probable (not exact) entity matches, and saved/scheduled leadership reports.

## AI tools used

AI-assisted development was used where the assignment permits it. In the running app itself, the LLM is used only for question interpretation and narrative phrasing - all numeric logic is deterministic TypeScript.

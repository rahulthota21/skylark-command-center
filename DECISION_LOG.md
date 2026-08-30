# Decision Log — Skylark Command Center

## Scope and assumptions

- **Pipeline** means deal records mapped to an active, non-terminal stage. Won and Lost deals are not included in active-pipeline totals.
- **This quarter** means the calendar quarter in Asia/Kolkata unless a user explicitly requests a fiscal period. If board dates do not overlap the current quarter, the agent asks whether to use the latest quarter represented in the data rather than presenting a misleading empty forecast.
- A **weighted pipeline** total uses `amount × reported probability`. The supplied `Closure Probability` field is qualitative, so the explicit directional mapping is High = 75%, Medium = 50%, Low = 25%. Missing/invalid probability stays in unweighted pipeline and is never assigned an invented value.
- **Revenue** is used only when a reliable realized-revenue field exists. Deal amount and work-order value are labelled as pipeline/contract/project value instead. For the supplied data, financial comparisons use inclusive-of-GST Work Order fields consistently.
- The supplied Deal Value has no per-cell currency marker. It is treated as INR through a visible board-context assumption because companion Work Order fields are explicitly denominated in Rupees.
- The trackers do not share a reliable unique customer ID. Cross-board analysis uses shared masked Deal Name; one-to-one links are marked exact and repeated-name links are marked group-level rather than silently merged.

## Architecture and trade-offs

I selected the direct monday.com GraphQL API rather than MCP. It is simpler to host securely in the six-hour scope, supports deterministic pagination, and keeps all integrations in one server-side application. The code issues only GraphQL queries; it does not include monday mutations.

The app reads board schema and item values dynamically at runtime. Semantic mapping uses column title/type aliases rather than fixed column IDs, which is more resilient to imported-board variations. For these supplied trackers, `Deal Status` is treated as lifecycle truth while `Deal Stage` provides funnel context; `Tentative Close Date` and `Probable End Date` are the planning-date fields. A short server-only cache reduces repeated API calls, while a manual Refresh forces a fresh monday read. A cached/stale result is visibly labelled and is never a local-file fallback.

The LLM is deliberately constrained: it translates language into a validated intent and improves the narrative after deterministic calculations. TypeScript code performs filtering, joins, totals, risk rules, and source selection. This gives the user explainable numbers and avoids asking an LLM to perform spreadsheet arithmetic.

## Data quality approach

The pipeline preserves raw values, then normalizes text, stages, project status, probability, money and dates. It handles nulls and unparseable values without crashing. Ambiguous numeric dates are not guessed. Amounts with differing or unspecified currencies are shown separately instead of being silently converted. Each answer includes assumptions, coverage, caveats, and source item links.

## Leadership Updates interpretation

“Leadership updates” is implemented as a one-click, live point-in-time executive brief: headline, pipeline, execution health, key risks, decisions/support requested, and data-confidence notes. It can be copied or downloaded as Markdown. It is deliberately a snapshot, not a claimed week-over-week trend, because historical snapshots are not persisted in this assignment scope.

## With more time

I would add OAuth with per-user board authorization, a visual mapping editor, persistent historical snapshots for real trend analysis, a review workflow for fuzzy entity links, saved leadership reports, stronger role-based access control, and deeper board-specific calculation configuration.

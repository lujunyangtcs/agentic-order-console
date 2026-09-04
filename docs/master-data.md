# Master data and derived figures

Every figure on every screen is derived from one record set. Nothing is typed twice; if a number cannot be traced to the files below, it does not exist.

## The record set (`src/fixtures/`)

| File | What it holds |
|---|---|
| `network.ts` | 5 terminals (real Canadian cement sites, with coordinates), 11 ship-to sites, 10 customers (fictional), 12 carriers (8 with a connected system, 4 portal-only) with contract rates per lane, ~30 trucks with drivers |
| `people.ts` | Users by initials only (service desk RW, EC, JFH, CB; administrator; stakeholders; one carrier portal account), access tickets, security defaults, default notification rules |
| `orders.ts` | ~60 open orders across all eleven statuses, authored relative to the moment the app starts (`ago()` / `ahead()`), plus ~120 delivered orders over 90 days from a seeded generator; carrier requests; deviations; proofs of delivery |
| `chain.ts` | Lane table (terminal per ship-to), dwell time per status, event chain expansion |
| `derive.ts` | Everything the screens read: worklist rows, order detail, documents, KPIs, yard and dispatch boards, history, on-time result |
| `recommend.ts` | The carrier recommender: 30 lane · 25 reliability · 20 rate · 15 capacity · 10 distance, top three with reasons |
| `analytics.ts` | Scorecard, benchmark series, workload heatmap, report builder, live figures |
| `documents.ts` | The document models: order confirmation, bill of lading (scale ticket, seal), signed copy, delivery record, tax invoice (list prices per product, sales tax by province) |
| `calendar.ts` | Today as an anchor; dates are offsets, never literals |

## Rules

1. **Events are the truth.** An order's status is its last event. Timelines, arrival estimates, hours per stage, scorecard and reports all read the same chain.
2. **Steps the client's systems own arrive as events.** Order number returned, bill of lading printed at the scale, payment released, invoice issued: recorded with the source system, never re-implemented.
3. **Seeds change only with a version bump.** Edit a fixture, bump `SEED_VERSION` in `src/services/mock/store.ts`, or every open browser keeps the old data.
4. **Ids and references are unique.** The build gate fails on a duplicate order id or ERP reference.
5. **No real identity.** Client name, ticker, people: a salted hash denylist in `scripts/check-no-identity.mts` fails the build if one appears. Terminal names are real sites by agreement; everything else is fictional.
6. **Retired words.** Terminal (not plant), ePOD (not POD), Order/Load (not shipment), Truck (not vehicle); system names only from `src/app/product.ts`.

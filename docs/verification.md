# Verification

Build passing is not working. Before anything is called done, the rendered app is driven in a real browser and the DOM is asserted; screenshots are a sanity glance, not the evidence.

## Protocol

1. `npm run build` — the three gates (identity, fixture invariants, language) then `tsc` then the bundle. Any failure stops here.
2. `npm run preview` (port 4173) — the production bundle, not the dev server, in a fresh session (new tab, or `?dev=1 → Reset demo data`).
3. Walk at 1440 × 900, then 1280 × 720, then 390 × 844 (browser device mode).
4. Every check below is a DOM assertion made in the page (a `data-*` attribute, a text, a bounding box), recorded with the value seen.

## The assertions

| # | Check | How |
|---|---|---|
| V1 | Every navigation label ≤ 3 words in EN and FR, plain language | language gate + a read of the rail |
| V2 | Every route renders as every role; a role without the page sees the owning role named, never a blank | walk the rail per role |
| V3 | Zero console errors across the walk | console filtered to errors |
| V4 | T1 end to end: request → order number → carrier chosen → accepted → truck through terminal → bill of lading printed → in transit → signed → invoice; each step changes `data-status` and the documents list | click path in `docs/demo-script.md` |
| V5 | T3: decline → exception → suggestions exclude the decliner → next carrier accepts; both requests on the order and in the audit trail | same |
| V6 | Same-row cards equal height (`getBoundingClientRect().height` diff 0); no card void over 15 px | measure `[data-card]` siblings |
| V7 | KPI rows 3–4 tiles, tables show 5–6 rows by default, no button wraps to two lines | measure `[data-variant=primary]` heights = one line |
| V8 | Every number appears identically wherever it is shown: order total on the confirmation, invoice and delivery record; on-time rate on the worklist band, scorecard, benchmark and event log | read the four surfaces |
| V9 | The two AI touchpoints (carrier suggestions, arrival estimate) appear through the gated loader once per mount, then stay; no ambient loop | `[data-gated]` state after 2 s |
| V10 | Documents open as paper from the order page, the history drawer, the loading-board notice and the proof-of-delivery page; Download saves the same HTML the frame shows | `[data-document-frame]` `srcdoc` equals the downloaded blob |
| V11 | The map loads tiles (or falls back to the schematic on tile errors) and the focused truck sits on its lane | `.leaflet-tile-loaded` count, `[data-map]` value |
| V12 | Phone preview shows the same route as the desktop and updates when the desktop records a status | iframe `contentDocument` `[data-status]` after a desktop click |
| V13 | Phone width: no page-level horizontal overflow on any route (`scrollWidth <= innerWidth`), the menu button opens the navigation drawer, tables scroll inside their card, the status rail scrolls inside its card | walk every route at 390 |
| V14 | French: zero `[[` markers in `document.body.innerText` on all 26 routes as all five roles; data values stay English by design | FR toggle then walk |

## Measurement notes

- Radix menus do not open on `.click()`; dispatch a `pointerdown` on the trigger, then click the item.
- The browser pane scales large viewports down; read geometry from the DOM, never from the screenshot.
- A `flex-1` child of a column flex container with no definite height collapses to zero; give charts a fixed height and `shrink-0`.
- Scroll containers still contribute their content's intrinsic width to a flex or grid parent; `contain: inline-size` on the container is what stops a table from widening the page.
- Synthetic pointer events arrive in one task; anything a `pointerup` handler needs must be in a ref, not in state set during `pointermove`.

## Print

Documents print through the frame: `iframe.contentWindow.print()`. The sheet is a fixed 820 px page scaled to the frame with `zoom` on screen and reset to 1 under `@media print`; check one page of each kind lands on a single A4 sheet with the letterhead, the blocks and the totals visible.

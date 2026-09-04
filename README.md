# Agentic Order Management Console

A presentation-ready, fully clickable demo of an order-to-delivery console for a bulk cement producer in Canada. It sits **on top of** the client's systems of record (order creation, bill-of-lading printing, carrier payment and invoicing stay where they are) and takes over everything that happens between "the order exists" and "the signed bill of lading is archived": carrier assignment, carrier acceptance, truck status tracking, notifications, electronic proof of delivery, deviations, reports and roles.

Everything on screen is synthetic. No client name, logo, ticker or person appears anywhere; the build fails if one does.

## Run it

```bash
npm install
npm run dev        # http://localhost:3041
npm run build      # identity gate → fixture gate → language gate → tsc → vite build
npm run preview    # http://localhost:4173 (production bundle)
```

Sign in with the pre-filled email. The identity stays the same for the whole demo; the **role switcher in the top bar** changes the hat: Service desk (CVC User) · Carrier (acting for a named carrier) · Customer · Other Stakeholder (Sales · Supply chain planner · Dispatcher · Shipping point) · Administrator.

`?dev=1` opens the rehearsal panel (advance the order on screen one step, reset the demo data). `?embed=1` renders the phone chrome; the **Phone preview** button in the top bar opens the same page in a phone beside the desktop view.

## What the demo proves

Two end-to-end transactions from the client's brief, walked across roles with real state changes (see `docs/demo-script.md` for the presenter's script with the numbers on screen):

- **T1 Standard order to delivery.** Customer raises a request in the portal → desk sends it to the system of record and gets the order number back → desk picks a carrier from three suggestions → carrier accepts and names a truck → carrier taps the truck through the terminal → shipping point completes loading and the scale prints the bill of lading → customer signs on site → signed bill of lading is archived and sent for invoicing, and the scorecard moves.
- **T3 Rejection and reassignment.** A carrier declines a request with a reason → the desk is notified → new suggestions exclude that carrier → the desk sends the request to the next one → it is accepted. The audit trail shows both requests.

Two AI touchpoints only, both human-confirmed and both rendered through a gated loader (short wait → content → typed rationale): **suggested carriers** (top three with reasons) and **estimated arrival**. The AI proposes; a named person clicks every decision.

## Screens

| Route | Who | What |
|---|---|---|
| `/worklist` | Service desk | Today's band, four figures, three observations, the order table with status filters |
| `/orders/:id` | everyone | One order page, role-conditional: eleven-step status stepper, readiness, map and arrival, timeline, documents, requests, deviations, next-step card |
| `/requests` `/exceptions` | Service desk | Carrier requests (remind · expedite · reassign) · everything off the happy path |
| `/track` | desk, customer, stakeholders | Live map of every truck (Leaflet, Esri light grey tiles; schematic fallback offline) |
| `/carrier/inbox` `/carrier/loads` | Carrier | Accept with a truck or decline with a reason · tap statuses through, upload the signed bill of lading |
| `/portal` `/history` `/epod/:id` | Customer (and others) | My orders and one button to request more · completed orders with documents · the signed bill of lading as a document |
| `/stakeholder` `/yard` `/dispatch` | Other Stakeholder | Four role views with their own figures and columns · loading bays and the bill-of-lading ceremony · loads by carrier with reassignment |
| `/reports` `/reports/scorecard` `/reports/benchmark` `/reports/team` | desk, planners, admin | Report builder with saved reports · ranked carriers with editable weights · weekly on-time rate with benchmark and forecast band · workload heatmap |
| `/events` `/audit` `/notifications` | staff | Every status change with live figures · who changed what · the notification centre |
| `/admin/*` | Administrator | Users with access tickets · notification rules · security and default language · integrations · architecture map |

Nav labels are three words or fewer in English and French; every label is plain business language.

## How it is built

Vite · React 19 · TypeScript · Tailwind v4 · react-router 8 · TanStack Query · Radix · Recharts 2 · react-leaflet 5.

```
src/
  app/          shell (rail, top bar, phone dock), auth and roles, router, product names
  fixtures/     the seed: network (terminals, sites, customers, carriers, trucks), orders, chain (event dwell times), derive (every figure), recommend, notify, analytics
  services/     contracts (the API every route talks to) · mock (in-memory implementation, sessionStorage, BroadcastChannel)
  routes/       one folder per screen; routes only render what the services return
  components/   status stepper, gated reveal, map, signature pad, proof-of-delivery document, dialogs, tables, tiles
  i18n/         en.ts and fr.ts (typed keys), provider, formatting helpers
scripts/        the three build gates
docs/           demo script, verification checklist, master-data notes
```

**Events are the truth.** Every order carries a chain of status events. Status, arrival estimate, hours per stage, scorecard, KPI tiles, the event log and the reports are all derived from that one chain; nothing is stored twice. Steps the client's systems own (order number returned, bill of lading printed at the scale, payment released, invoice issued) appear as inbound events from those systems.

**Dates are offsets.** Fixtures are authored relative to today (`fixtures/calendar.ts`), so the demo reads the same on any day; today's open orders are authored relative to the moment the app starts, so a request "sent 12 min ago" really was.

**Three gates run before every build.** No real-world identity (a salted hash denylist), fixture invariants (retired vocabulary, hard-coded system names, date literals, radius scale, unique order ids and references), and the language gate (French covers every English key, nav labels are three words or fewer, every `t()` key exists).

## Design tokens

Colours, type and radius were captured live from the client's public site and mapped onto the template's token names (`src/styles/tokens.css`): brand blue, navy rail, light wash, Inter for body text, a grotesque display face, 2 px and 8 px corners. No logo, no imagery.

## Out of scope

Real connectors to the systems of record, real EDI, real single sign-on, real email or SMS delivery, freight bidding, order cancellation, native mobile apps. The planned modules on the architecture map are drawn dashed for exactly that reason.

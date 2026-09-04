# Inventory Intelligence — reference build

A working front end for configuration-level inventory decisioning in a
configure-to-order manufacturing business: what a shortage on one shared
component actually costs across a product line, and what to do about it.

Everything in it is synthetic. Every name, part number, plant, supplier and
customer is a placeholder — `ABC`, `Plant A`, `Supplier B`, `ABC-1001`. There is
no customer data here and no connection to any live system.

## What it does

Two flows run end to end.

**Order to material readiness.** Take a configured sales order, explode it
against the effective structure for that configuration, net it against stock,
allocations and open supply, and say whether it can be built — then show the
exposure the build itself creates, resolve a part whose identity is ambiguous,
and raise a supplier-grouped draft requisition.

**Continuous policy replenishment.** Take a component whose safety target no
longer matches reality, show where the recommended figure comes from term by
term, and carry it to the same requisition.

Around them: an exploded assembly sheet that puts component status on the
machine it belongs to, four analytics reports with cross-filtering and
drill-through, an audit log, and a connector page that is honest about which
feeds exist.

## Running it

```bash
npm install && npm run dev
```

`npm run build` produces the production bundle. `npm run preview` serves it.

## How it is built

Vite · React 19 · TypeScript · Tailwind v4 (CSS-first, no config file) ·
Radix primitives · React Router · TanStack Query · Recharts.

Two things are worth knowing before changing anything.

**One dataset, derived everywhere.** `src/fixtures/` holds authored records —
parts, structures, stock, orders, suppliers, evidence. Every figure on every
screen is derived from those records at read time by `src/fixtures/derive.ts`.
No component computes a number of its own and no value is typed in two places,
so changing one stock level moves every screen that depends on it, together.
`docs/master-data.md` explains the seams.

**The invariants are a build gate.** `npm run build` runs
`scripts/check-fixture-invariants.mts` before the type-check. It asserts the
cross-screen figures, referential integrity, the subset rule, and the ban on
date literals outside the calendar module. A dataset that contradicts itself
fails the build rather than surfacing as a wrong number on a screen.

`scripts/check-no-identity.mts` runs first and fails the build if any real
customer, plant, vendor or part number appears anywhere in the tree. This
repository ships externally; the check is what keeps that true.

## Swapping in a real backend

`src/services/contracts/` is the whole API surface as TypeScript interfaces.
`src/services/mock/` implements it against the fixtures. `src/services/index.ts`
picks the implementation. Components import `api` and never touch fixtures, so
replacing the mock with HTTP calls is a single-file change.

The system of record is configuration, not code: `CONNECTOR_PROFILE` in
`src/app/product.ts` supplies its display name, reference format and write-back
vocabulary. Renaming it requires no code change, and a build gate enforces that.

## Layout

```
src/
  app/          shell, routing, session, brand and connector profile
  components/   ui primitives, table, dashboard, assembly, charts
  fixtures/     the authored dataset and every derivation from it
  routes/       one directory per screen
  services/     the API contract and its mock implementation
scripts/        build gates
docs/           data model, verification protocol, walkthrough
```

## Documentation

- `docs/master-data.md` — the single-source-of-truth rule and how it is enforced
- `docs/verification.md` — the standing browser assertions, and the measurement
  bugs found while writing them
- `docs/demo-script.md` — a walkthrough of both flows

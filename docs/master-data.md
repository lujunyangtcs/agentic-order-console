# One dataset, derived everywhere

Every figure on every screen comes from one authored dataset. No component
computes a number of its own, and no value is typed in two places.

This is the rule the rest of the build hangs off, so it is worth being precise
about what it forbids. It is not "keep the numbers consistent". It is: there is
exactly one place a fact is stated, and everything else is a function of it.

## Why it matters more here than usual

The screens deliberately quote each other. The command centre says five parts
need a decision; the order screen says five components are short; the assembly
sheet draws five stations in shortage; the requisition explains why eight lines
follow from those five. Those are not four numbers that happen to agree — they
are one number, seen four ways.

Get that wrong and the failure is not cosmetic. Anyone comparing two screens
finds the contradiction in about a minute, and from then on every other figure
is suspect.

## The four seams

```
  fixtures/          authored records — the only place a fact is stated
      │
      ▼
  fixtures/derive.ts roll-ups, projections, status, netting
      │
      ▼
  services/          the typed contract, and a mock that implements it
      │
      ▼
  routes/ components read-only. They render; they never compute.
```

**Authored records** (`src/fixtures/`) are parts, structures, stock, orders,
suppliers and evidence. A number appears here or it does not exist.

**Derivations** (`src/fixtures/derive.ts`) turn records into everything else:
available quantity, projected zero date, coverage days, status, order explosion,
readiness, the requisition set, orders protected. If a screen needs a figure, it
belongs here, not in the component.

**The contract** (`src/services/contracts/`) is the API surface as TypeScript
interfaces. Components import `api` and never touch fixtures, so swapping the
mock for HTTP is a single-file change.

**Components** render. A component that computes a total is a bug, because that
total now exists in two places and only one of them is under test.

## Dates

Authored as offsets from one anchor and resolved against today at read time, so
the whole dataset slides forward and every relative relationship survives: a
21-day uncovered window stays 21 days a year later. The build refuses a literal
date anywhere in `src/fixtures` outside `calendar.ts`.

## The gate

`scripts/check-fixture-invariants.mts` runs before the type-check on every
build. It fails the build; it does not warn.

1. **Retired vocabulary** — one word per concept, enforced by grep. Synonyms
   drift back in through copy edits otherwise.
2. **Hardcoded system-of-record name** — the ERP is configuration, not code, so
   its display name may not appear outside the connector profile.
3. **Literal dates in fixtures** — see above.
4. **Cross-screen invariants** — every figure that appears on more than one
   screen, re-derived from the records and compared against its declared value.
5. **Referential integrity** — every foreign key resolves. In some domains a
   dangling reference is the subject matter; here it is a bug.
6. **Subset arithmetic** — no group may report a count greater than the whole
   that contains it. A supplier group protecting more orders than the
   requisition containing it is the most visible arithmetic error this kind of
   screen can make.

## Authored versus computed

Where an *input* is fixed — a unit cost, a lead time, a supplier's quoted days —
it is authored, once. Everything downstream of it is computed. When an authored
input and a computed figure disagree, the computed one is right and the authored
one is the bug.

The cheapest way to see the rule working is to break it: change one stock level
in `src/fixtures/inventory.ts` and run `npm run build`. Several invariants fail
at once, in different files, because they are all functions of the value you
changed.

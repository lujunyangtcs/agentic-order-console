# Walkthrough

Two flows, about ten minutes. Every figure below is derived from the fixtures at
run time, so the numbers on screen are whatever the dataset currently implies —
if one disagrees with this document, the screen is right.

## Command Center

Opens on the decision brief: how many parts need a decision today, what the
draft requisition is worth, and a written read composed from the same figures
the cards use. Every sentence in that read links to the record it was counted
from.

The rail along the top is recent activity. The cards below are counted from the
account's own data — no comparison against a no-action baseline is claimed
anywhere, because none can be.

## Flow 1 — order to material readiness

**Order Impact.** A configured order, exploded against the effective structure
for its configuration. Readiness is drawn on two axes that deliberately do not
add up: coverage is three exclusive segments summing to the analysed line count,
qualifiers sit underneath as chips that overlay it. A line can be both short and
under part resolution, so summing the two would double-count.

**Assembly Exposure.** The same components, on the machine they belong to.
Station status is colour plus a dash pattern plus a word, so the sheet survives
grayscale and a printer. Selecting a station shows what else draws on that
component — the point of the whole screen: a shortage on a shared component is
not one order's problem.

Stations flagged outside the viewport are reported in the toolbar with a count
and a direction.

**Part resolution.** Five candidate identities against one required part, and
three different answers to "can I use this":

- an exact match and an approved substitute get a plain control;
- a superseded revision is eligible but held — the control renders inside a gate
  naming the role that can release it;
- a potential duplicate and a similar-description part get no control at all,
  because no role can ever allocate them.

Switch role from the user menu to see the gate open.

**Requisition review.** One screen, three supplier-scoped requisitions. MOQ
round-ups are shown as `5 ↑ from 2`, not silently applied. Pre-flight checks
list what was validated. No system-of-record reference appears yet.

**Write-back.** References come back from the system of record and not a moment
earlier. Two failure paths are reachable for demonstration:
`?simulate=erp-timeout` issues nothing and leaves the draft intact;
`?simulate=email-failure` keeps all three requisitions and offers a separate
retry for the notification alone.

## Flow 2 — continuous policy replenishment

**SKU detail.** Why the recommended target is what it is, term by term, closing
on the total. Two of the six terms are quantities a conventional planning screen
cannot compute at all, and they are coloured to say so.

Three different confidences appear on this page — recommendation confidence as a
band, extraction reliability as itself, and data completeness — and they are
never adjacent without distinct labels.

**Supplier evidence.** A lead time confirmed in writing against the one on file,
with the message it came from.

## Analytics

Four reports. Slicers live in the URL, so a drill-through and a browser Back
return you to the report with its filter intact. Clicking a visual cross-filters
the others. Every rate names its denominator.

## Integrations

Closes on governance. Four connectors, two of them not connected and saying so:
where the manufacturing structure is maintained, and how far apart the system and
the shelf are, are open questions rather than claims. Connection state and
freshness are separate facts in separate positions, because a connector can be
perfectly reachable and still serve something stale.

Everything is read-only except one path: an approved draft requisition written
back to the system of record.

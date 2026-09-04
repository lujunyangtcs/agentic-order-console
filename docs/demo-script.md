# Demo script — Agentic Order Management Console

Every number below is what the screen shows on a fresh session (open the app in a new tab, or use `?dev=1 → Reset demo data`). Today's open orders are authored relative to the moment the app starts, so "sent 12 min ago" is literally true; times of day shift with the clock, the order numbers and names do not.

**Setup.** 1440×900 browser, English, signed in as the service desk (the default). Role switcher is in the top bar; the identity stays "RW" throughout — only the hat changes.

## Opening (60 s)

1. **Sign in** — pre-filled email, Continue. Lands on the **Worklist**.
2. Read the band: **6 orders need a decision**, then the typed read below it. Four figures on the tile row, three observation cards, the order table (40 rows, status chips down the left).
3. Say: "Everything you see is derived from one chain of status events per order. The desk never re-keys anything; the systems of record stay where they are — you will see them arrive as events."

## T1 — Standard order to delivery (6–8 min)

**Step 1 · Customer → desk.** Switch role to **Customer** (Northgate Ready-Mix). On **My orders**: "2 trucks are on the road to you", the next arrival and its time, ten order cards. Click **Request an order** → keep Northgate Kingston plant, 34 t General use cement, today within 6 hours → **Send request**. Toast: *Request SO-11xx sent to the service desk*, and the request opens as an order page titled **Portal request** with the next step "Send to the system of record".

**Step 2 · Desk → carrier.** Switch to **CVC User**. Open order **4501200** (SO-1042, Northgate Ready-Mix, Bath terminal → Kingston, 34 t). Status **Order created**; the next-step card says *Choose a carrier*. Click it.
- The drawer waits, then reveals three suggestions with typed reasons:
  **1 Summit Haulage · 99** (100% on time · 11 free · $7.21 per tonne), **2 Northbound Freight · 96** (portal only), **3 Capital Carriers · 92**.
- Say: "The AI ranks; the person chooses." Pick Summit Haulage → **Send request**. Status flips to **Pending carrier**; the request appears under *Carrier requests* on the order and on the **Requests** page with *sent x min ago*, Remind and Expedite.

**Step 3 · Carrier → desk + customer.** Switch to **Carrier** (acting for Summit Haulage). **Inbox** shows the request for 4501200. **Accept** → pick a truck → confirm. Status **Order scheduled**. Switch back to the desk for a beat: the bell has a new notification *Summit Haulage accepted order 4501200*; the customer's portal shows the same.

**Step 4 · Carrier → shipping point.** Still as Carrier, open **My loads** → tap **Truck in transit to terminal** on 4501200. Switch to **Other Stakeholder → Shipping point**: the **Loading board** for Bath terminal lists the truck under *Inbound to the terminal*.

**Step 5 · Shipping point → carrier + customer.** On the loading board click **Start loading** (the truck moves onto a bay), then **Loading complete** on that bay → the dialog waits for the weigh scale and comes back with **Bill of lading BOL-01200 printed**. Say: "The scale printed it — that is the ERP's job. The console recorded the moment." The document is now on the order for everyone.

**Step 6 · Carrier → customer.** As Carrier, tap **In transit**. On the order page the map panel shows the truck on the Bath → Kingston lane with the **Estimated arrival** revealed through the same gated loader (a ± 1 h window). The customer receives *Truck in transit* by email and portal — the rule that fired is visible under Administrator → Notification rules.

**Step 7 · Customer → desk.** As Carrier tap **On site**, then **Unloading**, then **Unload completed**. Switch to **Customer**, open the order: the next-step card says **Sign for the delivery**. Sign with the mouse → **Sign and confirm delivery**. Status **Delivery completed**; documents now include **Signed bill of lading BOL-01200**, a **Delivery record** and a **DirectA invoice**; the toast confirms the archive. Click **Open** on the signed bill of lading → the proof-of-delivery document with the signature image and the eleven milestones with timestamps.

**Step 8 · System → desk.** As CVC User, **Event log** (the top figures move, the log shows the last events with who recorded them: carrier, weigh scale, customer, system of record) and **Carrier scorecard** (Summit Haulage's loads and on-time rate include the order you just closed). Drag the on-time weight and watch the ranking re-order.

## T3 — Rejection and reassignment (3 min)

1. As **CVC User** open **Requests**: order **4501205** (SO-1051, Capital Precast, Bath → Ottawa) is *pending* with **Capital Carriers**.
2. Switch to **Carrier**, acting for **Capital Carriers**. **Inbox** → **Decline** → reason *No capacity in the window* → confirm.
3. Back as **CVC User**: bell shows *Capital Carriers declined order 4501205*; **Exceptions** lists it under *Carrier declined*; the order page says *Choose another carrier* and names who declined. Click it: three fresh suggestions — Capital Carriers is excluded and the drawer says why. Send to the first one.
4. Switch to **Carrier** for that carrier → **Accept** → **Order scheduled**. On the order page the *Carrier requests* card shows both requests with their timestamps; **Audit trail** shows the same two lines.

## Optional side trips (30–60 s each)

- **Phone preview** (top bar): the order page in a phone beside the desktop; click a status on the desktop and the phone updates.
- **Live tracking**: every truck on one map; click a row to focus; the schematic fallback appears if tiles cannot load.
- **Dispatch board**: order **4501207** (Foothills Ready-Mix, Exshaw → Calgary) is stalled — no answer for 45 minutes — with **Reassign** on the card.
- **Role views**: Sales, Supply chain planner, Dispatcher and Shipping point show different figures and columns over the same orders.
- **Report builder**: On-time rate by carrier → change to Tonnes by week as a line → **Save report**.
- **Benchmarking**: weekly on-time rate against the 92% benchmark with a forecast band; **Team workload** heatmap.
- **Administrator**: add a user and see the ServiceNow ticket created with it; change the default language to French and watch the console switch; the architecture map with planned modules dashed.
- **French**: the FR toggle in the top bar; every label, including the notifications, switches. Data values stay in English by design.

## If something goes wrong

- `?dev=1` → **Advance one step** moves the order on screen forward without changing role; **Reset demo data** returns to the seed.
- A refresh keeps the state (it lives in the browser session). A new tab starts clean.

# Harbour Ops: AI operations layer for Triple Harbour Capital

A working demo of the Zenthic pitch to Triple Harbour Capital (Alberta value-add multifamily, THC Value-Add 1 LP):
a thin AI layer over the systems they already run that

1. **answers every leasing inquiry 24/7** (website chat, Rentals.ca, Kijiji, Facebook, SMS, phone/voice), qualifies the prospect and **books the showing into the leasing calendar**;
2. **takes tenant maintenance requests**, verifies the tenant, triages urgency and **books the right crew** (or pages the on-call vendor);
3. **builds the monthly property report and the quarterly LP update** from operating data, with commentary written strictly from the numbers.

Everything is anchored on **Bonnie Doon Manor** (9107 88 Ave NW, Edmonton, 20 suites, filled to 18/20), the property referenced in the outreach.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for live Claude
npm run dev                  # http://localhost:3000
```

| Mode | When | What answers |
|---|---|---|
| **Live AI** | `ANTHROPIC_API_KEY` set | Claude (`claude-opus-5-5`, adaptive thinking, low effort for chat speed, server-side refusal fallback) driving real tools |
| **Offline demo engine** | no key, or the API is unreachable | Scripted engine calling the *same* tools, so calendars, CRM and work orders update identically |

The sidebar footer shows which mode is active. If a Claude call fails mid-demo, that turn falls back to the offline engine automatically.

## Screens

| Route | Audience | What it shows |
|---|---|---|
| `/live` | The pitch | **Start here.** A phone texting the building's number (renter or tenant). The team inbox, calendar and leads / work-order sheet update live beside it. `/live?as=tenant` opens in tenant mode |
| `/inbox` | Team | Gmail-style inbox: listing-site inquiries answered by email, team alerts (viewing booked, emergency dispatched, needs a reply), investor briefings for Rodrigo, and the monthly + LP reports as attachments. "New Kijiji / Rentals.ca inquiry" simulates one arriving |
| `/investors` | Rodrigo | Investor Q&A assistant with compliance guardrails, investor pipeline, and intro calls booked on Rodrigo's calendar |
| `/listing` | Renters | Bonnie Doon Manor listing (real listing photos, suites table, fees, map) with a floating chat widget and a **Call** button (Chrome/Edge voice). `/listing?chat=open` opens the chat straight away |
| `/` | Operators | KPIs (occupancy, vacancy cost/day, after-hours share, first-response time), live AI activity feed, funnel, suites to fill, next calendar items, portfolio |
| `/leads` | Leasing | Pipeline from every channel; click a lead for the full transcript and every action the AI took |
| `/calendar` | Leasing + crews | Week view per team (leasing, Crew A, Crew B, on-call plumbing); AI bookings have dashed borders |
| `/maintenance` | Tenants + ops | Tenant maintenance line (chat/voice) next to the live work-order board |
| `/workflows` | Owners | The five automations, their steps (AI / human approval / existing system) and recent runs |
| `/reports/property` | COO, lenders | Monthly property report, printable to PDF |
| `/reports/lp` | Limited partners | Quarterly investor update with EMD-style disclosures, printable to PDF |

## Demo script (Zoom, Wed Oct 21)

The **Demo guide** button (bottom-right of every console page) walks through these steps with what to say and what to click:

1. **The problem** (`/`): 18 of 20 leased, two empty suites cost about $90/day, many inquiries arrive at night.
2. **A renter texts at night** (`/live`): tap the prompts under the phone, top to bottom.
3. **It lands in their tools** (`/live` right side, then `/calendar`): inbox alert, calendar booking, sheet row, all marked NEW.
4. **A listing-site email gets answered** (`/inbox`): click "New Kijiji / Rentals.ca inquiry".
5. **The team can step in** (`/leads`): open a lead, reply as the team; it appears in the person's conversation.
6. **A tenant reports a leak** (`/live?as=tenant`): emergency, on-call plumber booked, work order in the sheet.
7. **Investors** (`/investors`): "What returns do you target?" then "Can I book a call with Rodrigo?".
8. **Reports** (`/inbox?folder=reports`): the property report and LP update arrive as emails with the report attached.
9. **No rip-and-replace** (`/workflows`).

Use **Reset demo data** in the sidebar between run-throughs.

## What is real vs illustrative

- **Photos** in `public/bdm/` are the building's own photos from its public rental listing (Zumper/PadMapper), used for this private demo to the owner. Replace them before any public use.
- **From tripleharbour.com / public listings:** team, fund name, $29M AUM, 15–18% target, 3–5 year hold, Odyssey Trust, focus markets, Alexo & Phoenix ($1.9M → $5.6M), Mountain Manor ($1.17M → $1.8M, refinance), Bonnie Doon Manor address, 20 suites, rent range, laundry, parking, balconies, 12-month leases.
- **Demo defaults to confirm at onboarding:** pet policy, deposit, utilities split, showing hours, tenant names, leads, work orders, and the income/expense lines in the property report (labelled as such on the report).
- **Simulated integrations:** SMS sending, listing-site inboxes, Google/Outlook calendars, accounting. In production these are connectors; here the in-memory store stands in for them.

## Code map

```
src/lib/kb.ts            building facts + policies the agent answers from
src/lib/tools.ts         tool schemas + executors (search_units, get_showing_slots, book_showing,
                         update_lead, verify_tenant, create_work_order, escalate_to_human)
src/lib/agent.ts         Claude tool-use loop, prompts, offline fallback on error
src/lib/offline-agent.ts scripted engine over the same tools
src/lib/store.ts         in-memory state, slot finding (Edmonton time), crew dispatch, KPIs
src/lib/seed.ts          deterministic demo world (reset reproduces it)
src/lib/reports.ts       property + LP report data and template commentary
src/app/api/*            agent, state, simulate, narrative, session, reset
```

State is in memory (kept across hot reloads) and resets when the server restarts.

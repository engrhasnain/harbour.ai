// Knowledge the leasing and maintenance agents answer from. Facts marked [listing] come from the
// building's public rental listing or tripleharbour.com; the rest are demo defaults to confirm at onboarding.

export const COMPANY = {
  name: "Triple Harbour Capital",
  tagline: "Buy Right. Reposition. Return Capital.",
  fund: "THC Value-Add 1 LP",
  aum: 29_000_000,
  targetReturn: "15–18% annualized",
  hold: "3–5 years",
  custodian: "Odyssey Trust",
  markets: ["Edmonton", "Camrose", "Vegreville"],
  email: "info@tripleharbour.com",
  team: [
    { name: "Rodrigo Parada", role: "Co-Founder & CEO", focus: "Deal sourcing, capital raising, fund strategy" },
    { name: "Alvaro Besa", role: "Co-Founder & COO", focus: "Legal, treasury, EMD compliance, lender reporting, asset management" },
    { name: "Remi Noel", role: "Co-Founder & CDO", focus: "Due diligence, construction and renovation, capital deployment" },
  ],
};

export const BUILDING = {
  id: "bonnie-doon",
  name: "Bonnie Doon Manor",
  address: "9107 88 Ave NW, Edmonton, AB T6C 1M2",
  neighbourhood: "Bonnie Doon, Edmonton",
  leasingPhone: "(780) 257-7059",
  lat: 53.5233668,
  lon: -113.4679032,
};

export const KB = `
# Bonnie Doon Manor: leasing facts

## Building [listing]
- 20-suite, three-storey walk-up at 9107 88 Ave NW in Bonnie Doon (French Quarter), Edmonton. Professionally managed by Triple Harbour Capital.
- Renovated suites: updated kitchens and bathrooms, new plank flooring, fresh paint. Balconies.
- Controlled-access entry, video surveillance, storage, on-site laundry (coin, shared).
- Assigned surface parking stall available with each suite (plug-in for winter).
- 12-month minimum lease. Unfurnished; fridge and stove included.
- Cats and dogs allowed.
- Security deposit $750–$900 depending on the suite.

## Suites [listing]
- 1 bedroom, 1 bath, about 610 sq ft, from $1,300/month.
- 2 bedroom, 1 bath, about 820 sq ft, $1,465/month.

## Location
- About a 10-minute walk to the Bonnie Doon stop on the Valley Line LRT; downtown in roughly 15 minutes from there.
- Bonnie Doon Centre (Safeway, Shoppers, restaurants) about a 12-minute walk.
- Campus Saint-Jean about a 4-minute walk.
- Close to Campus Saint-Jean, Mill Creek Ravine trails and Whyte Ave; University of Alberta about 10 minutes by car or bus.

## Terms (demo defaults; confirm with the Triple Harbour team)
- Heat and water included. Tenant pays electricity (usually $45–70/month) and needs tenant insurance. Internet is set up by the tenant.
- No monthly pet rent; refundable pet deposit $300. Up to 2 pets.
- Application: short online form, photo ID, credit check and one landlord reference. Household income around 2.5x rent is the guideline; every lawful income source counts, co-signers welcome.
- Non-smoking building.
- Viewings with the leasing team: Mon–Fri 10:00–19:00, Sat 10:00–14:00. About 20 minutes. Meet at the front entrance.

## Maintenance (for current tenants)
- Emergencies 24/7: no heat, active leak or water from the ceiling, flooding, sewer backup, no power to the suite, gas smell, fire or smoke damage, lockout at night, broken entry door or lock. Gas or fire: call 911 first.
- Urgent within 24 hours: fridge or stove not working, no hot water, only toilet not flushing, pests in the kitchen.
- Routine within 3 business days: dripping tap, slow drain, appliance noise, cabinet or door repairs, minor drywall.
`.trim();

export const FUND_KB = `
# THC Value-Add 1 LP: investor facts [tripleharbour.com]
- Triple Harbour Capital buys value-add multifamily (10–50 units, $500K–$5M) in Alberta's mid-sized markets: Edmonton, Camrose, Vegreville and nearby. Operators, not a brokerage.
- Strategy: buy right, reposition (renovations, occupancy, expense optimization), refinance to return capital, recycle equity. Exits are underwritten first and stress-tested against a worst-case refinance. CMHC-aligned underwriting.
- Fund: THC Value-Add 1 LP, a registered limited partnership for accredited investors, distributed through a licensed Exempt Market Dealer (EMD). Custodian: Odyssey Trust. About $29M in assets under management.
- Targets: 15–18% annualized through a waterfall with preferred returns and profit participation. 3–5 year hold. These are targets, not guarantees.
- Minimum investment: thresholds apply; the exact amount is in the offering documents provided through the EMD.
- Track record: Alexo & Phoenix bought for $1.9M as a portfolio; occupancy up, suites renovated, utilities optimized; combined appraisal $5.6M within about 12 months (realized). Mountain Manor bought at $1.17M, appraised at $1.8M, refinance underway to return investor capital. Bonnie Doon Manor in Edmonton is 18 of 20 leased.
- Team: Rodrigo Parada (CEO, deal sourcing and capital raising), Alvaro Besa (COO, legal, treasury, EMD compliance, reporting), Remi Noel (CDO, construction and due diligence).
- Reporting: investors receive regular updates and access an investor portal.
- Registered accounts (RRSP/TFSA) and tax treatment: the team confirms eligibility for each investor; do not give tax advice.
`.trim();

export const INVESTOR_RULES = `
Compliance rules (exempt market): never promise or imply guaranteed returns; always call 15–18% a target. Never give personalized investment, tax or legal advice. Do not quote a minimum investment amount; say thresholds apply and the offering documents come through the Exempt Market Dealer. Offerings are for accredited investors; if someone is unsure whether they qualify, say the dealer confirms that on the intro call. Past results do not guarantee future results.
`.trim();

export const FAIR_HOUSING = `
Fair housing (Alberta Human Rights Act): never ask about or decide anything based on race, religion, colour, gender, gender identity, sexual orientation, age, ancestry, place of origin, marital status, family status, disability or source of income. Do not steer anyone toward or away from a suite. Treat all lawful income sources equally. Approval decisions are made by the Triple Harbour team, not by you.
`.trim();

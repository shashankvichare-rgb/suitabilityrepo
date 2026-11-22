# Symbo demos on symbo.si

Every page on symbo.si is behind one access gate. Nobody sees a demo without signing in.

| Who | How they sign in | What they get |
|---|---|---|
| Symbo team | Name + team code at `symbo.si/access/` | All demos and the access console, 12 hours |
| Client / partner | Invite link + their email + an 8-character code | Only the demos on their invite, for the time you set (15 min default), on one device |

## Demos

| Demo | Path | Invite id |
|---|---|---|
| Credit Life journey | `/demos/suitability-agent-journey/` | `creditlife` |
| Agent journey · store & bank portals | `/demos/agent-journey/` | `agentjourney` |
| Embedded widget · LoanBee checkout | `/demos/loanbee-checkout/` | `widget` |
| Suitability engine | `/demos/suitabilityengine/` | `engine` |
| Motor agent journey | `/demos/motor/` (proxied) | `motor` |
| Pet insurance | `/demos/pet-insurance/` | `pet` |
| Agent journey · consumer durables (earlier build) | `/demos/agent-suitaibility-demo/` | `agent` |

### Hub order

01 Suitability in action · 02 Embedded widget journey · 03 Agent journey · 04 Motor agent journey · 05 Pet insurance journey.
The Credit Life journey and the first consumer-durables agent build stay reachable by URL and invitable, but are off the hub and the session menu (`hidden: true` in `access-core.mjs`).

### Shared suitability engine (`hub/engine/`)

- `catalogue.js` is generated from the Symbo Product Master sheet (Products, VAS, Bundles tabs): 91 products, 196 services, 28 bundles, tagged by 11 partner types. Rebuild it from the sheet; do not edit by hand.
- `engine.js` runs one pipeline for every partner type: about 43 datapoints → catalogue mapping → eligibility → need match → overlap and affordability (premium cap by ticket size) → guardrails → ranked mix, services and a bundle. It writes a hash-chained audit log and returns an API-shaped request/response. Prices are the master's indicative rates.
- Compliance markers are short labels with a source (RBI sales-practice directions, RBI KFS circular / Digital Lending Directions, Fair Practices Code, IRDAI policyholder regulations, DPDP). They are demo markers, not legal advice: confirm wording against the current circulars before a partner sees them.
- `hub/brand/` holds the Symbo and Digit logos ("Insured by Digit").

### Suitability in action (`demos/suitabilityengine/`, desktop only)

Eight partner types, one customer each. Change a signal and the engine re-runs: pipeline counts, every product as a dot in the catalogue field, the recommended mix (hover a card for why, the shield for compliance), services, pricing mix, protection gaps. Right panel: audit log (with a tamper test), guardrails, API. "Catalogue map" shows product mapping by partner type. The previous page is kept at `classic.html`.

### Embedded widget journey (`demos/loanbee-checkout/`)

LoanBee checkout on the shared engine. Borrower panel on the left, decision record on the right (closed until opened; drawers on mobile). Five widget placements, switched with the arrows, dots, arrow keys or a swipe: inline card, EMI line switch, pre-sign sheet, checklist row, after approval. Adding always goes through one consent sheet (price, GST, free look, "loan does not depend on this"); skipping is never more than one tap. The previous page is kept at `classic.html`.

### Compliance content: where it comes from

The markers, the 7-step compliant journey and the five per-policy records follow Symbo's practitioner's guide
"Building Compliant Embedded Insurance in Lending Flows" (six buckets, clause references §101G to §101X of the NBFC
Responsible Business Conduct Amendment Directions, 2026). Updated for the RBI's 15 June 2026 statement: effective
1 January 2027, suitability judged at the time of sale, and post-sale confirmation replaced by an acknowledgement with
a helpline number. They live in `hub/engine/engine.js` (`MARKERS`, `JOURNEY`, `EVIDENCE`, `REG`).
The widget's consent sheet applies them: role disclosed, full price first, terms scrolled before "Add cover" activates,
"Not now" and "Add cover" the same size, provider choice, and no deduction from loan money.

### Install as an app

`access/app/` (public, so it loads before sign-in) holds `manifest.json` and the icons. The sign-in page and the hub
link them statically; `session.js` adds them to every other page and shows "Install as an app" (Chrome, Edge) or
"Add to Home Screen" (iOS) in the session menu. No service worker: the site is gated and never cached.
To change the icon, replace `icon.svg` and `icon-maskable.svg` and re-export the PNGs at 48, 180, 192 and 512.

### Session menu (`access/session.js`)

The old bottom pill is now a corner menu button: who is signed in, All demos, each demo, Share access (team), Sign out; guests also see time left. A page can lift it above its own bottom bar with `<body data-symbo-menu-bottom="84">`.

### Agent journey (store and bank agent portals)

Three steps: answer the questions on one page (tap to select), mark each recommendation Interested / Not now on its card (reasons as tags, script under "Pitch points"), share the quote.

Hub card 06. Opens on a sign-in page with two portals (store first). Desktop is a portal with a collapsible sidebar;
below 1024 px it becomes a mobile app (drawer menu, sticky action bar, customer record as an accordion).

- **Ajay Sales Electronics** (store sales agent Rohan, `AJS-SA-1042`): dashboard of today's financed sales → pick an invoice →
  customer & purchase → needs questions → recommendations (consumer durable add-ons) → pitch → WhatsApp quote.
- **KBI Bank** (relationship manager Rohan Joshi, `KBI-RM-2087`): loan book of 10 sanctioned loans (₹30,000 to ₹2 Cr) with Loan ID
  search (prefilled `KBI-PL-2611-04821`) → loan details → suitability (loan facts prefilled from the loan file) →
  Personal Accident Shield, EMI Protect, Hospital Cash, Health & Wellness Plan, Card & UPI Safe. Credit Life is listed but not enabled.
- Both: an "analysing" step, ranked recommendation cards, a pitch card per product (why it was chosen, script, limits, objection),
  a customer record beside the journey and a records page with the full audit trail. Customer checkout (`buy.html`) is branded per
  channel: per-product consent, OTP shown as an incoming SMS (`123456`), mock payment (KBI adds account debit).
- Files: `app.js` (portal), `engines.js` (one interface over both channels, store invoices, seeded records), `bank.js` (loans,
  questions, products, pricing, pitch), `catalogue.js` + `pitch.js` (store products and pitch), `store.js` (channels, storage, share link, sync).
  Prices are illustrative.
- The buy link carries the quote, so it opens on any signed-in device (a guest needs `agentjourney` on their invite; allow 2 devices if they use a laptop and a phone).
- Cross-device sync: `netlify/functions/journey-api.mjs` (route `/api/journey/*`, Netlify Blobs store `agent-journey`). The buy page posts each customer action; Rohan's app polls its open quotes every 4 s and merges events by id, so a purchase on the customer's phone appears on the agent's screen. In the same browser it also updates instantly via localStorage. If the function is unreachable, both pages keep working locally.

### Credit Life journey (Suitability Agent Journey)

The hub's Agent card opens this. A LoanBee (fictional lender) agent adds Credit Life to a business loan:
borrower → loan → needs + health declaration → offer (reducing, level or joint; added to loan or upfront) →
customer consents on their own phone with a one-time code → pre-filled membership & health form (MEF) and certificate.
The right-hand Symbo decision view shows the need score, eligibility, price build-up, guardrails and a live record.

- Rules and rates: `demos/suitability-agent-journey/engine.js` (`RULES`). Illustrative, not an insurer's filed card. Replace `rateCard` with the insurer's age/term rates when agreed.
- Personas: `PERSONAS` at the top of `app.js`.
- Tests: `node --test tests/*.test.mjs` from the repo root.
- Loader and pulse icon come from the Partner Success Portal.

## Share a demo with a client

1. Sign in as team, then open **symbo.si/access/admin/** (or click **Share access** in the bottom-left pill).
2. Fill in the recipient's name, company and email, tick the demos, pick the viewing time.
3. Click **Create invite**. Copy the **link message** into an email and the **code message** into WhatsApp/SMS. Send them on different channels. The code is shown once.
4. Watch the invite card. It shows *Not opened → Viewing (time left) → Finished*, page views, devices, and blocked attempts.

During a meeting you can click **+15 min** to extend, or **Revoke** to close their access. An open tab closes within 45 seconds of a revoke.

## What stops forwarding

- **One device per invite.** The first browser that redeems the code owns it. If the client forwards the link, code and email, the second device is refused and the invite is flagged **Possible forwarding** in the console.
- **Email + code + link.** The link alone, or the code alone, is useless. Five wrong emails lock the invite.
- **Short window.** The clock starts at first sign-in. Unused codes expire (default 48 h).
- **Session bound to the browser.** A copied session cookie fails on another browser.
- **Watermark.** Guest pages carry the recipient's name, company, email and time, tiled faintly across the screen and stronger when printed. A leaked screenshot shows who leaked it.
- **No indexing, no iframing, no caching.** `noindex`, `X-Frame-Options: DENY`, `Cache-Control: no-store` on every response.
- **Audit log.** Every sign-in, page view, failed attempt and blocked reuse is in the **Activity** tab.

Limit: nothing stops someone screen-recording during their window. The watermark makes that traceable.

## One-time setup in Netlify

Netlify → **symbosuitability** → Project configuration → Environment variables. Scope: **Functions** (this covers Edge Functions too).

| Variable | Value |
|---|---|
| `ACCESS_TEAM_CODE` | The team passcode. If unset, the existing `DEMO_INDEX_PASSWORD` is used. |
| `ACCESS_SIGNING_SECRET` | A long random string. Generate with `openssl rand -base64 48`. Never put it in GitHub. |

Then redeploy. Netlify Blobs (where invites and the log are stored) needs no setup.

**Team code leaked?** Change `ACCESS_TEAM_CODE`, redeploy, then click **Sign out all team sessions** in the console.

## Add a new demo

1. Put it in `symbo-suitability-github/demos/<folder>/`.
2. Add a row to `DEMOS` in `netlify/lib/access-core.mjs` with an `id`, `name`, `home` and `prefixes`. It then appears as a checkbox in the console.
3. Link it from the hub.

Paths not listed in `DEMOS` are open to the team only. Guests are refused.

## Motor demo

`/demos/motor/` proxies `https://symboagentmotordemo.netlify.app/`, so it sits behind the gate. That original `netlify.app` address is still public. Password-protect or unpublish that Netlify site, or move the motor build into `demos/motor/` here.

## Files

```
netlify.toml                                    (repo root) gate, API route, motor proxy
package.json                                    (repo root) @netlify/blobs
symbo-demos-netlify/
  netlify/edge-functions/access-gate.js         runs on every request
  netlify/functions/access-api.mjs              sign-in, invites, revoke, log
  netlify/lib/access-core.mjs                   shared: demo list, signing, codes
  symbo-suitability-github/access/              sign-in page, session layer, styles
  symbo-suitability-github/access/admin/        access console
```

The old `demo-index-gate.js` (homepage-only Basic Auth) is removed.

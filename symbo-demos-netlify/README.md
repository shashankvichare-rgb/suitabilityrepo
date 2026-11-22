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
| Agent journey · Rohan (consumer durable) | `/demos/agent-journey/` | `agentjourney` |
| Embedded widget · LoanBee checkout | `/demos/loanbee-checkout/` | `widget` |
| Suitability engine | `/demos/suitabilityengine/` | `engine` |
| Motor agent journey | `/demos/motor/` (proxied) | `motor` |
| Pet insurance | `/demos/pet-insurance/` | `pet` |
| Agent journey · consumer durables (earlier build) | `/demos/agent-suitaibility-demo/` | `agent` |

### Agent journey (Rohan, consumer durable)

Hub card 06. A store agent, Rohan (`SYM-AG-1042`), sells protection with a consumer durable loan:
dashboard with dummy sales and retail products (coming soon) → customer and purchase → needs questions →
"analysing" step → ranked recommendations → a pitch card per product (why it was chosen, script, limits, objection) →
WhatsApp quote with a buy link → customer checkout (`buy.html`: per-product consent, demo OTP `123456`, mock payment) →
consolidated audit trail logged on Rohan's name.

- Products and rules: `demos/agent-journey/catalogue.js` (from the earlier consumer durable build). Pitch scripts: `pitch.js`. Agent, seeded sales and the share link: `store.js`.
- The buy link carries the quote, so it opens on any signed-in device. Rohan's dashboard updates live only when the customer buys in the same browser (localStorage).

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

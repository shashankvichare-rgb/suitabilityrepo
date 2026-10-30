# Symbo demos for the existing Netlify project

This package updates the **existing** `symbosuitability` Netlify project. It keeps the current suitability engine and adds a generic Symbo agent journey.

## URLs after deployment

- Demo index: `https://symbo.si/` (password required)
- Suitability engine: `https://symbo.si/demos/suitabilityengine/`
- Agent journey: `https://symbo.si/demos/agent-suitaibility-demo/`

The agent path deliberately uses the spelling in the request: `suitaibility`. The correctly spelled `/demos/agent-suitability-demo/` can be added as an alias later.

## Deploy through the current GitHub repository

1. In the existing GitHub repository connected to Netlify, copy the **contents** of this package into the repository root. Replace the existing `netlify.toml` and `symbo-suitability-github/index.html`; add `netlify/edge-functions/demo-index-gate.js` and the `demos/agent-suitaibility-demo/` folder. Do not upload this ZIP as a single file or add an extra wrapper folder.
2. Before pushing, open Netlify **symbosuitability → Project configuration → Environment variables**. Add `DEMO_INDEX_PASSWORD` with a strong password. Give it **Functions** scope. Keep the value in Netlify; do not put it in GitHub or `netlify.toml`.
3. Commit and push to the branch Netlify deploys. If the password variable was added after deployment, trigger a fresh deploy; Edge Function environment changes take effect on a new deploy.
4. Check the three URLs above. The root should prompt for a username and password. Use username **`symbo`** and the password set in Netlify. `/index.html` is protected as well. The two demo URLs should open directly without the root password.

If the root shows `503`, the password variable was not available to the Edge Function at deploy time. Check its name and Functions scope, then redeploy. If it opens without a password, check that `netlify/edge-functions/demo-index-gate.js` is at the repository root and that Netlify used the new root `netlify.toml`.

## What the agent demo does

The five steps remain: customer and asset, needs, shortlist, proposal, and track/complete. The customer preview includes individual accept/decline choices, disclosures, payment preference, an on-screen demo code, and downloadable evidence.

This is a browser-local simulation. It sends **no email or OTP**, collects **no payment**, and issues **no policy**. Demo applications and edited masters stay in that browser's local storage; a customer preview link works only in the same browser. Use fictional details. The supplied TVS consent record and email credentials are not included.

The root password protects only the demo directory page. Anyone with a direct demo URL can open that demo. Add future landing pages as folders inside `symbo-suitability-github/`, for example `landing/product-name/index.html`, and link them from the index when ready.

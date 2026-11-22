/* Embedded widget journey · LoanBee checkout with the Symbo protection widget in five placements.
   The offer comes from the shared suitability engine; every customer action lands in the audit log. */
import { PERSONAS, OPTIONS, run, legacy, LEGACY_VIOLATIONS, inr } from '/hub/engine/engine.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const first = n => n.split(' ')[0];
const ravi = PERSONAS[0];
const PEOPLE = [
  ravi,
  { ...ravi, key: 'ananya', name: 'Ananya Iyer', tag: 'Salaried · digital-first', amount: 250000, tenure: 24, age: 29, gender: 'F', marital: 'Single', dependants: 1, occupation: 'Salaried', income: 85000, savings: '2–5 months', healthCover: 'Employer only', upi: 'High', commute: 'Office / home' },
  { ...ravi, key: 'sunita', name: 'Sunita Patil', tag: 'Family of five', amount: 150000, tenure: 12, age: 41, gender: 'F', dependants: 3, income: 32000, healthCover: 'None', upi: 'Low', commute: 'Office / home', city: 'Tier 3' },
  { ...ravi, key: 'imran', name: 'Imran Shaikh', tag: 'Business owner', amount: 500000, tenure: 36, age: 44, dependants: 3, income: 120000, life: 'Partial', healthCover: 'Personal policy', savings: '6+ months', upi: 'High' }
];
const AMOUNTS = [60000, 150000, 250000, 500000], TENURES = [6, 12, 24, 36];
const PLACEMENTS = [
  { key: 'inline', name: 'Inline card', where: 'Review & sign · under the loan summary', add: 2, skip: 0, best: 'Default. Seen by everyone, ignored at no cost.', marks: ['Collapsed by default', 'Skipping needs no action', 'Price visible before any tap'] },
  { key: 'toggle', name: 'EMI line switch', where: 'Inside the loan summary', add: 2, skip: 0, best: 'Lowest friction for small-ticket loans.', marks: ['Switch is off by default', 'Turns on only after the consent sheet', 'Shown as its own line, never inside the EMI'] },
  { key: 'sheet', name: 'Pre-sign sheet', where: 'One step before e-sign', add: 1, skip: 1, best: 'Highest attention. Use once per journey.', marks: ['Skip and Add are equal in size', 'Shown once, never repeated', 'Closing the sheet counts as skip'] },
  { key: 'checklist', name: 'Checklist row', where: 'Disbursal checklist', add: 2, skip: 1, best: 'Assisted and vernacular journeys.', marks: ['Marked optional in the list', 'Skipped is a completed state', 'e-Sign never waits for it'] },
  { key: 'post', name: 'After approval', where: 'Success screen, after money is sent', add: 2, skip: 0, best: 'Zero influence on the loan decision.', marks: ['Loan is already disbursed', 'Paid separately, not from loan money', 'Dismiss hides it for good'] }
];

const S = { p: { ...PEOPLE[0] }, res: null, pl: 0, w: null, panel: null, drawer: null, pops: new Map(), contrast: false, side: 'today', pin: null };
const freshW = () => ({ added: null, sheet: null, open: false, skipped: false, more: false, dismissed: false, read: false });
function pop(html) { const id = 'p' + S.pops.size; S.pops.set(id, html); return `data-pop="${id}"`; }
const pick = () => S.res.picked[0] || null;
const gst = n => Math.round(n * .18);
const priceOf = x => x.priceValue || 0;
const totalOf = x => priceOf(x) + gst(priceOf(x));

function rerun() {
  S.res = run(S.p); S.w = freshW(); S.w.open = S.pl === 0;
  if (pick()) S.res.log.add('Widget', `Offer shown · ${PLACEMENTS[S.pl].name}`, `${pick().name} · ${inr(totalOf(pick()))} incl. GST · not pre-selected`);
  else S.res.log.add('Widget', 'No offer shown', 'Nothing suitable for this borrower');
  render();
}
function event(text, data = '') { S.res.log.add('Customer', text, data); }

/* ── borrower panel ── */
function seg(key, label, opts, fmt = x => x) {
  return `<div class="ctl"><label>${label}</label><div class="seg">${opts.map(o => `<button class="${String(o) === String(S.p[key]) ? 'on' : ''}" data-set="${key}" data-val="${esc(o)}">${esc(fmt(o))}</button>`).join('')}</div></div>`;
}
function vBorrower() {
  const c = S.res.counts;
  return `<div class="pn-h"><p class="eyebrow">Borrower</p><button class="x" data-act="close-drawer" aria-label="Close"><i class="ph-bold ph-x"></i></button></div>
    <div class="people">${PEOPLE.map(x => `<button class="${x.key === S.p.key ? 'on' : ''}" data-person="${x.key}"><span class="av">${esc(x.name.split(' ').map(n => n[0]).join(''))}</span><b>${esc(first(x.name))}</b><small>${esc(x.tag)}</small></button>`).join('')}</div>
    <p class="eyebrow">Loan</p>${seg('amount', 'Amount', AMOUNTS, n => n >= 1e5 ? `₹${n / 1e5}L` : `₹${n / 1e3}k`)}${seg('tenure', 'Tenure', TENURES, t => t + ' m')}
    <p class="eyebrow">What LoanBee knows</p>${seg('occupation', 'Work', ['Salaried', 'Self-employed', 'Gig worker'], s => ({ 'Self-employed': 'Self-emp.', 'Gig worker': 'Gig' })[s] || s)}${seg('dependants', 'Dependants', [0, 1, 2, 3])}${seg('savings', 'Savings', OPTIONS.savings, s => ({ 'Under 2 months': '< 2 mo', '2–5 months': '2–5 mo', '6+ months': '6+ mo' })[s])}${seg('commute', 'Travel', OPTIONS.commute, s => ({ 'Office / home': 'Low', 'Two-wheeler daily': '2-wheeler', 'On the road all day': 'On road' })[s])}
    <p class="eyebrow">Cover already held</p>${seg('life', 'Life', OPTIONS.life)}${seg('healthCover', 'Health', OPTIONS.healthCover, s => s.replace(' only', '').replace(' policy', ''))}${seg('pa', 'Accident', OPTIONS.pa)}
    <div class="mini"><p class="eyebrow">Engine</p><div class="mp">${[['Signals', S.res.datapoints.length], ['Products', c.catalogue], ['Eligible', c.eligible], ['Fit', c.fit], ['Shown', c.recommended]].map(([l, n], i) => `<span><b>${n}</b><small>${l}</small></span>${i < 4 ? '<i></i>' : ''}`).join('')}</div><a href="/demos/suitabilityengine/">See the engine work <i class="ph-bold ph-arrow-up-right"></i></a></div>`;
}

/* ── decision record ── */
function vRecord() {
  const r = S.res, pl = PLACEMENTS[S.pl], t = S.panel || 'why';
  const tab = (k, icon, label) => `<button class="${t === k ? 'on' : ''}" data-panel="${k}"><i class="ph-bold ${icon}"></i>${label}</button>`;
  let body;
  if (t === 'gap') body = vGap();
  else if (t === 'why') body = r.picked.length ? r.picked.map((x, i) => `<div class="why"><div class="why-h"><span class="rk">${i + 1}</span><b>${esc(x.name)}</b><em>${x.score}</em></div><div class="chips">${(x.matched[0]?.signals || []).map(s => `<span>${esc(s)}</span>`).join('')}</div></div>`).join('') + `<p class="note">${r.counts.catalogue} products checked · ${r.counts.catalogue - r.counts.fit} ruled out · ${r.alternatives.length} held in reserve</p>` : '<p class="note">Nothing fits this borrower, so no offer is shown.</p>';
  else if (t === 'rules') body = `<ul class="guards">${r.guards.map(g => `<li class="${g.flag ? 'flag' : ''}" ${pop(`<b>${esc(g.title)}</b><p>${esc(g.text)}</p><em>${esc(g.ref)}</em>`)}><i class="ph-fill ph-check-circle"></i><span>${esc(g.title)}<small>${esc(g.ref)}</small></span></li>`).join('')}</ul><p class="eyebrow" style="margin:12px 0 6px">This placement</p><ul class="guards">${pl.marks.map(m => `<li><i class="ph-fill ph-check-circle"></i><span>${esc(m)}</span></li>`).join('')}</ul>`;
  else body = `<div class="chain"><i class="ph-fill ph-link"></i>${r.log.entries.length} entries · hash chain intact</div><ol class="log">${r.log.entries.slice().reverse().map(e => `<li class="${e.step === 'Customer' ? 'cust' : ''}"><div><b>${esc(e.text)}</b><time>${new Date(e.at).toLocaleTimeString('en-IN', { hour12: false })}</time></div>${e.data ? `<small>${esc(e.data)}</small>` : ''}<code>${e.hash}</code></li>`).join('')}</ol>`;
  return `<div class="pn-h"><p class="eyebrow">Decision record</p><button class="x" data-act="close-panel" aria-label="Close"><i class="ph-bold ph-x"></i></button></div><div class="ptabs">${tab('gap', 'ph-scales', 'Today')}${tab('why', 'ph-target', 'Why')}${tab('rules', 'ph-shield-check', 'Rules')}${tab('audit', 'ph-list-checks', 'Audit')}</div><div class="pbody">${body}</div>`;
}
function vRail() {
  const r = S.res;
  const b = (k, icon, label, n) => `<button data-panel="${k}" ${pop(`<b>${label}</b><p>Open the ${label.toLowerCase()} for this offer</p>`)}><i class="ph-bold ${icon}"></i><em>${n}</em><small>${label}</small></button>`;
  return `<div class="rail">${b('gap', 'ph-scales', 'Compare', LEGACY_VIOLATIONS.length)}${b('why', 'ph-target', 'Why', r.picked.length)}${b('rules', 'ph-shield-check', 'Compliance', r.guards.filter(g => g.ok).length)}${b('audit', 'ph-list-checks', 'Audit', r.log.entries.length)}</div>`;
}

/* ── the widget, in each placement ── */
const digit = `<span class="digit">Insured by <img src="/hub/brand/digit.png" alt="Digit"></span>`;
function offerRow(x, cta = true) {
  const added = S.w.added === x.id;
  const why = `<b>Why this for ${esc(first(S.p.name))}</b><div class="chips">${(x.matched[0]?.signals || []).map(s => `<span>${esc(s)}</span>`).join('')}</div><em>Fit ${x.score}/100</em>`;
  return `<div class="offer${added ? ' added' : ''}"><span class="o-ico"><i class="ph-bold ph-shield-check"></i></span><div class="o-t"><b>${esc(x.name.replace(/ \(.*\)/, ''))} <i class="ph-bold ph-info" data-act="details" data-id="${x.id}" ${pop(why)}></i></b><small>${esc(x.matched[0]?.need || x.cat)}</small></div>
    <div class="o-p"><b>${inr(totalOf(x))}</b><small>incl. GST</small></div>${cta ? (added ? `<button class="w-btn done" data-act="remove"><i class="ph-bold ph-check"></i> Added</button>` : `<button class="w-btn" data-act="details" data-id="${x.id}">Add</button>`) : ''}</div>`;
}
function addedStrip() { const x = S.res.picked.find(k => k.id === S.w.added); return x ? `<div class="strip"><i class="ph-fill ph-check-circle"></i><span><b>${esc(x.name.replace(/ \(.*\)/, ''))} added</b><small>${inr(totalOf(x))} · cancel free within 30 days</small></span><button data-act="remove">Remove</button></div>` : ''; }
function wInline() {
  const x = pick(); if (!x) return '';
  const rest = S.res.picked.slice(1);
  return `<section class="w w-inline${S.w.open ? ' open' : ''}"><button class="w-head" data-act="toggle-open"><span class="w-logo"><i class="ph-fill ph-shield-check"></i></span><span><b>LoanBee Protect</b><small>${S.w.added ? 'Cover added' : `Optional · picked for you · from ${inr(totalOf(x))}`}</small></span><i class="ph-bold ph-caret-${S.w.open ? 'up' : 'down'}"></i></button>
    ${S.w.open ? `<div class="w-body">${offerRow(x)}${S.w.more ? rest.map(k => offerRow(k)).join('') : rest.length ? `<button class="more" data-act="more">${rest.length} more that fit you</button>` : ''}<div class="w-foot">${digit}<span>Your loan does not depend on this</span></div></div>` : ''}</section>`;
}
function wToggle() {
  const x = pick(); if (!x) return '';
  const on = S.w.added === x.id;
  return `<div class="w-line"><div><b>Protect this loan <i class="ph-bold ph-info" data-act="details" data-id="${x.id}"></i></b><small>${esc(x.name.replace(/ \(.*\)/, ''))} · optional</small></div><span class="lp">${inr(totalOf(x))}</span><button class="sw${on ? ' on' : ''}" data-act="${on ? 'remove' : 'details'}" data-id="${x.id}" role="switch" aria-checked="${on}" aria-label="Protect this loan"><i></i></button></div>`;
}
function wSheetCard() {
  const x = pick(); if (!x || S.w.skipped || S.w.added) return '';
  return `<div class="scrim"></div><section class="sheet presign"><span class="grab"></span><p class="eyebrow">Before you sign · optional</p><h3>Cover that fits you, ${esc(first(S.p.name))}</h3>${offerRow(x, false)}
    <ul class="facts"><li><i class="ph-bold ph-check"></i>Your loan is approved either way</li><li><i class="ph-bold ph-check"></i>Cancel free within 30 days</li></ul>
    <div class="eq"><button class="w-btn ghost" data-act="skip">Skip</button><button class="w-btn" data-act="details" data-id="${x.id}">Add · ${inr(totalOf(x))}</button></div><div class="w-foot">${digit}</div></section>`;
}
function wChecklist() {
  const x = pick();
  const row = (ok, label, sub, extra = '') => `<div class="ck${ok ? ' ok' : ''}"><i class="ph-fill ${ok ? 'ph-check-circle' : 'ph-circle'}"></i><div><b>${label}</b><small>${sub}</small></div>${extra}</div>`;
  const state = S.w.added ? 'Added' : S.w.skipped ? 'Skipped' : '';
  return `<div class="cklist">${row(true, 'KYC', 'Verified with Aadhaar')}${row(true, 'Bank account', 'HDFC ··· 4821')}${row(true, 'Auto-debit', 'e-Mandate set up')}
    ${x ? row(!!state, 'Protection <em>optional</em>', state ? `${state}${S.w.added ? ' · ' + inr(totalOf(x)) : ''}` : `${esc(x.name.replace(/ \(.*\)/, ''))} · ${inr(totalOf(x))}`, state ? `<button class="lk" data-act="${S.w.added ? 'remove' : 'unskip'}">Change</button>` : `<span class="ck-a"><button class="lk" data-act="skip">Skip</button><button class="w-btn sm" data-act="details" data-id="${x.id}">View</button></span>`) : ''}
    ${row(false, 'e-Sign agreement', 'Last step')}</div>`;
}
function wPost() {
  const x = pick(); if (!x || S.w.dismissed) return '';
  return S.w.added ? addedStrip() : `<section class="w w-post"><button class="dis" data-act="dismiss" aria-label="Dismiss"><i class="ph-bold ph-x"></i></button><p class="eyebrow">Now that your loan is done</p>${offerRow(x)}<div class="w-foot">${digit}<span>Paid separately · not from your loan</span></div></section>`;
}
/* What the policy leaves out, by cover type. Short and plain; the policy wording governs. */
const NOT_COVERED = {
  Accident: 'Illness, self-injury, intoxication and hazardous sports.', 'Loan protection': 'Death in the first year by suicide, and conditions known but not declared.', 'Hospital cash': 'The first 30 days for illness, and stays under 24 hours.',
  Health: 'Conditions you already have, for the waiting period in the policy.', 'Cyber & card': 'Payments you approved yourself, including after sharing an OTP.', Device: 'Wear and tear, cosmetic damage and loss.'
};
/* The consent step, built to the compliant-journey guide: role disclosed, full price first, terms before consent,
   one product at a time, decline equal to accept, provider choice, no deduction from the loan. */
function detailsSheet() {
  const x = S.res.picked.find(k => k.id === S.w.sheet); if (!x) return '';
  const p = priceOf(x), g = gst(p), tot = p + g, perDay = (tot / 365).toFixed(tot / 365 < 10 ? 1 : 0), post = PLACEMENTS[S.pl].key === 'post';
  return `<div class="scrim" data-act="close-sheet"></div><section class="sheet consent"><span class="grab"></span>
    <div class="sh-h"><span class="o-ico"><i class="ph-bold ph-shield-check"></i></span><div><b>${esc(x.name.replace(/ \(.*\)/, ''))}</b><small>${esc(x.matched[0]?.need || x.cat)}</small></div><button class="x" data-act="close-sheet" aria-label="Close"><i class="ph-bold ph-x"></i></button></div>
    <p class="role">Insurance by <img src="/hub/brand/digit.png" alt="Digit">offered by LoanBee through Symbo</p>
    <div class="value"><div><small>You pay · ${esc(x.unit || 'one time')}</small><b>${inr(tot)}</b></div><div><small>That is about</small><b>₹${perDay} a day</b></div></div>
    <p class="split">Premium ${inr(p)} + GST ${inr(g)} · no other fees</p>
    <div class="terms" tabindex="0" aria-label="Terms and exclusions"><p class="t-h">Terms and exclusions</p>
      <p><b>Covers.</b> ${esc(x.covers)}</p><p><b>Does not cover.</b> ${esc(NOT_COVERED[x.group] || 'Events before the cover starts, and the exclusions listed in the policy.')}</p>
      <p><b>Optional.</b> Your loan is approved either way. Saying no changes nothing.</p><p><b>Payment.</b> ${post ? 'Paid by UPI now.' : 'Paid by UPI at checkout.'} It is never deducted from your loan money.</p>
      <p><b>Change your mind.</b> Cancel within 30 days for a full refund. Remove it here any time before you sign.</p><p><b>Claims.</b> Raise a claim in the LoanBee app or on the helpline in your confirmation SMS.</p></div>
    <div class="sh-foot"><p class="gate${S.w.read ? ' ok' : ''}" id="gate"><i class="ph-bold ${S.w.read ? 'ph-check-circle' : 'ph-arrow-down'}"></i><span>${S.w.read ? 'Terms viewed. Choose below.' : 'Scroll through the terms to enable Add cover'}</span></p>
    <div class="eq"><button class="w-btn ghost" data-act="close-sheet-no">Not now</button><button class="w-btn" data-act="agree" data-id="${x.id}" ${S.w.read ? '' : 'disabled'}>Add cover · ${inr(tot)}</button></div>
    <button class="lk c" data-act="own">I already have this cover elsewhere</button></div></section>`;
}
/* ── mis-selling contrast: the same borrower, sold the way most lending apps sell today ──
   A fixed pack, pre-ticked, mandatory and deducted from the loan. Each numbered pin is one rule it breaks. */
function vLegacy() {
  const p = S.p, d = S.res.derived, L = legacy(p, S.res), fee = Math.round(p.amount * .0236);
  const pin = n => `<button class="pin${S.pin === n ? ' on' : ''}" data-pin="${n}" aria-label="Violation ${n}" ${pop(`<b>${n}. ${esc(LEGACY_VIOLATIONS[n - 1][0])}</b><p>${esc(LEGACY_VIOLATIONS[n - 1][1])}</p><em>${esc(LEGACY_VIOLATIONS[n - 1][2])}</em>`)}>${n}</button>`;
  return `<div class="phone legacy"><div class="island"></div><div class="screen">
      <div class="sb"><span>9:41</span><span class="sbi"><i></i></span></div>
      <div class="lb-bar"><button aria-label="Back"><i class="ph-bold ph-arrow-left"></i></button><span class="lb"><i></i>LoanBee</span><button class="help">Help</button></div>
      <div class="lb-prog">${[1, 2, 3, 4, 5].map(i => `<i class="${i < 5 ? 'd' : 'c'}"></i>`).join('')}</div>
      <div class="scroll"><h2>Review and sign</h2><p class="sub">Step 5 of 5 · Check your offer</p>
        <div class="loan"><div class="ln-h"><span>Personal loan</span><em><i></i>Approved</em></div><b class="amt">${inr(p.amount)}</b>
          <div class="ln-g"><div><small>Tenure</small><b>${p.tenure} months</b></div><div><small>Monthly EMI</small><b>${inr(d.emi)}</b></div><div><small>Interest</small><b>${p.rate}% p.a.</b></div><div><small>Processing fee</small><b>${inr(fee)}</b></div></div>
          <div class="w-line lg"><div><b>LoanBee Insurance ${pin(7)}</b><small>Deducted from your loan ${pin(3)}</small></div><span class="lp">−${inr(L.total)}</span></div>
          <div class="recv"><span>You receive</span><b>${inr(p.amount - fee - L.total)}</b></div></div>
        <section class="lg-pack"><div class="lg-h"><b>Protection pack</b><span class="timer"><i class="ph-bold ph-timer"></i> Ends in <i id="lg-timer">01:59</i> ${pin(8)}</span></div>
          <p class="mand"><i class="ph-fill ph-lock-simple"></i> Mandatory for loan disbursal ${pin(2)}</p>
          ${L.items.map((x, i) => `<div class="lg-row"><span class="tick"><i class="ph-bold ph-check"></i></span><span>${esc(x.name)}</span><b>${inr(x.base)}</b>${i === 0 ? pin(1) : ''}</div>`).join('')}
          <p class="lg-note">Standard pack for all borrowers ${pin(6)} <span>+ GST at payment ${pin(10)}</span></p>
          <div class="lg-agree"><span class="tick"><i class="ph-bold ph-check"></i></span><span>I agree to all add-on services and their terms ${pin(4)} ${pin(5)}</span></div>
        </section></div>
      <div class="lb-cta lg-cta"><button>Accept and disburse</button><a>No, I don't want to protect my family ${pin(9)}</a></div>
    </div></div>`;
}
/* The comparison: what the borrower is charged each way, the engine's verdict on today's pack, and the rules it breaks. */
function vGap() {
  const L = legacy(S.p, S.res), r = S.res, name = first(S.p.name), x = r.picked.find(k => k.id === S.w.added);
  return `<div class="vs"><div class="bad"><small>Sold today</small><b>${inr(L.total)}</b><span>${L.items.length} products, all charged</span></div><div class="good"><small>With Symbo</small><b>${x ? inr(totalOf(x)) : '₹0'}</b><span>${x ? '1 chosen by ' + esc(name) : r.picked.length + ' offered, none forced'}</span></div></div>
    <p class="eyebrow">Engine verdict on today's pack</p>
    <ul class="verdicts">${L.items.map(i => `<li class="${i.ok ? 'ok' : 'no'}"><i class="ph-fill ${i.ok ? 'ph-check-circle' : 'ph-x-circle'}"></i><span>${esc(i.name)}<small>${esc(i.ok ? 'Suitable' : i.verdict)}${i.reason ? ' · ' + esc(i.reason) : ''}</small></span><b>${inr(i.price)}</b></li>`).join('')}</ul>
    <p class="waste${L.wasted ? '' : ' ok'}">${L.wasted ? `<b>${inr(L.wasted)}</b> charged for cover ${esc(name)} does not need` : `All three fit ${esc(name)}. The way they are sold still breaks ${L.violations} rules.`}</p>
    <p class="eyebrow">${L.violations} rules broken in today's flow</p>
    <ol class="viol">${LEGACY_VIOLATIONS.map(([t, , ref], i) => `<li class="${S.pin === i + 1 ? 'on' : ''}" data-pin="${i + 1}"><span>${i + 1}</span><div><b>${esc(t)}</b><small>${esc(ref)}</small></div></li>`).join('')}</ol>
    <p class="expo"><i class="ph-fill ph-warning"></i><span>The lender's own policy must provide customer compensation for mis-selling. <em>§101A · effective 1 January 2027</em></span></p>`;
}
function vPhone() {
  const p = S.p, d = S.res.derived, pl = PLACEMENTS[S.pl].key, fee = Math.round(p.amount * .0236), x = S.res.picked.find(k => k.id === S.w.added);
  const loanCard = `<div class="loan"><div class="ln-h"><span>Personal loan</span><em><i></i>Approved</em></div><b class="amt">${inr(p.amount)}</b>
      <div class="ln-g"><div><small>Tenure</small><b>${p.tenure} months</b></div><div><small>Monthly EMI</small><b>${inr(d.emi)}</b></div><div><small>Interest</small><b>${p.rate}% p.a.</b></div><div><small>Processing fee</small><b>${inr(fee)}</b></div></div>
      ${pl === 'toggle' ? wToggle() : ''}${x && pl !== 'toggle' && pl !== 'post' ? `<div class="w-line got"><div><b>Protection</b><small>${esc(x.name.replace(/ \(.*\)/, ''))} · optional</small></div><span class="lp">${inr(totalOf(x))}</span></div>` : ''}
      <div class="recv"><span>You receive</span><b>${inr(p.amount - fee)}</b></div></div>`;
  let body, cta;
  if (pl === 'checklist') { body = `<h2>Almost done</h2><p class="sub">Step 4 of 5 · Finish and sign</p>${wChecklist()}`; cta = 'Continue to e-sign'; }
  else if (pl === 'post') { body = `<div class="success"><span><i class="ph-bold ph-check"></i></span><h2>${inr(p.amount - fee)} is on its way</h2><p class="sub">To HDFC ··· 4821 · usually within 10 minutes</p></div>${wPost()}<div class="next"><small>First EMI</small><b>${inr(d.emi)} on 5 Jan</b></div>`; cta = 'Go to home'; }
  else { body = `<h2>Review and sign</h2><p class="sub">Step 5 of 5 · Check your offer</p>${loanCard}${pl === 'inline' ? wInline() : ''}${pl === 'toggle' && x ? '' : ''}`; cta = pl === 'sheet' ? 'Continue to e-sign' : 'e-Sign and get money'; }
  return `<div class="phone"><div class="island"></div><div class="screen">
      <div class="sb"><span>9:41</span><span class="sbi"><i></i></span></div>
      <div class="lb-bar"><button aria-label="Back"><i class="ph-bold ph-arrow-left"></i></button><span class="lb"><i></i>LoanBee</span><button class="help">Help</button></div>
      <div class="lb-prog">${[1, 2, 3, 4, 5].map(i => `<i class="${pl === 'post' || i < (pl === 'checklist' ? 4 : 5) ? 'd' : i === (pl === 'checklist' ? 4 : 5) ? 'c' : ''}"></i>`).join('')}</div>
      <div class="scroll">${body}<p class="pw">Protection powered by <img src="/hub/brand/symbo-logo.png" alt="Symbo"></p></div>
      <div class="lb-cta"><button data-act="cta">${cta}</button></div>
      ${pl === 'sheet' && !S.w.sheet ? wSheetCard() : ''}${S.w.sheet ? detailsSheet() : ''}
    </div></div>`;
}

function render() {
  S.pops = new Map();
  const pl = PLACEMENTS[S.pl];
  $('#app').innerHTML = `<header class="top"><a class="brand" href="/"><img src="/hub/brand/symbo-logo.png" alt="Symbo"></a><div class="ttl"><small>Embedded widget</small><b>LoanBee checkout</b></div>
      <button class="m-btn l" data-act="drawer-left" aria-label="Borrower"><i class="ph-bold ph-user-gear"></i></button>
      <div class="pager" id="pager"><button data-act="prev" aria-label="Previous placement"><i class="ph-bold ph-caret-left"></i></button><div class="pg-t"><small>Placement ${S.pl + 1} of ${PLACEMENTS.length}</small><b>${pl.name}</b><div class="pg-d">${PLACEMENTS.map((_, i) => `<i class="${i === S.pl ? 'on' : ''}" data-go="${i}"></i>`).join('')}</div></div><button data-act="next" aria-label="Next placement"><i class="ph-bold ph-caret-right"></i></button></div>
      <button class="cmp${S.contrast ? ' on' : ''}" data-act="contrast" aria-pressed="${S.contrast}"><i class="ph-bold ph-scales"></i><span>${S.contrast ? 'Comparing with today' : 'Compare with today'}</span></button>
      <button class="m-btn r" data-act="drawer-right" aria-label="Decision record"><i class="ph-bold ph-clipboard-text"></i></button>
      <span class="insured">Insured by <img src="/hub/brand/digit.png" alt="Digit"></span></header>
    <main class="stage${S.panel ? ' panel-open' : ''}${S.drawer ? ' drawer-' + S.drawer : ''}">
      <aside class="pn left">${vBorrower()}</aside>
      <section class="mid${S.contrast ? ' contrast show-' + S.side : ''}" id="swipe">${S.contrast ? `<div class="side-sw"><button class="${S.side === 'today' ? 'on' : ''}" data-side="today">Sold today</button><button class="${S.side === 'symbo' ? 'on' : ''}" data-side="symbo">With Symbo</button></div><div class="pair"><div class="ph-col today"><p class="tagline bad"><i class="ph-fill ph-x-circle"></i>Sold today · ${LEGACY_VIOLATIONS.length} rules broken</p>${vLegacy()}</div><div class="ph-col symbo"><p class="tagline good"><i class="ph-fill ph-check-circle"></i>With Symbo · same borrower</p>${vPhone()}</div></div>` : `${vPhone()}
        <div class="meta"><p class="where"><i class="ph-bold ph-map-pin"></i>${esc(pl.where)}</p><div class="taps"><span><b>${pl.add}</b>tap${pl.add > 1 ? 's' : ''} to add</span><span><b>${pl.skip}</b>tap${pl.skip === 1 ? '' : 's'} to skip</span><span><b>Never</b>pre-selected</span></div><p class="best">${esc(pl.best)}</p></div>`}</section>
      ${S.panel ? `<aside class="pn right">${vRecord()}</aside>` : vRail()}
      <div class="dscrim" data-act="close-drawer"></div></main>`;
  liftMenu(); clearTimeout(liftT); liftT = setTimeout(liftMenu, 450);   /* again once a sheet has slid up */
}
let liftT = 0;
/* On small screens the phone's bottom bar (or the consent sheet's buttons) reaches the corner where the
   session menu sits, so ask the menu to sit just above it. */
function liftMenu() {
  let lift = '';
  if (matchMedia('(max-width: 1099px)').matches) {
    const tops = [...document.querySelectorAll('.sh-foot, .lb-cta')].map(el => el.getBoundingClientRect())
      .filter(r => r.width && r.left < 120 && r.bottom > innerHeight - 4 && r.top < innerHeight).map(r => r.top);
    if (tops.length) lift = String(Math.round(innerHeight - Math.min(...tops) + 8));
  }
  document.body.dataset.symboMenuBottom = lift;
}
addEventListener('resize', liftMenu);

/* ── events ── */
function go(i) { S.pl = (i + PLACEMENTS.length) % PLACEMENTS.length; S.w = freshW(); S.w.open = S.pl === 0; if (pick()) S.res.log.add('Widget', `Offer shown · ${PLACEMENTS[S.pl].name}`, 'Not pre-selected'); render(); }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-set],[data-person],[data-panel],[data-go],[data-pin],[data-side]'); if (!t) return;
  const d = t.dataset;
  if (d.person) { S.p = { ...PEOPLE.find(x => x.key === d.person) }; return rerun(); }
  if (d.set) { const cur = S.p[d.set]; S.p[d.set] = typeof cur === 'number' ? Number(d.val) : d.val; return rerun(); }
  if (d.panel) { S.panel = d.panel; S.drawer = S.drawer === 'right' ? 'right' : S.drawer; return render(); }
  if (d.go) return go(Number(d.go));
  if (d.side) { S.side = d.side; return render(); }
  if (d.pin) { const n = Number(d.pin); S.pin = S.pin === n ? null : n; S.panel = 'gap'; if (matchMedia('(max-width: 1099px)').matches) S.drawer = 'right'; render(); const li = document.querySelector('.viol li.on'); if (li) li.scrollIntoView({ block: 'nearest' }); return; }
  const x = d.id ? S.res.picked.find(k => k.id === d.id) : pick();
  switch (d.act) {
    case 'contrast': S.contrast = !S.contrast; S.pin = null; S.side = 'today'; if (S.contrast) { if (!matchMedia('(max-width: 1099px)').matches) S.panel = 'gap'; S.res.log.add('Widget', "Compared with today's bundled flow", `${LEGACY_VIOLATIONS.length} rules broken there · 0 here`); } else if (S.panel === 'gap') S.panel = null; return render();
    case 'prev': return go(S.pl - 1);
    case 'next': return go(S.pl + 1);
    case 'toggle-open': S.w.open = !S.w.open; if (S.w.open) event('Opened the protection card'); return render();
    case 'more': S.w.more = true; event('Viewed more options'); return render();
    case 'details': e.stopPropagation(); S.w.sheet = x.id; S.w.read = false; event(`Opened details · ${x.name}`, `Role, full price ${inr(totalOf(x))} incl. GST and terms shown`); render(); return checkTerms();
    case 'close-sheet': S.w.sheet = null; return render();
    case 'agree': if (!S.w.read) return; S.w.added = x.id; S.w.sheet = null; S.w.skipped = false; event(`Consent given · ${x.name}`, `Tapped "Add cover" after viewing the terms · this product only · ${inr(totalOf(x))}`); event('Cover added · paid separately by UPI', 'Not deducted from loan money'); event('Acknowledgement sent by SMS', 'With helpline number and a copy of the terms'); return render();
    case 'close-sheet-no': S.w.sheet = null; event('Chose "Not now"', 'Loan journey continues unchanged · offer not repeated'); if (['sheet', 'checklist'].includes(PLACEMENTS[S.pl].key)) S.w.skipped = true; return render();
    case 'own': S.w.sheet = null; S.w.skipped = true; event('Has this cover elsewhere', 'Provider choice respected · no offer shown again'); return render();
    case 'remove': event('Cover removed by customer', 'One tap · no questions asked'); S.w.added = null; return render();
    case 'skip': S.w.skipped = true; event('Skipped protection', 'Loan journey continues unchanged'); return render();
    case 'unskip': S.w.skipped = false; return render();
    case 'dismiss': S.w.dismissed = true; event('Dismissed the offer', 'Will not be shown again'); return render();
    case 'close-panel': S.panel = null; S.drawer = null; return render();
    case 'drawer-left': S.drawer = 'left'; return render();
    case 'drawer-right': S.drawer = 'right'; S.panel = S.panel || 'why'; return render();
    case 'close-drawer': S.drawer = null; if (matchMedia('(max-width: 1099px)').matches) S.panel = null; return render();
    case 'cta': if (PLACEMENTS[S.pl].key === 'sheet' && S.w.skipped) { S.w.skipped = false; return render(); } return;
  }
});
document.addEventListener('keydown', e => { if (e.target.matches('input,select,textarea')) return; if (e.key === 'ArrowRight') go(S.pl + 1); if (e.key === 'ArrowLeft') go(S.pl - 1); });
/* swipe between placements on the pager or the stage background */
let sx = null;
document.addEventListener('pointerdown', e => { sx = e.target.closest('#pager, .meta') || (e.pointerType === 'touch' && e.target.closest('.mid') && !e.target.closest('.sheet')) ? e.clientX : null; });
document.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 60) go(S.pl + (dx < 0 ? 1 : -1)); });
/* Terms gate: Add cover activates once the terms have been scrolled to the end (or fit without scrolling). */
function markRead() {
  if (S.w.read || !S.w.sheet) return;
  S.w.read = true; event('Terms viewed to the end', 'Terms version 1.2');
  const btn = $('.sheet [data-act="agree"]'), gate = $('#gate');
  if (btn) btn.disabled = false;
  if (gate) { gate.classList.add('ok'); gate.innerHTML = '<i class="ph-bold ph-check-circle"></i><span>Terms viewed. Choose below.</span>'; }
}
function checkTerms() { const t = $('.sheet .terms'); if (t && t.scrollHeight <= t.clientHeight + 6) markRead(); }
document.addEventListener('scroll', e => { const t = e.target; if (t instanceof Element && t.matches('.sheet .terms') && t.scrollTop + t.clientHeight >= t.scrollHeight - 6) markRead(); }, true);
const popEl = $('#pop');
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-pop]'); if (!t) { popEl.classList.remove('on'); return; }
  const html = S.pops.get(t.dataset.pop); if (!html) return;
  popEl.innerHTML = html; popEl.classList.add('on');
  const r = t.getBoundingClientRect(), w = popEl.offsetWidth, h = popEl.offsetHeight;
  let y = r.bottom + 10; if (y + h > innerHeight - 8) y = r.top - h - 10;
  popEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'; popEl.style.top = Math.max(8, y) + 'px';
});
/* the legacy flow's fake deadline keeps ticking, as it would */
let lgT = 119;
setInterval(() => { const el = document.getElementById('lg-timer'); if (!el) return; lgT = lgT > 0 ? lgT - 1 : 119; el.textContent = `0${Math.floor(lgT / 60)}:${String(lgT % 60).padStart(2, '0')}`; }, 1000);
S.res = run(S.p); S.w = freshW(); S.w.open = true;
S.res.log.add('Widget', `Offer shown · ${PLACEMENTS[0].name}`, `${pick()?.name} · not pre-selected`);
render();

/* Agent portal · Ajay Sales Electronics (store sales agent) and KBI Bank (relationship manager). */
import { ew, validateApplication } from './catalogue.js';
import { CHANNELS, agentLabel, esc, inr, firstName, when, stamp, dateOnly, load, saveSale, getSale, log, encodeQuote, stats, fetchStatus, orgLogo } from './store.js';
import { ENGINES, INVOICES, SEEDS } from './engines.js';
import { LOANS, DEFAULT_LOAN, findLoan, short } from './bank.js';

const $ = s => document.querySelector(s);
const SESSION = 'agent-portal:session';
const STEPS = ['needs', 'recs', 'share'];
const STAGE_ICON = { Customer: 'ph-user', Needs: 'ph-chats-circle', Recommendation: 'ph-sparkle', Pitch: 'ph-megaphone-simple', Share: 'ph-share-network', Consent: 'ph-signature', Purchase: 'ph-seal-check' };
const OPEN = ['Quote ready', 'Quote shared', 'Viewed'];
const RETAIL = { store: [['Motor', 'ph-car-profile'], ['Health', 'ph-heartbeat'], ['Credit Life', 'ph-umbrella-simple'], ['Term Life', 'ph-shield'], ['Travel', 'ph-airplane-tilt'], ['Home', 'ph-house']],
  bank: [['Motor', 'ph-car-profile'], ['Health', 'ph-heartbeat'], ['Term Life', 'ph-shield'], ['Travel', 'ph-airplane-tilt'], ['Home', 'ph-house']] };

const S = { ch: null, view: 'login', step: 'review', sale: null, qi: 0, assessed: [], picks: {}, pi: 0, recordRef: null, data: null, err: '',
  loginOrg: 'store', navOpen: false, collapsed: false, search: DEFAULT_LOAN, found: null, filter: 'All' };

/* ── helpers ─────────────────────────────── */
const E = () => ENGINES[S.ch];
const C = () => CHANNELS[S.ch];
const label = () => agentLabel(S.ch);
const mobile = () => matchMedia('(max-width: 1024px)').matches;
const data = () => (S.data ||= load(S.ch, SEEDS[S.ch]));
const stageLabels = () => ({ Customer: S.ch === 'bank' ? 'Loan & customer' : 'Customer & purchase', Needs: S.ch === 'bank' ? 'Suitability' : 'Needs conversation', Recommendation: 'Symbo recommendation', Pitch: 'Pitch', Share: 'Quote & sharing', Consent: 'Customer review & consent', Purchase: 'Purchase' });
const stepNames = () => S.ch === 'bank' ? ['Loan & suitability', 'Recommend & pitch', 'Share & consent'] : ['Customer & needs', 'Recommend & pitch', 'Share & consent'];
const pill = st => `<span class="pill st-${String(st).toLowerCase().replace(/\s+/g, '-')}">${esc(st)}</span>`;
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const initials = n => n.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2800); }
function persist() { if (S.sale) saveSale(S.sale); S.data = load(S.ch, SEEDS[S.ch]); }
function scrollTop() { window.scrollTo(0, 0); const c = $('.content'); if (c) c.scrollTop = 0; }
function go(view, step) { S.view = view; if (step) S.step = step; S.err = ''; S.navOpen = false; render(); scrollTop(); }
const latestFor = id => data().sales.filter(s => s.sourceId === id).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove(); return ok;
  }
}
function chosen(p) { const v = p.variants?.length ? p.variants.find(x => x.name === S.picks[p.id]) : null; return v ? { ...p, variant: v.name, price: v.price } : p; }
function ranked() {
  return S.assessed.filter(p => p.recommended && p.eligible && !p.disabled)
    .map(p => ({ p: chosen(p), sig: E().signals(S.sale, p.id).length })).sort((a, b) => b.sig - a.sig);
}

/* ── session ─────────────────────────────── */
function signIn(ch) {
  S.ch = ch; S.data = null; S.sale = null; S.found = null; S.search = DEFAULT_LOAN;
  try { sessionStorage.setItem(SESSION, ch); } catch { /* ignore */ }
  go('home');
}
function signOut() { try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ } S.ch = null; S.sale = null; S.data = null; go('login'); }

/* ── sale lifecycle ─────────────────────── */
function startFrom(source) {
  S.sale = E().start(source);
  S.assessed = []; S.picks = {}; S.editing = false;
  go('journey', 'needs');
}
function readCustomer() {
  const form = $('#cust'); if (!form) return;
  const f = new FormData(form), c = S.sale.customer;
  for (const k of ['name', 'mobile', 'email', 'city', 'pincode', 'assetId', 'brand', 'model']) c[k] = String(f.get(k) || '').trim();
  for (const k of ['age', 'assetCost', 'loanAmount', 'tenure']) c[k] = Number(String(f.get(k) || '').replace(/[^\d.]/g, ''));
  E().refresh(S.sale);
}
/* Logged once, the first time the agent acts on this customer. */
function logCustomer() {
  const s = S.sale;
  if ((s.audit || []).some(e => e.stage === 'Customer')) return;
  if (S.ch === 'store') log(s, label(), 'Customer', `Opened invoice ${s.sourceId} for ${s.customer.name}`, `${s.subject} · ${s.subjectDetail} · ${inr(s.customer.assetCost)} · loan ${inr(s.customer.loanAmount)} over ${s.customer.tenure} months`);
  else log(s, label(), 'Customer', `Opened loan ${s.loan.id} for ${s.customer.name}`, `${s.loan.product} · ${short(s.loan.amount)} · EMI ${inr(s.loan.emi)} × ${s.loan.tenure} · ${s.loan.occ}`);
}
function answer(id, value) {
  logCustomer();
  const next = S.sale.answers[id] === value ? null : value;   /* tap again to clear */
  if (next === null) delete S.sale.answers[id]; else S.sale.answers[id] = next;
  if (id === 'health' && S.ch === 'store' && (next === 'None' || next === null)) delete S.sale.answers.members;
  const q = E().questions(S.sale).find(x => x.id === id) || { title: id };
  log(S.sale, label(), 'Needs', next === null ? `Cleared: ${q.title}` : `Asked: ${q.title}`, next === null ? '' : `Answer: ${next}`);
  render();
}
function compute() {
  if (S.ch === 'store') {
    readCustomer();
    try { validateApplication({ ...S.sale.customer, warrantyYears: 1, purchaseDays: 0, usage: 'home', condition: 'new', answers: {} }); } catch (e) { S.err = e.message; S.editing = true; return render(); }
  }
  logCustomer();
  const qs = E().questions(S.sale);
  S.assessed = E().assess(S.sale);
  S.picks = {};
  for (const p of S.assessed) if (p.variants?.length) S.picks[p.id] = p.variant || p.variants[0].name;
  const rec = S.assessed.filter(p => p.recommended && p.eligible && !p.disabled);
  S.sale.questions = { answered: qs.filter(q => S.sale.answers[q.id]).length, total: qs.length };
  S.sale.recommended = rec.map(p => p.id);
  S.sale.responses = {};
  log(S.sale, 'Symbo', 'Recommendation', `${rec.length} of ${S.assessed.length} products recommended`, rec.map(p => `${p.name}${p.variant ? ' (' + p.variant + ')' : ''}`).join(', ') || 'None');
  for (const p of S.assessed.filter(p => !(p.recommended && p.eligible && !p.disabled))) log(S.sale, 'Symbo', 'Recommendation', `Not recommended: ${p.name}`, p.reason);
  persist();
  go('journey', 'computing');
  setTimeout(() => { if (S.view === 'journey' && S.step === 'computing') go('journey', 'recs'); }, 1700);
}
function setResponse(id, kind) {
  if (S.sale.responses[id] === kind) delete S.sale.responses[id]; else S.sale.responses[id] = kind;
  render();
}
/* One tap closes the pitch: every recommended product is logged with its outcome. */
function createQuote() {
  const list = ranked();
  for (const { p } of list) {
    const k = S.sale.responses[p.id] || 'not_now'; S.sale.responses[p.id] = k;
    log(S.sale, label(), 'Pitch', k === 'interested' ? `Pitched ${p.name}: customer interested` : `Pitched ${p.name}: not now`, `${p.variant ? p.variant + ' · ' : ''}${inr(p.price)}`);
  }
  const items = list.filter(x => S.sale.responses[x.p.id] === 'interested').map(x => ({ id: x.p.id, name: x.p.name, variant: x.p.variant || '', price: Math.round(x.p.price) }));
  if (!items.length) {
    S.sale.status = list.length ? 'Not taken' : 'No fit';
    log(S.sale, label(), 'Pitch', list.length ? 'Customer chose not to take any product now' : 'No suitable product; nothing pitched');
    persist(); toast('Logged to the customer record.'); S.sale = null; return go('home');
  }
  S.sale.quote = { items, total: items.reduce((n, x) => n + x.price, 0), expiresAt: Date.now() + 48 * 3600e3 };
  S.sale.status = 'Quote ready';
  log(S.sale, 'Symbo', 'Share', `Quote ${S.sale.ref} prepared`, `${items.map(x => x.name).join(', ')} · ${inr(S.sale.quote.total)}`);
  persist(); go('journey', 'share');
}
function buyLink(sale) { const u = new URL('buy.html', location.href); u.hash = 'q=' + encodeQuote(sale); return u.toString(); }
function waMessage(sale) {
  const c = sale.customer, a = C().agent;
  const lines = sale.quote.items.map(x => `• ${x.name}${x.variant ? ' · ' + x.variant : ''}: ${inr(x.price)}`);
  const intro = S.ch === 'bank'
    ? `Hi ${firstName(c.name)}, this is ${a.name}, your relationship manager at ${C().org}.\n\nAs discussed, here is the protection plan for your ${sale.loan.product.toLowerCase()} (${sale.loan.id}):`
    : `Hi ${firstName(c.name)}, this is ${a.name} from ${C().org}, ${a.branch.split(',')[0]}.\n\nAs discussed, here is your protection quote for your ${c.brand} ${c.model} (${sale.subject}):`;
  return `${intro}\n${lines.join('\n')}\nTotal: ${inr(sale.quote.total)} (GST included)\n\nReview and buy here: ${buyLink(sale)}\n\nQuote ${sale.ref} · valid for 48 hours`;
}
function markShared(channel) {
  if (S.sale.status === 'Quote ready') S.sale.status = 'Quote shared';
  log(S.sale, label(), 'Share', `Quote ${S.sale.ref} shared (${channel})`, inr(S.sale.quote.total));
  persist(); renderRecordPanel();
  const badge = $('.q-top .pill'); if (badge) badge.outerHTML = pill(S.sale.status);
}

/* ── login ───────────────────────────────── */
function vLogin() {
  const o = S.loginOrg, ch = CHANNELS[o];
  const org = id => `<button type="button" class="org${o === id ? ' on' : ''}" data-org="${id}">${orgLogo(id, 34)}<span class="org-txt"><b>${esc(CHANNELS[id].org)}</b><small>${id === 'store' ? 'Store sales' : 'Relationship managers'}</small></span><i class="ph-bold ph-check-circle"></i></button>`;
  return `<div class="login">
    <section class="login-side">${orgLogo(o, 56)}<h2>${esc(ch.org)}</h2><p>${o === 'store' ? 'Protection with every financed purchase.' : 'Protection for every sanctioned loan.'}</p><span class="pw light">Powered by <img src="./assets/symbo-logo.png" alt="Symbo"></span></section>
    <section class="login-main">
      <form id="login" class="login-card" autocomplete="off">
        <p class="eyebrow">Agent portal</p><h1>Sign in</h1>
        <div class="orgs">${org('store')}${org('bank')}</div>
        <label class="f"><span>Agent ID</span><input name="agentId" value="${esc(ch.agent.id)}" readonly></label>
        <label class="f"><span>Password</span><input name="pw" type="password" value="xxxxxxxxxx" readonly></label>
        <button class="btn" type="submit">Sign in as ${esc(ch.agent.name)} <i class="ph-bold ph-arrow-right"></i></button>
      </form>
    </section>
  </div>`;
}

/* ── dashboard ─────────────────────────── */
function kpis() {
  const st = stats(data().sales, C().target);
  const pct = Math.min(100, Math.round(st.policies / st.target * 100));
  const k = (icon, lbl, val, sub = '') => `<div class="kpi"><span class="k-ico"><i class="ph-bold ${icon}"></i></span><div><small>${lbl}</small><b>${val}</b>${sub ? `<em>${sub}</em>` : ''}</div></div>`;
  return `<div class="kpis">
    ${k('ph-shield-check', 'Policies today', st.todayPolicies, inr(st.todayPremium) + ' premium')}
    ${k('ph-currency-inr', 'Premium · 30 days', inr(st.premium), st.policies + ' policies')}
    ${k('ph-chart-line-up', 'Conversion · 30 days', st.conversion + '%', `${st.open} quote${st.open === 1 ? '' : 's'} awaiting customer`)}
    <div class="kpi target"><div class="tl"><small>Monthly target</small><b>${st.policies} / ${st.target}</b></div><div class="bar"><i style="width:${pct}%"></i></div><em>${pct}% of policies</em></div>
  </div>`;
}
function recentCard(title) {
  const rows = data().sales.filter(s => s.status !== 'Draft').sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  return `<section class="card"><div class="card-h"><h3>${title}</h3><button class="linkbtn" data-nav="records">All records <i class="ph-bold ph-arrow-right"></i></button></div>
    <div class="rows">${rows.map(s => `<button class="rrow" data-record="${esc(s.ref)}"><span class="ini">${esc(initials(s.customer.name))}</span><span class="rm"><b>${esc(s.customer.name)}</b><small>${esc(s.subject)} · ${s.quote.items.length} product${s.quote.items.length === 1 ? '' : 's'} · ${esc(when(s.createdAt))}</small></span><span class="re"><b>${s.quote.total ? inr(s.quote.total) : '–'}</b>${pill(s.status)}</span></button>`).join('')}</div></section>`;
}
function vHomeStore() {
  const a = C().agent;
  const row = inv => {
    const s = latestFor(inv.inv), st = s ? s.status : 'Not offered';
    const action = !s || s.status === 'Draft' ? `<button class="btn sm" data-inv="${inv.inv}">Offer protection</button>` : `<button class="btn sm secondary" data-record="${esc(s.ref)}">View record</button>`;
    return `<tr><td data-l="Time" class="mono">${inv.at}</td><td data-l="Invoice" class="mono">${inv.inv}</td><td data-l="Customer"><b>${esc(inv.name)}</b><small>${inv.age} yrs · ${esc(inv.city)}</small></td>
      <td data-l="Product"><b>${esc(inv.brand)} ${esc(inv.model)}</b><small>${esc((ew.assets.find(x => x.id === inv.assetId) || {}).name)}</small></td><td data-l="Invoice value">${inr(inv.assetCost)}</td>
      <td data-l="Loan">${inr(inv.loanAmount)}<small>${inv.tenure} months</small></td><td data-l="Protection">${pill(st)}</td><td class="act">${action}</td></tr>`;
  };
  return `<div class="hello"><div><h2>${greet()}, ${esc(a.name)}</h2><p>${esc(C().org)} · ${esc(a.branch)} · ${dateOnly(Date.now())}</p></div><button class="btn" data-inv="${INVOICES[0].inv}"><i class="ph-bold ph-plus"></i> New protection sale</button></div>
    ${kpis()}
    <section class="card"><div class="card-h"><h3>Financed sales today</h3><span class="muted small">Select a customer to offer protection</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Invoice</th><th>Customer</th><th>Product</th><th>Invoice value</th><th>Loan</th><th>Protection</th><th></th></tr></thead><tbody>${INVOICES.map(row).join('')}</tbody></table></div></section>
    ${recentCard('Recent protection sales')}`;
}
function vHomeBank() {
  const a = C().agent;
  const f = S.found;
  const fs = f && latestFor(f.id);
  const found = S.err ? `<p class="err">${esc(S.err)}</p>` : f ? `<div class="found">
      <div class="fd-h"><span class="ini big">${esc(initials(f.name))}</span><div><b>${esc(f.name)}</b><small>${esc(f.id)} · ${esc(f.product)}</small></div>${pill(fs ? fs.status : 'Not offered')}</div>
      <div class="facts">${[['Sanctioned', short(f.amount)], ['EMI', inr(f.emi)], ['Tenure', f.tenure + ' months'], ['Rate', f.rate + '%'], ['Occupation', f.occ], ['Sanctioned on', dateOnly(f.sanctionedAt)]].map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
      <div class="fd-a">${fs && fs.status !== 'Draft' ? `<button class="btn secondary" data-record="${esc(fs.ref)}">View record</button>` : ''}<button class="btn" data-loan="${esc(f.id)}">Open loan <i class="ph-bold ph-arrow-right"></i></button></div></div>` : '';
  const row = l => {
    const s = latestFor(l.id), st = s ? s.status : 'Not offered';
    return `<tr><td data-l="Loan ID" class="mono">${l.id}</td><td data-l="Customer"><b>${esc(l.name)}</b><small>${l.age} yrs · ${esc(l.occ)}</small></td><td data-l="Product">${esc(l.product)}</td><td data-l="Sanctioned"><b>${short(l.amount)}</b></td>
      <td data-l="Tenure">${l.tenure} m</td><td data-l="EMI">${inr(l.emi)}</td><td data-l="Sanctioned on">${dateOnly(l.sanctionedAt)}</td><td data-l="Insurance">${pill(st)}</td><td class="act"><button class="btn sm ${s && s.status !== 'Draft' ? 'secondary' : ''}" ${s && s.status !== 'Draft' ? `data-record="${esc(s.ref)}">View` : `data-loan="${l.id}">Open`}</button></td></tr>`;
  };
  const total = LOANS.reduce((n, l) => n + l.amount, 0);
  return `<div class="hello"><div><h2>${greet()}, ${esc(firstName(a.name))}</h2><p>${esc(C().org)} · ${esc(a.branch)} · ${dateOnly(Date.now())}</p></div><span class="chip"><i class="ph-bold ph-bank"></i> ${LOANS.length} loans sanctioned · ${short(total)}</span></div>
    ${kpis()}
    <section class="card search-card"><div class="card-h"><h3>Find a loan</h3></div>
      <form id="loan-search" class="search"><i class="ph-bold ph-magnifying-glass"></i><input name="q" value="${esc(S.search)}" aria-label="Loan ID" placeholder="Loan ID"><button class="btn sm" type="submit">Search</button></form>${found}</section>
    <section class="card"><div class="card-h"><h3>Sanctioned loans</h3><span class="muted small">Select a loan to pitch protection</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Loan ID</th><th>Customer</th><th>Product</th><th>Sanctioned</th><th>Tenure</th><th>EMI</th><th>Sanctioned on</th><th>Insurance</th><th></th></tr></thead><tbody>${LOANS.map(row).join('')}</tbody></table></div></section>
    ${recentCard('Recent insurance sales')}`;
}

/* ── records ─────────────────────────── */
function vRecords() {
  const groups = { All: () => true, Purchased: s => s.status === 'Purchased', Open: s => OPEN.includes(s.status), 'Not taken': s => ['Not taken', 'No fit'].includes(s.status) };
  const rows = data().sales.filter(s => s.status !== 'Draft').filter(groups[S.filter]).sort((a, b) => b.createdAt - a.createdAt);
  return `<div class="hello"><div><h2>Customer records</h2><p>Every sale, with its full audit trail, logged on ${esc(label())}.</p></div></div>
    <div class="chips">${Object.keys(groups).map(k => `<button class="chip-btn${S.filter === k ? ' on' : ''}" data-filter="${k}">${k}</button>`).join('')}</div>
    <section class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quote</th><th>Customer</th><th>${S.ch === 'bank' ? 'Loan' : 'Purchase'}</th><th>Products</th><th>Total</th><th>Status</th><th>Created</th><th></th></tr></thead>
      <tbody>${rows.map(s => `<tr class="click" data-record="${esc(s.ref)}"><td data-l="Quote" class="mono">${esc(s.ref)}</td><td data-l="Customer"><b>${esc(s.customer.name)}</b></td><td data-l="${S.ch === 'bank' ? 'Loan' : 'Purchase'}">${esc(s.subject)}<small>${esc(s.subjectDetail || '')}</small></td>
        <td data-l="Products">${esc(s.quote.items.map(x => x.name).join(', ') || '–')}</td><td data-l="Total">${s.quote.total ? inr(s.quote.total) : '–'}</td><td data-l="Status">${pill(s.status)}</td><td data-l="Created">${esc(when(s.createdAt))}</td><td class="act"><i class="ph-bold ph-caret-right"></i></td></tr>`).join('') || '<tr><td colspan="8" class="muted">No records yet.</td></tr>'}</tbody></table></div></section>`;
}
function timeline(s) {
  const ev = (s.audit || []).slice().sort((a, b) => a.at - b.at), L = stageLabels();
  return `<div class="timeline">${Object.keys(L).map(stg => ({ stg, items: ev.filter(e => e.stage === stg) })).filter(g => g.items.length).map(g => `<section><h4><i class="ph-bold ${STAGE_ICON[g.stg]}"></i>${L[g.stg]}</h4>${g.items.map(e => `
    <div class="ev"><span class="t">${esc(when(e.at))}</span><div><b>${esc(e.text)}</b>${e.detail ? `<small>${esc(e.detail)}</small>` : ''}<em>${esc(e.actor)}</em></div></div>`).join('')}</section>`).join('')}</div>`;
}
function vRecord() {
  const s = getSale(S.recordRef, S.ch);
  if (!s) return '<p>Record not found.</p>';
  const rs = s.responses || {}, pitched = Object.keys(rs).length, interested = Object.values(rs).filter(v => v === 'interested').length;
  const cell = (k, v) => `<div><small>${k}</small><b>${v}</b></div>`;
  return `<div class="hello"><div><button class="linkbtn" data-nav="records"><i class="ph-bold ph-arrow-left"></i> Customer records</button><h2>${esc(s.customer.name)}</h2><p><span class="mono">${esc(s.ref)}</span> · ${pill(s.status)}</p></div><button class="btn secondary" data-act="download"><i class="ph-bold ph-download-simple"></i> Download record</button></div>
    <div class="rec-grid"><section class="card"><div class="summary">
      ${cell('Agent', esc(label()))}${cell(S.ch === 'bank' ? 'Branch' : 'Store', esc(C().org + ' · ' + C().agent.branch))}
      ${cell(S.ch === 'bank' ? 'Loan' : 'Purchase', `${esc(s.subject)} · ${esc(s.subjectDetail || '')}`)}${cell('Source', esc(s.sourceId || '–'))}
      ${s.questions ? cell('Questions answered', `${s.questions.answered} of ${s.questions.total}`) : ''}${s.recommended ? cell('Recommended', String(s.recommended.length)) : ''}
      ${pitched ? cell('Pitched → interested', `${pitched} → ${interested}`) : ''}${cell(s.status === 'Purchased' ? 'Bought' : 'Quote', s.quote.total ? `${s.status === 'Purchased' ? s.quote.items.length + ' · ' : ''}${inr(s.quote.total)}` : '–')}
    </div></section>
    <section class="card"><div class="card-h"><h3>Audit trail</h3></div>${timeline(s)}</section></div>`;
}

/* ── journey ─────────────────────────── */
function stepper() {
  const i = STEPS.indexOf(S.step === 'computing' ? 'recs' : S.step);
  return `<ol class="stepper">${stepNames().map((n, k) => `<li class="${k < i ? 'done' : k === i ? 'cur' : ''}"><span>${k < i ? '<i class="ph-bold ph-check"></i>' : k + 1}</span><b>${n}</b></li>`).join('')}</ol>`;
}
/* Everything already known about the customer, in one strip. Nothing to re-type. */
function summaryStrip() {
  const s = S.sale;
  const facts = S.ch === 'bank' ? E().facts(s) : [['Product', `${s.customer.brand} ${s.customer.model}`], ['Invoice', inr(s.customer.assetCost)], ['Loan', `${inr(s.customer.loanAmount)} · ${s.customer.tenure} months`], ['Age', s.customer.age], ['City', s.customer.city]];
  return `<div class="sum"><div class="sum-h"><span class="ini big">${esc(initials(s.customer.name))}</span><div><b>${esc(s.customer.name)}</b><small><span class="mono">${esc(s.sourceId)}</span> · ${esc(s.subject)}</small></div>
      ${S.ch === 'bank' ? '<span class="kyc-ok"><i class="ph-fill ph-check-circle"></i> KYC verified</span>' : `<button class="linkbtn" data-act="edit"><i class="ph-bold ph-pencil-simple"></i> ${S.editing ? 'Done' : 'Edit'}</button>`}</div>
    <div class="sum-f">${facts.map(([k, v]) => `<span><small>${k}</small>${esc(v)}</span>`).join('')}</div>${S.ch === 'store' && S.editing ? editForm() : ''}</div>`;
}
function editForm() {
  const c = S.sale.customer;
  const opt = ew.assets.map(a => `<option value="${esc(a.id)}"${a.id === c.assetId ? ' selected' : ''}>${esc(a.name)}</option>`).join('');
  const f = (name, lbl, val, extra = '') => `<label class="f"><span>${lbl}</span><input name="${name}" value="${esc(val)}" ${extra}></label>`;
  return `<form id="cust" class="edit" novalidate><div class="fgrid">
      ${f('name', 'Full name', c.name)}${f('mobile', 'Mobile', c.mobile, 'inputmode="numeric" maxlength="10"')}${f('age', 'Age', c.age, 'inputmode="numeric" maxlength="2"')}
      ${f('email', 'Email', c.email, 'type="email"')}${f('city', 'City', c.city)}${f('pincode', 'PIN code', c.pincode, 'inputmode="numeric" maxlength="6"')}
      <label class="f"><span>Product</span><select name="assetId">${opt}</select></label>${f('brand', 'Brand', c.brand)}${f('model', 'Model', c.model)}
      ${f('assetCost', 'Invoice value (₹)', c.assetCost, 'inputmode="numeric"')}${f('loanAmount', 'Loan amount (₹)', c.loanAmount, 'inputmode="numeric"')}${f('tenure', 'Tenure (months)', c.tenure, 'inputmode="numeric"')}</div>
      ${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}</form>`;
}
function jNeeds() {
  const qs = E().questions(S.sale), first = firstName(S.sale.customer.name), n = qs.filter(q => S.sale.answers[q.id]).length;
  return `${summaryStrip()}
    <div class="qh"><h3>Ask ${esc(first)}</h3><span>${n} of ${qs.length} answered · tap an answer, tap again to clear</span></div>
    <ol class="qlist">${qs.map((q, i) => { const cur = S.sale.answers[q.id]; return `<li class="${cur ? 'done' : ''}"><span class="qn">${cur ? '<i class="ph-bold ph-check"></i>' : i + 1}</span><p>${esc(q.title)}</p>
      <div class="qo">${q.options.map(o => `<button class="${cur === o ? 'on' : ''}" data-ans="${esc(o)}" data-qid="${q.id}">${esc(o)}</button>`).join('')}</div></li>`; }).join('')}</ol>`;
}
function jComputing() {
  const first = firstName(S.sale.customer.name);
  const steps = [`Reading ${S.sale.questions?.answered ?? 0} answers`, `Checking ${S.assessed.length} products`, 'Matching needs to cover', 'Running suitability guardrails'];
  return `<div class="computing"><div class="cmp-mark"><img src="./assets/symbo-mark.png" alt=""><span class="ring"></span></div><h2>Finding the right cover for ${esc(first)}</h2>
    <ul class="cmp-steps">${steps.map((s, i) => `<li style="animation-delay:${i * 320}ms"><i class="ph-bold ph-check-circle"></i>${esc(s)}</li>`).join('')}</ul></div>`;
}
function jRecs() {
  const first = firstName(S.sale.customer.name), list = ranked(), icons = E().icons;
  const others = S.assessed.filter(p => !(p.recommended && p.eligible && !p.disabled));
  const card = ({ p, sig }, i) => {
    const raw = S.assessed.find(x => x.id === p.id), k = E().pitch(S.sale, p), st = S.sale.responses[p.id] || '';
    const vsel = raw.variants?.length > 1 ? `<select class="vsel" data-variant="${p.id}" aria-label="${esc(p.name)} variant">${raw.variants.map(v => `<option${v.name === p.variant ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : (p.variant ? `<span class="vfix">${esc(p.variant)}</span>` : '');
    return `<article class="rc ${st}" style="animation-delay:${i * 90}ms">
      <div class="rc-h"><span class="r-ico"><i class="ph-bold ${icons[p.id]}"></i></span><div class="r-t"><b>${esc(p.name)}</b>${vsel}</div><div class="rc-p"><b>${inr(p.price)}</b><em class="fit">${sig >= 2 ? 'Strong fit' : 'Good fit'}</em></div></div>
      <div class="tagrow">${E().tags(S.sale, p.id).map(t => `<span><i class="ph-bold ph-check"></i>${esc(t)}</span>`).join('')}</div>
      <p class="line"><i class="ph-bold ph-megaphone-simple"></i>${esc(k.headline)}</p>
      <details class="script"><summary>Pitch points</summary><ul>${k.points.map(x => `<li>${esc(x)}</li>`).join('')}<li class="warn"><b>Be clear:</b> ${esc(k.limits)}</li><li class="obj"><b>${esc(k.objection[0])}</b> ${esc(k.objection[1])}</li></ul></details>
      <div class="rc-a"><button class="tog no${st === 'not_now' ? ' on' : ''}" data-resp="not_now" data-id="${p.id}">Not now</button><button class="tog yes${st === 'interested' ? ' on' : ''}" data-resp="interested" data-id="${p.id}"><i class="ph-bold ph-check"></i> Interested</button></div></article>`;
  };
  const nots = others.length ? `<div class="nots2"><small>Not suggested</small>${others.map(p => `<span class="${p.disabled ? 'locked' : ''}" title="${esc(p.reason)}">${p.disabled ? '<i class="ph-bold ph-lock-simple"></i>' : ''}${esc(p.name)}${p.disabled ? ' · not enabled' : ''}</span>`).join('')}</div>` : '';
  if (!list.length) return `<div class="jh"><h2>Nothing fits ${esc(first)} today</h2><p>No answer points to a product, so there is nothing to pitch.</p></div>${nots}`;
  return `<div class="qh"><h3>${list.length} fit ${esc(first)}</h3><span>Mark each one as you pitch it</span></div><div class="rc-list">${list.map(card).join('')}</div>${nots}`;
}
function jShare() {
  const s = S.sale, first = firstName(s.customer.name), icons = E().icons;
  const msg = waMessage(s), link = buyLink(s);
  const bubble = esc(msg).replace(esc(link), `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(link.length > 60 ? link.slice(0, 58) + '…' : link)}</a>`).replace(/\n/g, '<br>');
  return `<div class="qh"><h3>Quote ready for ${esc(first)}</h3><span>${esc(first)} reviews and consents on their own phone</span></div>
    <div class="share-grid"><div>
      <div class="quote"><div class="q-top"><span class="mono">${esc(s.ref)}</span>${pill(s.status)}</div>
        ${s.quote.items.map(x => `<div class="q-row"><i class="ph-bold ${icons[x.id]}"></i><span>${esc(x.name)}${x.variant ? ` <small>${esc(x.variant)}</small>` : ''}</span><b>${inr(x.price)}</b></div>`).join('')}
        <div class="q-total"><span>Total · GST included</span><b>${inr(s.quote.total)}</b></div></div>
      <div class="share-btns">
        <button class="btn wa-btn" data-act="wa"><i class="ph-fill ph-whatsapp-logo"></i> Share on WhatsApp</button>
        <div class="two"><button class="btn secondary" data-act="copy-msg"><i class="ph-bold ph-copy"></i> Copy message</button><button class="btn secondary" data-act="copy-link"><i class="ph-bold ph-link"></i> Copy link</button></div>
        <a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener" data-act="open-link"><i class="ph-bold ph-arrow-square-out"></i> Open customer link</a>
      </div></div>
      <div><p class="eyebrow">WhatsApp preview</p><div class="wa"><div class="wa-head"><span class="wa-av">${esc(first[0])}</span><b>${esc(s.customer.name)}</b></div><div class="wa-body"><div class="bubble">${bubble}<span class="wa-time">${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} <i class="ph-bold ph-checks"></i></span></div></div></div></div>
    </div>`;
}
function jActions() {
  switch (S.step) {
    case 'needs': { const n = Object.keys(S.sale.answers).length; return `<button class="btn${n ? '' : ' secondary'}" data-act="compute"><i class="ph-bold ph-sparkle"></i> Get recommendations${n ? ` · ${n} answered` : ''}</button>`; }
    case 'computing': return `<p class="caption">Checking every product against the answers…</p>`;
    case 'recs': {
      const yes = ranked().filter(x => S.sale.responses[x.p.id] === 'interested'), tot = yes.reduce((n, x) => n + Math.round(x.p.price), 0);
      return `<div class="two"><button class="btn secondary" data-act="quote-none">Nothing taken</button><button class="btn" data-act="quote" ${yes.length ? '' : 'disabled'}>${yes.length ? `Create quote · ${yes.length} · ${inr(tot)}` : 'Mark what interests them'}</button></div>`;
    }
    case 'share': return `<div class="two"><button class="btn secondary" data-act="record-cur">Customer record</button><button class="btn" data-act="done">Done</button></div>`;
  }
  return '';
}
function recordPanel() {
  const s = S.sale && (getSale(S.sale.ref, S.ch) || S.sale);
  if (!s) return '';
  const rs = S.sale.responses || s.responses || {};
  const done = { Customer: true, Needs: Object.keys(S.sale.answers || {}).length > 0, Recommendation: !!s.recommended, Share: ['Quote shared', 'Viewed', 'Purchased'].includes(s.status), Purchase: s.status === 'Purchased' };
  const L = { Customer: stageLabels().Customer, Needs: `${Object.keys(S.sale.answers || {}).length} answers`, Recommendation: s.recommended ? `${s.recommended.length} recommended · ${Object.values(rs).filter(v => v === 'interested').length} interested` : 'Recommendation',
    Share: 'Quote shared', Purchase: s.status === 'Purchased' ? `Bought · ${inr(s.quote.total)}` : 'Customer purchase' };
  const ev = (S.sale.audit || s.audit || []).slice().sort((a, b) => b.at - a.at).slice(0, 8);
  return `<div class="jr-h"><p class="eyebrow">Customer record</p><h3>${esc(s.customer.name)}</h3><p class="muted small"><span class="mono">${esc(s.ref)}</span> · logged on ${esc(C().agent.name)}</p></div>
    <ul class="stages">${Object.keys(done).map(k => `<li class="${done[k] ? 'ok' : ''}"><i class="ph-bold ${done[k] ? 'ph-check-circle' : 'ph-circle'}"></i>${esc(L[k])}</li>`).join('')}</ul>
    <ol class="feed">${ev.map(e => `<li><i class="ph-bold ${STAGE_ICON[e.stage] || 'ph-dot'}"></i><div><b>${esc(e.text)}</b><small>${e.detail ? esc(e.detail) + ' · ' : ''}${esc(when(e.at))}</small></div></li>`).join('')}</ol>`;
}
function renderRecordPanel() { const el = $('#jrec'); if (el) el.innerHTML = recordPanel(); const m = $('#jrec-m-body'); if (m) m.innerHTML = recordPanel(); }
function vJourney() {
  const body = { needs: jNeeds, computing: jComputing, recs: jRecs, share: jShare }[S.step]();
  return `${stepper()}<div class="jgrid"><section class="card jmain" data-step="${S.step}">${body}<div class="actions">${jActions()}</div></section>
    <aside class="card jrec" id="jrec">${recordPanel()}</aside>
    <details class="card jrec-m"><summary><i class="ph-bold ph-clipboard-text"></i> Customer record</summary><div id="jrec-m-body">${recordPanel()}</div></details></div>`;
}

/* ── shell ─────────────────────────────── */
function shell(body) {
  const a = C().agent, sellLabel = S.ch === 'bank' ? 'Loan protection' : 'Consumer durable protection';
  const nav = (id, icon, text, active) => `<button class="nv${active ? ' on' : ''}" data-nav="${id}"><i class="ph-bold ${icon}"></i><span>${text}</span></button>`;
  const title = S.view === 'journey' ? `${S.sale.customer.name}` : S.view === 'records' ? 'Customer records' : S.view === 'record' ? 'Customer record' : 'Dashboard';
  const crumb = S.view === 'journey' ? (S.ch === 'bank' ? `Loan protection · ${S.sale.loan.id}` : `Protection sale · ${S.sale.sourceId}`) : C().org;
  return `<div class="portal${S.collapsed ? ' collapsed' : ''}${S.navOpen ? ' nav-open' : ''}">
    <aside class="sidebar"><div class="sb-brand">${orgLogo(S.ch, 34)}<div><b>${esc(C().org)}</b><small>Agent portal</small></div></div>
      <nav>${nav('home', 'ph-squares-four', 'Dashboard', S.view === 'home')}${nav('records', 'ph-folder-user', 'Customer records', S.view === 'records' || S.view === 'record')}
        <p class="sb-sec">Sell</p>${nav('home', 'ph-shield-plus', sellLabel, S.view === 'journey')}
        <p class="sb-sec">Retail insurance</p>${RETAIL[S.ch].map(([n, i]) => `<div class="nv soon" aria-disabled="true"><i class="ph-bold ${i}"></i><span>${n}</span><em>Soon</em></div>`).join('')}</nav>
      <div class="sb-foot"><button class="nv" data-act="logout"><i class="ph-bold ph-sign-out"></i><span>Sign out</span></button><span class="pw light">Powered by <img src="./assets/symbo-logo.png" alt="Symbo"></span></div></aside>
    <div class="scrim" data-act="nav-close"></div>
    <div class="main"><header class="topbar"><button class="icon-btn" data-act="nav" aria-label="Menu"><i class="ph-bold ph-list"></i></button>
      <div class="tb-t"><small>${esc(crumb)}</small><b>${esc(title)}</b></div>
      <button class="icon-btn bell" aria-label="Notifications"><i class="ph-bold ph-bell"></i></button>
      <div class="me"><span class="avatar">${esc(initials(a.name))}</span><div><b>${esc(a.name)}</b><small>${esc(a.role)} · ${esc(a.id)}</small></div></div></header>
      <main class="content">${body}</main></div></div>`;
}
function render() {
  const root = $('#root');
  document.body.dataset.view = S.view;
  document.body.dataset.symboMenuBottom = S.view === 'journey' && mobile() ? '84' : '';
  if (S.view === 'login' || !S.ch) { root.innerHTML = vLogin(); return; }
  const body = S.view === 'journey' ? vJourney() : S.view === 'records' ? vRecords() : S.view === 'record' ? vRecord() : (S.ch === 'bank' ? vHomeBank() : vHomeStore());
  root.innerHTML = shell(body);
}

/* ── events ─────────────────────────────── */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-ans],[data-resp],[data-record],[data-nav],[data-inv],[data-loan],[data-org],[data-filter]');
  if (!t || t.closest('[aria-disabled="true"]')) return;
  const d = t.dataset;
  if (d.org) { S.loginOrg = d.org; return render(); }
  if (d.nav) { S.sale = null; return go(d.nav); }
  if (d.inv) return startFrom(INVOICES.find(x => x.inv === d.inv));
  if (d.loan) return startFrom(findLoan(d.loan));
  if (d.record) { S.recordRef = d.record; S.sale = null; return go('record'); }
  if (d.filter) { S.filter = d.filter; return render(); }
  if (d.ans) return answer(d.qid, d.ans);
  if (d.resp) return setResponse(d.id, d.resp);
  switch (d.act) {
    case 'nav': if (mobile()) S.navOpen = !S.navOpen; else S.collapsed = !S.collapsed; return render();
    case 'nav-close': S.navOpen = false; return render();
    case 'logout': return signOut();
    case 'edit': if (S.editing) readCustomer(); S.editing = !S.editing; S.err = ''; return render();
    case 'compute': return compute();
    case 'quote': return createQuote();
    case 'quote-none': return createQuote(S.sale.responses = {});
    case 'done': S.sale = null; return go('home');
    case 'record-cur': S.recordRef = S.sale.ref; S.sale = null; return go('record');
    case 'wa': markShared('WhatsApp'); window.open('https://wa.me/?text=' + encodeURIComponent(waMessage(S.sale)), '_blank', 'noopener'); return;
    case 'copy-msg': if (await copy(waMessage(S.sale))) { markShared('message copied'); toast('Message copied. Paste it into WhatsApp.'); } else toast('Copy failed. Select the text instead.'); return;
    case 'copy-link': if (await copy(buyLink(S.sale))) { markShared('link copied'); toast('Buy link copied.'); } return;
    case 'open-link': markShared('customer link opened'); return;
    case 'download': return download();
  }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target.getAttribute('id');   /* not .id: a field named "id" would shadow it */
  if (form === 'login') return signIn(S.loginOrg);
  if (form === 'loan-search') {
    S.search = String(new FormData(e.target).get('q') || '').trim();
    S.found = findLoan(S.search); S.err = S.found ? '' : `No sanctioned loan with ID ${S.search}.`;
    render(); const f = $('.found') || $('.search-card .err'); if (f) f.scrollIntoView({ block: 'nearest' });
  }
});
document.addEventListener('change', e => {
  const sel = e.target.closest('[data-variant]');
  if (sel) {
    const id = sel.dataset.variant, before = S.picks[id];
    S.picks[id] = sel.value;
    const p = S.assessed.find(x => x.id === id);
    log(S.sale, label(), 'Recommendation', `Changed ${p.name} from ${before} to ${sel.value}`, inr(chosen(p).price));
    persist(); render();
  }
  if (e.target.closest('#cust')) readCustomer();
});
function download() {
  const s = getSale(S.recordRef, S.ch);
  const lines = [`${C().org.toUpperCase()} · CUSTOMER RECORD`, `Quote ${s.ref} · status ${s.status}`, `Agent: ${label()} · ${C().agent.branch}`, `Customer: ${s.customer.name} · ${s.subject} · ${s.subjectDetail || ''}`, `Source: ${s.sourceId || '-'}`, '',
    ...(s.audit || []).slice().sort((a, b) => a.at - b.at).map(e => `${stamp(e.at)} | ${e.stage} | ${e.actor} | ${e.text}${e.detail ? ' | ' + e.detail : ''}`)];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  a.download = `record-${s.ref}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ── live updates: another tab of this browser (storage) or another device (sync poll) ── */
function refresh(bought = []) {
  if (!S.ch) return;
  const before = S.sale ? S.sale.status : null;
  S.data = load(S.ch, SEEDS[S.ch]);
  if (S.sale) {
    const fresh = getSale(S.sale.ref, S.ch);
    if (fresh && (OPEN.includes(S.sale.status) || fresh.status === 'Purchased')) Object.assign(S.sale, { status: fresh.status, audit: fresh.audit, purchasedAt: fresh.purchasedAt, quote: fresh.quote, offered: fresh.offered });
    if (before !== 'Purchased' && S.sale.status === 'Purchased' && !bought.includes(S.sale)) bought = [...bought, S.sale];
  }
  for (const s of bought) toast(`${firstName(s.customer.name)} just bought ${s.quote.items.length} product${s.quote.items.length > 1 ? 's' : ''} · ${inr(s.quote.total)}`);
  if (S.view !== 'journey' || S.step === 'share') render(); else renderRecordPanel();
}
window.addEventListener('storage', e => { if (S.ch && e.key === CHANNELS[S.ch].key) refresh(); });
let syncing = false;
async function sync() {
  if (!S.ch || syncing || document.visibilityState === 'hidden') return;
  const open = data().sales.filter(s => !s.seed && OPEN.includes(s.status) && Date.now() - s.createdAt < 3 * 864e5);
  if (!open.length) return;
  syncing = true;
  try {
    const remote = await fetchStatus(open.map(s => s.ref));
    if (!remote) return;
    const bought = []; let changed = false;
    for (const s of open) {
      const d = remote[s.ref]; if (!d) continue;
      let touched = false;
      const have = new Set((s.audit || []).map(e => e.id).filter(Boolean));
      for (const e of d.events || []) if (!have.has(e.id)) { (s.audit ||= []).push({ at: e.at, actor: 'Customer', stage: e.stage, text: e.text, detail: e.detail || '', id: e.id }); touched = true; }
      if (d.status === 'Purchased' && s.status !== 'Purchased') {
        s.status = 'Purchased'; s.purchasedAt = d.purchasedAt; s.offered = s.offered || s.quote.items;
        s.quote = { ...s.quote, items: (d.items || []).map(x => ({ id: x.id, name: E().info(x.id).name, variant: x.variant, price: x.price })), total: d.total };
        bought.push(s); touched = true;
      } else if (d.status === 'Viewed' && (s.status === 'Quote ready' || s.status === 'Quote shared')) { s.status = 'Viewed'; touched = true; }
      if (touched) { saveSale(s); changed = true; }
    }
    if (changed) refresh(bought);
  } finally { syncing = false; }
}
setInterval(sync, 4000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
addEventListener('resize', () => { if (!mobile() && S.navOpen) { S.navOpen = false; render(); } });

/* boot: stay signed in for this tab */
try { const ch = sessionStorage.getItem(SESSION); if (CHANNELS[ch]) { S.ch = ch; S.view = 'home'; } } catch { /* ignore */ }
render();

/* Agent Journey · Rohan's agent app (consumer durable protection). Fictional data, browser-local. */
import { ew, initialMasters, relevantQuestions, validateApplication, assess } from './catalogue.js';
import { AGENT, AGENT_LABEL, esc, inr, firstName, when, stamp, load, resetAll, saveSale, getSale, log, newRef, encodeQuote, stats, STORAGE_KEY } from './store.js';
import { ICONS, signals, pitchFor, RETAIL } from './pitch.js';

const M = initialMasters;
const $ = s => document.querySelector(s);
const FIXED = { warrantyYears: 1, purchaseDays: 0, usage: 'home', condition: 'new' };
const STEPS = ['customer', 'needs', 'recs', 'pitch', 'share'];
const STAGE_ICON = { Customer: 'ph-user', Needs: 'ph-chats-circle', Recommendation: 'ph-sparkle', Pitch: 'ph-megaphone-simple', Share: 'ph-whatsapp-logo', Consent: 'ph-signature', Purchase: 'ph-seal-check' };
const STAGE_LABEL = { Customer: 'Customer & purchase', Needs: 'Needs conversation', Recommendation: 'Symbo recommendation', Pitch: 'Pitch', Share: 'Quote & sharing', Consent: 'Customer review & consent', Purchase: 'Purchase' };

const S = { view: 'dash', sale: null, qi: 0, assessed: [], picks: {}, pi: 0, auditRef: null, data: load(), err: '' };

/* ── helpers ─────────────────────────────── */
const app = () => ({ ...S.sale.customer, ...FIXED, answers: S.sale.answers });
const assetName = id => (ew.assets.find(a => a.id === id) || {}).name || 'device';
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const pill = st => `<span class="pill st-${st.toLowerCase().replace(/\s+/g, '-')}">${esc(st)}</span>`;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
function persist() { if (S.sale) saveSale(S.sale); S.data = load(); }
function go(view) { S.view = view; S.err = ''; render(); const sc = $('.scroll'); if (sc) sc.scrollTop = 0; }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove(); return ok;
  }
}
function chosen(p) {
  const v = p.variants?.length ? p.variants.find(x => x.name === S.picks[p.id]) : null;
  return v ? { ...p, variant: v.name, price: v.price } : p;
}
function ranked() {
  const first = firstName(S.sale.customer.name);
  return S.assessed.filter(p => p.recommended)
    .map(p => ({ p: chosen(p), sig: signals(p.id, S.sale.answers, first).length }))
    .sort((a, b) => b.sig - a.sig);
}

/* ── sale lifecycle ─────────────────────── */
function startSale() {
  S.sale = {
    ref: newRef(), createdAt: Date.now(), status: 'Draft', assetName: 'LED TV', answers: {}, responses: {}, audit: [],
    customer: { name: 'Amit Verma', mobile: '9876543210', email: 'amit.verma@example.com', age: 34, city: 'Mumbai', state: 'Maharashtra', pincode: '400053', assetId: 'led-tv', brand: 'Sony', model: 'Bravia 55" 4K', assetCost: 64990, loanAmount: 52000, tenure: 12 },
    quote: { items: [], total: 0, expiresAt: 0 }
  };
  S.qi = 0; S.assessed = []; S.picks = {}; S.pi = 0;
  go('customer');
}
function readCustomer() {
  const f = new FormData($('#cust'));
  const c = S.sale.customer;
  for (const k of ['name', 'mobile', 'email', 'city', 'state', 'pincode', 'assetId', 'brand', 'model']) c[k] = String(f.get(k) || '').trim();
  for (const k of ['age', 'assetCost', 'loanAmount', 'tenure']) c[k] = Number(String(f.get(k) || '').replace(/[^\d.]/g, ''));
  S.sale.assetName = assetName(c.assetId);
}
function submitCustomer() {
  readCustomer();
  try { validateApplication({ ...app(), answers: {} }); } catch (e) { S.err = e.message; return render(); }
  const c = S.sale.customer;
  log(S.sale, AGENT_LABEL, 'Customer', `Captured customer and purchase for ${c.name}`, `${S.sale.assetName} · ${c.brand} ${c.model} · ${inr(c.assetCost)} · loan ${inr(c.loanAmount)} over ${c.tenure} months`);
  persist();
  S.qi = 0; go('needs');
}
function answer(id, value) {
  const prev = S.sale.answers[id];
  if (value === null) delete S.sale.answers[id]; else S.sale.answers[id] = value;
  if (id === 'health' && (value === 'None' || value === null)) delete S.sale.answers.members;
  if (prev !== value) {
    const q = relevantQuestions({ ...app() }).find(x => x.id === id) || { title: id };
    log(S.sale, AGENT_LABEL, 'Needs', value === null ? `Skipped: ${q.title}` : `Asked: ${q.title}`, value === null ? '' : `Answer: ${value}`);
  }
  const qs = relevantQuestions(app());
  if (S.qi < qs.length - 1) { S.qi++; render(); } else compute();
}
function compute() {
  const qs = relevantQuestions(app());
  const answered = qs.filter(q => S.sale.answers[q.id]).length;
  S.assessed = assess(app(), M);
  S.picks = {};
  for (const p of S.assessed) if (p.variants?.length) S.picks[p.id] = p.variant || p.variants[0].name;
  const rec = S.assessed.filter(p => p.recommended);
  S.sale.questions = { answered, total: qs.length };
  S.sale.recommended = rec.map(p => p.id);
  log(S.sale, 'Symbo', 'Recommendation', `Ruleset ${AGENT.ruleset}: ${rec.length} of ${S.assessed.length} products recommended`, rec.map(p => `${p.name}${p.variant ? ' (' + p.variant + ')' : ''}`).join(', ') || 'None');
  for (const p of S.assessed.filter(p => !p.recommended)) log(S.sale, 'Symbo', 'Recommendation', `Not recommended: ${p.name}`, p.reason);
  persist();
  go('computing');
  setTimeout(() => { if (S.view === 'computing') go('recs'); }, 3400);
}
function respond(kind) {
  const list = ranked();
  const { p } = list[S.pi];
  S.sale.responses[p.id] = kind;
  log(S.sale, AGENT_LABEL, 'Pitch', kind === 'interested' ? `Pitched ${p.name}: customer interested` : `Pitched ${p.name}: not now`, `${p.variant ? p.variant + ' · ' : ''}${inr(p.price)}`);
  if (S.pi < list.length - 1) { S.pi++; persist(); return go('pitch'); }
  const items = list.filter(x => S.sale.responses[x.p.id] === 'interested').map(x => ({ id: x.p.id, name: x.p.name, variant: x.p.variant || '', price: Math.round(x.p.price) }));
  if (!items.length) {
    S.sale.status = 'Not taken';
    log(S.sale, AGENT_LABEL, 'Pitch', 'Customer chose not to take any product now');
    persist(); toast('Sale closed. Logged on Rohan\'s record.'); return go('dash');
  }
  S.sale.quote = { items, total: items.reduce((n, x) => n + x.price, 0), expiresAt: Date.now() + 48 * 3600e3 };
  S.sale.status = 'Quote ready';
  log(S.sale, 'Symbo', 'Share', `Quote ${S.sale.ref} prepared`, `${items.map(x => x.name).join(', ')} · ${inr(S.sale.quote.total)}`);
  persist(); go('share');
}
function buyLink(sale) { const u = new URL('buy.html', location.href); u.hash = 'q=' + encodeQuote(sale); return u.toString(); }
function waMessage(sale) {
  const c = sale.customer;
  const lines = sale.quote.items.map(x => `• ${x.name}${x.variant ? ' · ' + x.variant : ''}: ${inr(x.price)}`);
  return `Hi ${firstName(c.name)}, this is ${AGENT.name} from ${AGENT.partner} at ${AGENT.store}.\n\nAs discussed, here is your protection quote for your ${c.brand} ${c.model} (${sale.assetName}):\n${lines.join('\n')}\nTotal: ${inr(sale.quote.total)} (GST included)\n\nReview and buy here: ${buyLink(sale)}\n\nQuote ${sale.ref} · valid for 48 hours`;
}
function markShared(channel) {
  if (S.sale.status === 'Quote ready') S.sale.status = 'Quote shared';
  log(S.sale, AGENT_LABEL, 'Share', `Quote ${S.sale.ref} shared (${channel})`, inr(S.sale.quote.total));
  persist(); renderRecord();
  const badge = document.querySelector('.q-top .pill'); if (badge) badge.outerHTML = pill(S.sale.status);
}

/* ── views ─────────────────────────────── */
function vDash() {
  const st = stats(S.data.sales);
  const pct = Math.min(100, Math.round(st.policies / st.target * 100));
  const recent = S.data.sales.filter(s => s.status !== 'Draft').slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  return `
  <section class="hero-card">
    <div class="hc-top"><div><p class="eyebrow light">${greet()}</p><h2>${esc(AGENT.name)}</h2><p class="hc-sub">${esc(AGENT.store)}<br><span class="mono">Agent ID ${esc(AGENT.id)}</span></p></div><span class="avatar">R</span></div>
    <div class="hc-stats">
      <div><b>${st.todayPolicies}</b><span>Policies today</span></div>
      <div><b>${inr(st.todayPremium)}</b><span>Premium today</span></div>
      <div><b>${st.conversion}%</b><span>Conversion</span></div>
    </div>
    <div class="target"><div class="tl"><span>${st.policies} of ${st.target} policies · last 30 days</span><span>${pct}%</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
  </section>
  <div class="kpis">
    <div class="kpi"><span>Premium · 30 days</span><b>${inr(st.premium)}</b></div>
    <div class="kpi"><span>Quotes awaiting customer</span><b>${st.open}</b></div>
  </div>
  <h3 class="sec">Sell with a loan <span class="tag green">Live</span></h3>
  <button class="product-hero" data-act="new">
    <span class="ph-ico"><i class="ph-bold ph-television-simple"></i></span>
    <span class="ph-t"><b>Consumer durable protection</b><small>Warranty, device, health and home cover with the purchase</small></span>
    <i class="ph-bold ph-arrow-right"></i>
  </button>
  <h3 class="sec">Sell retail insurance <span class="tag">Coming soon</span></h3>
  <div class="retail">${RETAIL.map(r => `<div class="rt" aria-disabled="true" title="Coming soon"><i class="ph-bold ${r.icon}"></i><b>${esc(r.name)}</b><small>${esc(r.sub)}</small><span class="soon">Soon</span></div>`).join('')}</div>
  <h3 class="sec">Recent sales <span class="muted small">Tap for the audit trail</span></h3>
  <div class="list">${recent.map(s => `
    <button class="row" data-audit="${esc(s.ref)}">
      <span class="ini">${esc(firstName(s.customer.name)[0] || '?')}</span>
      <span class="rt-main"><b>${esc(s.customer.name)}</b><small>${esc(s.assetName)} · ${s.quote.items.length} product${s.quote.items.length === 1 ? '' : 's'} · ${esc(when(s.createdAt))}</small></span>
      <span class="rt-end"><b>${s.quote.total ? inr(s.quote.total) : '–'}</b>${pill(s.status)}</span>
    </button>`).join('')}</div>`;
}

function vCustomer() {
  const c = S.sale.customer;
  const opt = ew.assets.map(a => `<option value="${esc(a.id)}"${a.id === c.assetId ? ' selected' : ''}>${esc(a.name)}</option>`).join('');
  const f = (name, label, val, extra = '', full = false) => `<label class="f${full ? ' full' : ''}"><span>${label}</span><input name="${name}" value="${esc(val)}" ${extra}></label>`;
  return `
  <p class="eyebrow">Step 1 of 5</p><h2 class="s-title">Customer & purchase</h2><p class="s-sub">From the loan application at the counter.</p>
  <form id="cust" class="stack" novalidate>
    <div class="card"><h3>Customer</h3><div class="fgrid">
      ${f('name', 'Full name', c.name, 'autocomplete="off"', true)}
      ${f('mobile', 'Mobile', c.mobile, 'inputmode="numeric" maxlength="10"')}
      ${f('age', 'Age', c.age, 'inputmode="numeric" maxlength="2"')}
      ${f('email', 'Email', c.email, 'type="email"', true)}
      ${f('city', 'City', c.city)}
      ${f('pincode', 'PIN code', c.pincode, 'inputmode="numeric" maxlength="6"')}
      <input type="hidden" name="state" value="${esc(c.state)}">
    </div></div>
    <div class="card"><h3>Purchase</h3><div class="fgrid">
      <label class="f full"><span>Product</span><select name="assetId">${opt}</select></label>
      ${f('brand', 'Brand', c.brand)}
      ${f('model', 'Model', c.model)}
      ${f('assetCost', 'Price (₹)', c.assetCost, 'inputmode="numeric"')}
      ${f('loanAmount', 'Loan amount (₹)', c.loanAmount, 'inputmode="numeric"')}
      ${f('tenure', 'Tenure (months)', c.tenure, 'inputmode="numeric"')}
    </div>
    <p class="fixed"><i class="ph-bold ph-info"></i> New · home use · bought today · 1-year manufacturer warranty</p></div>
    ${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}
  </form>`;
}

function vNeeds() {
  const qs = relevantQuestions(app());
  S.qi = Math.min(S.qi, qs.length - 1);
  const q = qs[S.qi];
  const first = firstName(S.sale.customer.name);
  const cur = S.sale.answers[q.id];
  return `
  <p class="eyebrow">Step 2 of 5 · Needs conversation</p>
  <div class="qdots">${qs.map((x, i) => `<button class="${i === S.qi ? 'cur' : S.sale.answers[x.id] ? 'done' : ''}" data-q="${i}" aria-label="Question ${i + 1}"></button>`).join('')}</div>
  <div class="ask" key="${q.id}">
    <div class="ask-top"><span class="ask-av"><i class="ph-bold ph-chat-teardrop-text"></i></span><span>Ask ${esc(first)} · ${S.qi + 1} of ${qs.length}</span></div>
    <p class="ask-q">“${esc(q.title)}”</p>
    <p class="ask-why"><i class="ph-bold ph-lightbulb"></i> ${esc(q.hint)}</p>
  </div>
  <div class="opts">${q.options.map(o => `<button class="opt${cur === o ? ' on' : ''}" data-ans="${esc(o)}" data-qid="${q.id}"><span>${esc(o)}</span><i class="ph-bold ph-check"></i></button>`).join('')}</div>
  <button class="skip" data-skip="${q.id}">Customer prefers not to say · skip</button>
  ${Object.keys(S.sale.answers).length ? `<div class="answered"><p class="eyebrow">Heard so far</p>${qs.filter(x => S.sale.answers[x.id]).map(x => `<span>${esc(x.id === 'members' ? 'Adults' : x.title.split(' ').slice(0, 5).join(' ') + '…')} <b>${esc(S.sale.answers[x.id])}</b></span>`).join('')}</div>` : ''}`;
}

function vComputing() {
  const c = S.sale.customer, first = firstName(c.name);
  const steps = [`Reading ${S.sale.questions?.answered ?? 0} answers from ${first}`, `Checking eligibility for ${S.assessed.length} products`, 'Matching stated needs to cover', `Pricing for ${S.sale.assetName} at ${inr(c.assetCost)}`, 'Running suitability guardrails'];
  return `<div class="computing">
    <div class="cmp-mark"><img src="./assets/symbo-mark.png" alt=""><span class="ring"></span></div>
    <h2>Finding the right cover for ${esc(first)}</h2>
    <ul class="cmp-steps">${steps.map((s, i) => `<li style="animation-delay:${i * 520}ms"><i class="ph-bold ph-check-circle"></i>${esc(s)}</li>`).join('')}</ul>
    <div class="skel"><i></i><i></i><i></i></div>
  </div>`;
}

function vRecs() {
  const first = firstName(S.sale.customer.name);
  const list = ranked();
  const others = S.assessed.filter(p => !p.recommended);
  const card = ({ p, sig }, i) => {
    const raw = S.assessed.find(x => x.id === p.id);
    const vsel = raw.variants?.length > 1 ? `<select class="vsel" data-variant="${p.id}" aria-label="${esc(p.name)} variant">${raw.variants.map(v => `<option${v.name === p.variant ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : (p.variant ? `<span class="vfix">${esc(p.variant)}</span>` : '');
    const why = signals(p.id, S.sale.answers, first);
    return `<article class="rec pop" style="animation-delay:${i * 220 + 100}ms">
      <div class="rec-h"><span class="rank">${i + 1}</span><span class="r-ico"><i class="ph-bold ${ICONS[p.id]}"></i></span><div class="r-t"><b>${esc(p.name)}</b><small>${esc(p.category)}</small></div><span class="fit">${sig >= 2 ? 'Strong fit' : 'Good fit'}</span></div>
      <ul class="why">${why.slice(0, 2).map(w => `<li><i class="ph-bold ph-check"></i>${esc(w)}</li>`).join('')}</ul>
      <div class="rec-f"><div>${vsel}</div><b class="price">${inr(p.price)}</b></div>
      <p class="matches"><i class="ph-bold ph-target"></i> Matches ${sig} of ${first}'s answer${sig === 1 ? '' : 's'} · pitch script ready</p>
    </article>`;
  };
  if (!list.length) return `<p class="eyebrow">Step 3 of 5</p><h2 class="s-title">Nothing fits ${esc(first)} today</h2><p class="s-sub">None of the answers point to a product, so there is nothing to pitch. That is logged as a suitable outcome.</p>${notSuggested(others, first)}`;
  return `<p class="eyebrow">Step 3 of 5 · Recommendations</p>
    <h2 class="s-title">${list.length} product${list.length > 1 ? 's' : ''} fit ${esc(first)}</h2>
    <p class="s-sub">Ranked by how many of ${esc(first)}'s answers each one meets. Pitch them one by one.</p>
    ${list.map(card).join('')}
    ${notSuggested(others, first)}`;
}
function notSuggested(others, first) {
  if (!others.length) return '';
  return `<details class="nots pop" style="animation-delay:900ms"><summary>Not suggested for ${esc(first)} (${others.length})</summary>
    ${others.map(p => `<div class="no"><i class="ph-bold ${ICONS[p.id]}"></i><div><b>${esc(p.name)}</b><small>${esc(p.reason)}</small></div></div>`).join('')}</details>`;
}

function vPitch() {
  const list = ranked();
  const { p } = list[S.pi];
  const c = S.sale.customer, first = firstName(c.name);
  const k = pitchFor({ first, assetName: S.sale.assetName, assetCost: c.assetCost, ans: S.sale.answers, p });
  return `<p class="eyebrow">Step 4 of 5 · Pitch ${S.pi + 1} of ${list.length}</p>
  <div class="pdots">${list.map((x, i) => `<i class="${i < S.pi ? (S.sale.responses[x.p.id] === 'interested' ? 'yes' : 'no') : i === S.pi ? 'cur' : ''}"></i>`).join('')}</div>
  <article class="pitch" key="${p.id}">
    <div class="p-head"><span class="r-ico big"><i class="ph-bold ${ICONS[p.id]}"></i></span><div><small>${esc(p.name)}${p.variant ? ' · ' + esc(p.variant) : ''}</small><h2>${esc(k.headline)}</h2></div></div>
    <div class="p-price"><b>${inr(p.price)}</b><span>${p.id === 'ew' ? 'one-time, GST included' : 'for one year'}</span></div>
    <section class="p-sec why-sec"><p class="eyebrow">Why Symbo chose this for ${esc(first)}</p><ul>${k.why.map(w => `<li><i class="ph-bold ph-check-circle"></i>${esc(w)}</li>`).join('')}</ul></section>
    <section class="p-sec say"><p class="eyebrow"><i class="ph-bold ph-microphone"></i> Say this</p><p>${esc(k.say)}</p></section>
    <section class="p-sec"><p class="eyebrow">Key points</p><ul class="pts">${k.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section class="p-sec limits"><p class="eyebrow"><i class="ph-bold ph-warning-circle"></i> Be clear about</p><p>${esc(k.limits)}</p></section>
    <section class="p-sec obj"><p class="eyebrow">If ${esc(first)} asks</p><p class="oq">${esc(k.objection[0])}</p><p class="oa">${esc(k.objection[1])}</p></section>
  </article>`;
}

function vShare() {
  const s = S.sale, first = firstName(s.customer.name);
  const msg = waMessage(s);
  const link = buyLink(s);
  const bubble = esc(msg).replace(esc(link), `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(link.length > 60 ? link.slice(0, 58) + '…' : link)}</a>`).replace(/\n/g, '<br>');
  return `<p class="eyebrow">Step 5 of 5 · Share</p><h2 class="s-title">Quote ready for ${esc(first)}</h2>
  <div class="card quote">
    <div class="q-top"><span class="mono">${esc(s.ref)}</span>${pill(s.status)}</div>
    ${s.quote.items.map(x => `<div class="q-row"><i class="ph-bold ${ICONS[x.id]}"></i><span>${esc(x.name)}${x.variant ? ` <small>${esc(x.variant)}</small>` : ''}</span><b>${inr(x.price)}</b></div>`).join('')}
    <div class="q-total"><span>Total · GST included</span><b>${inr(s.quote.total)}</b></div>
    <p class="muted small">Valid for 48 hours. ${esc(first)} reviews each product and gives consent on their own phone.</p>
  </div>
  <p class="eyebrow" style="margin-top:18px">WhatsApp preview</p>
  <div class="wa"><div class="wa-head"><span class="wa-av">${esc(first[0])}</span><b>${esc(s.customer.name)}</b></div><div class="wa-body"><div class="bubble">${bubble}<span class="wa-time">${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} <i class="ph-bold ph-checks"></i></span></div></div></div>
  <div class="share-btns">
    <button class="btn wa-btn" data-act="wa"><i class="ph-fill ph-whatsapp-logo"></i> Share on WhatsApp</button>
    <div class="two"><button class="btn secondary" data-act="copy-msg"><i class="ph-bold ph-copy"></i> Copy message</button><button class="btn secondary" data-act="copy-link"><i class="ph-bold ph-link"></i> Copy link</button></div>
    <a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener" data-act="open-link"><i class="ph-bold ph-arrow-square-out"></i> Open the customer's link</a>
  </div>
  <p class="hint"><i class="ph-bold ph-info"></i> Open the link to play the customer. When the purchase completes in this browser, Rohan's dashboard and audit trail update live.</p>`;
}

function vAudit() {
  const s = getSale(S.auditRef) || S.sale;
  if (!s) return '<p>Record not found.</p>';
  const ev = (s.audit || []).slice().sort((a, b) => a.at - b.at);
  const stages = Object.keys(STAGE_LABEL);
  const groups = stages.map(stg => ({ stg, items: ev.filter(e => e.stage === stg) })).filter(g => g.items.length);
  const interested = Object.values(s.responses || {}).filter(v => v === 'interested').length;
  const pitched = Object.keys(s.responses || {}).length;
  const cell = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  return `<p class="eyebrow">Audit trail · consolidated</p><h2 class="s-title">${esc(s.customer.name)}</h2>
  <p class="s-sub"><span class="mono">${esc(s.ref)}</span> · ${pill(s.status)}</p>
  <div class="summary">
    ${cell('Agent', esc(AGENT_LABEL))}${cell('Store', esc(AGENT.store))}
    ${cell('Purchase', `${esc(s.assetName)} · ${inr(s.customer.assetCost)}`)}${cell('Ruleset', esc(AGENT.ruleset))}
    ${s.questions ? cell('Questions answered', `${s.questions.answered} of ${s.questions.total}`) : ''}${s.recommended ? cell('Recommended', String(s.recommended.length)) : ''}
    ${pitched ? cell('Pitched → interested', `${pitched} → ${interested}`) : ''}${cell(s.status === 'Purchased' ? 'Bought' : 'Quote', s.quote.total ? `${s.status === 'Purchased' ? s.quote.items.length + ' · ' : ''}${inr(s.quote.total)}` : '–')}
  </div>
  <div class="timeline">${groups.map(g => `<section><h4><i class="ph-bold ${STAGE_ICON[g.stg]}"></i>${STAGE_LABEL[g.stg]}</h4>${g.items.map(e => `
    <div class="ev"><span class="t">${esc(when(e.at))}</span><div><b>${esc(e.text)}</b>${e.detail ? `<small>${esc(e.detail)}</small>` : ''}<em>${esc(e.actor)}</em></div></div>`).join('')}</section>`).join('')}</div>
  <button class="btn secondary" data-act="download" style="width:100%;margin-top:14px"><i class="ph-bold ph-download-simple"></i> Download record</button>`;
}

/* ── chrome ─────────────────────────────── */
const TITLES = { dash: 'Home', customer: 'New sale', needs: 'Needs', computing: 'Analysing', recs: 'Recommendations', pitch: 'Pitch', share: 'Share quote', audit: 'Audit trail' };
function dock() {
  switch (S.view) {
    case 'dash': return `<button class="btn" data-act="new"><i class="ph-bold ph-plus"></i> Start a new sale</button>`;
    case 'customer': return `<button class="btn" data-act="customer-next">Continue to needs <i class="ph-bold ph-arrow-right"></i></button>`;
    case 'needs': { const n = Object.keys(S.sale.answers).length; return `<button class="btn${n ? '' : ' secondary'}" data-act="compute"><i class="ph-bold ph-sparkle"></i> Get recommendations${n ? ` · ${n} answer${n > 1 ? 's' : ''}` : ''}</button>`; }
    case 'computing': return `<p class="caption">Symbo is checking every product against ${esc(firstName(S.sale.customer.name))}'s answers…</p>`;
    case 'recs': return ranked().length ? `<button class="btn" data-act="pitch"><i class="ph-bold ph-megaphone-simple"></i> Start pitching (${ranked().length})</button>` : `<button class="btn secondary" data-act="close-nofit">Close sale</button>`;
    case 'pitch': return `<div class="two"><button class="btn secondary" data-act="notnow">Not now</button><button class="btn" data-act="yes"><i class="ph-bold ph-thumbs-up"></i> Interested</button></div>`;
    case 'share': return `<div class="two"><button class="btn secondary" data-act="audit-cur">Audit trail</button><button class="btn" data-act="done">Done</button></div>`;
    case 'audit': return `<button class="btn secondary" data-act="home">Back to dashboard</button>`;
  }
  return '';
}
function progress() {
  const i = STEPS.indexOf(S.view === 'computing' ? 'recs' : S.view);
  if (i < 0) return '';
  return `<div class="progress">${STEPS.map((s, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('')}</div>`;
}
function render() {
  const body = { dash: vDash, customer: vCustomer, needs: vNeeds, computing: vComputing, recs: vRecs, pitch: vPitch, share: vShare, audit: vAudit }[S.view]();
  const canBack = !['dash', 'computing'].includes(S.view);
  $('#app').innerHTML = `
    <div class="appbar">
      <button class="back" data-act="back" ${canBack ? '' : 'disabled'} aria-label="Back"><i class="ph-bold ph-caret-left"></i></button>
      <div class="ab-t"><img src="./assets/symbo-mark.png" alt=""><b>${TITLES[S.view]}</b></div>
      <span class="chip-agent"><i class="ph-fill ph-user-circle"></i>${esc(AGENT.name)}</span>
    </div>
    ${progress()}
    <div class="scroll" data-view="${S.view}">${body}</div>
    <div class="dock">${dock()}<div class="home-ind"></div></div>`;
  renderRecord();
}

/* ── right panel: consolidated live record ── */
function renderRecord() {
  const el = $('#record'); if (!el) return;
  const s = ['dash'].includes(S.view) ? null : (S.view === 'audit' ? getSale(S.auditRef) : S.sale && getSale(S.sale.ref) || S.sale);
  if (!s) {
    const ev = S.data.sales.flatMap(x => (x.audit || []).map(e => ({ ...e, who: x.customer.name }))).sort((a, b) => b.at - a.at).slice(0, 12);
    el.innerHTML = `<div class="rec-head"><p class="eyebrow">Symbo record</p><h3>${esc(AGENT.name)}'s activity</h3><p class="muted small">Every step across every sale, logged on ${esc(AGENT_LABEL)}.</p></div>
      <ol class="feed">${ev.map(e => `<li><i class="ph-bold ${STAGE_ICON[e.stage] || 'ph-dot'}"></i><div><b>${esc(e.text)}</b><small>${esc(e.who)} · ${esc(when(e.at))}</small></div></li>`).join('')}</ol>`;
    return;
  }
  const rs = s.responses || {};
  const done = {
    Customer: (s.audit || []).some(e => e.stage === 'Customer'),
    Needs: !!s.questions, Recommendation: !!s.recommended,
    Pitch: s.recommended ? Object.keys(rs).length >= s.recommended.length && s.recommended.length > 0 : false,
    Share: ['Quote shared', 'Viewed', 'Purchased'].includes(s.status), Purchase: s.status === 'Purchased'
  };
  const label = {
    Customer: 'Customer & purchase', Needs: s.questions ? `Needs · ${s.questions.answered}/${s.questions.total} answered` : `Needs · ${Object.keys(s.answers || {}).length} answered`,
    Recommendation: s.recommended ? `Recommended · ${s.recommended.length}` : 'Recommendation', Pitch: `Pitched · ${Object.values(rs).filter(v => v === 'interested').length} interested`,
    Share: 'Quote shared on WhatsApp', Purchase: s.status === 'Purchased' ? `Bought · ${inr(s.quote.total)}` : 'Customer purchase'
  };
  const ev = (s.audit || []).slice().sort((a, b) => b.at - a.at).slice(0, 14);
  el.innerHTML = `<div class="rec-head"><p class="eyebrow">Symbo record · live</p><h3>${esc(s.customer.name)}</h3><p class="muted small"><span class="mono">${esc(s.ref)}</span> · logged on ${esc(AGENT_LABEL)}</p></div>
    <ul class="stages">${Object.keys(done).map(k => `<li class="${done[k] ? 'ok' : ''}"><i class="ph-bold ${done[k] ? 'ph-check-circle' : 'ph-circle'}"></i>${esc(label[k])}</li>`).join('')}</ul>
    <p class="eyebrow" style="margin:16px 0 8px">Audit trail</p>
    <ol class="feed">${ev.map(e => `<li><i class="ph-bold ${STAGE_ICON[e.stage] || 'ph-dot'}"></i><div><b>${esc(e.text)}</b>${e.detail ? `<small>${esc(e.detail)}</small>` : ''}<small>${esc(e.actor)} · ${esc(stamp(e.at))}</small></div></li>`).join('')}</ol>`;
}

/* ── events ─────────────────────────────── */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-ans],[data-skip],[data-q],[data-audit]');
  if (!t || t.closest('[aria-disabled="true"]')) return;
  if (t.dataset.ans) return answer(t.dataset.qid, t.dataset.ans);
  if (t.dataset.skip) return answer(t.dataset.skip, null);
  if (t.dataset.q) { S.qi = Number(t.dataset.q); return render(); }
  if (t.dataset.audit) { S.auditRef = t.dataset.audit; S.prev = S.view; return go('audit'); }
  switch (t.dataset.act) {
    case 'new': return startSale();
    case 'home': case 'done': S.sale = null; return go('dash');
    case 'customer-next': return submitCustomer();
    case 'compute': return compute();
    case 'pitch': S.pi = 0; S.sale.responses = {}; return go('pitch');
    case 'yes': return respond('interested');
    case 'notnow': return respond('not_now');
    case 'close-nofit': S.sale.status = 'No fit'; log(S.sale, AGENT_LABEL, 'Pitch', 'No suitable product; nothing pitched'); persist(); S.sale = null; return go('dash');
    case 'audit-cur': S.auditRef = S.sale.ref; return go('audit');
    case 'wa': markShared('WhatsApp'); window.open('https://wa.me/?text=' + encodeURIComponent(waMessage(S.sale)), '_blank', 'noopener'); return;
    case 'copy-msg': if (await copy(waMessage(S.sale))) { markShared('message copied'); toast('Message copied. Paste it into WhatsApp.'); } else toast('Copy failed. Select the text instead.'); return;
    case 'copy-link': if (await copy(buyLink(S.sale))) { markShared('link copied'); toast('Buy link copied.'); } return;
    case 'open-link': markShared('link opened by agent'); return;
    case 'download': return download();
    case 'reset': if (confirm('Reset Rohan\'s demo data? Sales you created in this browser will be removed.')) { S.data = resetAll(); S.sale = null; go('dash'); toast('Demo data reset.'); } return;
    case 'back': return back();
  }
});
document.addEventListener('change', e => {
  const sel = e.target.closest('[data-variant]');
  if (sel) {
    const id = sel.dataset.variant, before = S.picks[id];
    S.picks[id] = sel.value;
    const p = S.assessed.find(x => x.id === id);
    log(S.sale, AGENT_LABEL, 'Recommendation', `Changed ${p.name} from ${before} to ${sel.value}`, `${inr(chosen(p).price)}`);
    persist(); render();
  }
  if (e.target.closest('#cust')) readCustomer();
});
function back() {
  const order = { customer: 'dash', needs: 'customer', recs: 'needs', pitch: 'recs', share: 'pitch', audit: S.sale ? 'share' : 'dash' };
  if (S.view === 'needs' && S.qi > 0) { S.qi--; return render(); }
  if (S.view === 'pitch' && S.pi > 0) { S.pi--; return render(); }
  if (S.view === 'customer' && !confirm('Leave this sale? The details entered here will be discarded.')) return;
  if (S.view === 'audit' && !S.sale) return go('dash');
  if (S.view === 'customer') S.sale = null;
  go(order[S.view] || 'dash');
}
function download() {
  const s = getSale(S.auditRef) || S.sale;
  const lines = [`SYMBO AGENT JOURNEY · AUDIT RECORD`, `Quote ${s.ref} · status ${s.status}`, `Agent: ${AGENT_LABEL} · ${AGENT.store}`, `Customer: ${s.customer.name} · ${s.assetName} ${s.customer.model || ''} · ${inr(s.customer.assetCost)}`, `Ruleset: ${AGENT.ruleset}`, '', ...(s.audit || []).slice().sort((a, b) => a.at - b.at).map(e => `${stamp(e.at)} | ${e.stage} | ${e.actor} | ${e.text}${e.detail ? ' | ' + e.detail : ''}`), '', 'Fictional demonstration record. No policy was issued and no payment was collected.'];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  a.download = `audit-${s.ref}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* Customer purchases in another tab of this browser update Rohan's dashboard live. */
window.addEventListener('storage', e => {
  if (e.key !== STORAGE_KEY) return;
  const before = S.sale ? S.sale.status : null;
  S.data = load();
  if (S.sale) {
    const fresh = getSale(S.sale.ref);
    if (fresh) { S.sale.status = fresh.status; S.sale.audit = fresh.audit; S.sale.purchasedAt = fresh.purchasedAt; }
    if (before !== 'Purchased' && S.sale.status === 'Purchased') toast(`${firstName(S.sale.customer.name)} just bought ${S.sale.quote.items.length} product${S.sale.quote.items.length > 1 ? 's' : ''}.`);
  }
  if (['dash', 'share', 'audit'].includes(S.view)) render(); else renderRecord();
});

/* status bar clock */
function tick() { const el = $('#clock'); if (el) el.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
setInterval(tick, 15e3); tick();
render();

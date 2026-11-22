/* Agent Journey · customer buy page opened from Rohan's WhatsApp link.
   The quote travels in the link, so it works on any device. If the agent app is open in this same
   browser, the sale's status and audit trail update there live. Nothing is charged or issued. */
import { initialMasters } from './catalogue.js';
import { AGENT, esc, inr, firstName, getSale, saveSale, log } from './store.js';
import { ICONS } from './pitch.js';

const $ = s => document.querySelector(s);
const CATALOGUE = Object.fromEntries(initialMasters.products.map(p => [p.id, p]));
const DEMO_OTP = '123456';
const B = { q: null, step: 'review', dec: {}, open: {}, method: 'upi', certs: [], err: '' };

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
const accepted = () => B.q.items.filter(x => B.dec[x.id] === 'yes');
const total = () => accepted().reduce((n, x) => n + x.price, 0);
const nameOf = x => CATALOGUE[x.id]?.name || x.id;

/* Mirror the customer's actions into Rohan's record when the sale lives in this browser. */
function record(text, detail = '', patch) {
  const sale = getSale(B.q.ref);
  if (!sale) return;
  if (patch) patch(sale);
  log(sale, 'Customer', patch && sale.status === 'Purchased' ? 'Purchase' : 'Consent', text, detail);
  saveSale(sale);
}

function steps() {
  const order = ['review', 'verify', 'pay', 'done'];
  const cur = order.indexOf(B.step === 'paying' ? 'pay' : B.step);
  return `<div class="steps">${['Review', 'Verify', 'Pay', 'Done'].map((l, i) => `<div class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"><i></i>${l}</div>`).join('')}</div>`;
}

function vReview() {
  const q = B.q, first = firstName(q.name);
  const card = x => {
    const p = CATALOGUE[x.id] || {}, d = B.dec[x.id];
    let foot;
    if (d === 'yes') foot = `<p class="state yes"><i class="ph-fill ph-check-circle"></i> Accepted after reading the terms <button data-change="${x.id}">Change</button></p>`;
    else if (d === 'no') foot = `<p class="state no"><i class="ph-bold ph-minus-circle"></i> Not taken <button data-change="${x.id}">Change</button></p>`;
    else if (B.open[x.id]) foot = `<div class="terms" tabindex="0">${esc(p.terms)}</div>
      <label class="consent"><input type="checkbox" data-consent="${x.id}"><span>I have read what ${esc(nameOf(x))} covers and excludes, and I want to buy it for ${inr(x.price)}.</span></label>
      <div class="p-actions"><button class="btn secondary" data-no="${x.id}">Not for me</button><button class="btn" disabled style="opacity:.45" aria-disabled="true">Tick to accept</button></div>`;
    else foot = `<div class="p-actions"><button class="btn secondary" data-no="${x.id}">Not for me</button><button class="btn" data-open="${x.id}">Review & accept</button></div>`;
    return `<article class="prod${d === 'yes' ? ' ok' : d === 'no' ? ' off' : ''}">
      <div class="p-top"><span class="r-ico"><i class="ph-bold ${ICONS[x.id] || 'ph-shield'}"></i></span><div class="r-t"><b>${esc(nameOf(x))}</b><small>${esc(x.variant || p.category || '')}</small></div><span class="amt">${inr(x.price)}</span></div>
      <p class="p-desc">${esc(p.description || '')}</p>${foot}</article>`;
  };
  const n = accepted().length;
  return `<section class="b-hero"><p class="eyebrow light">Quote ${esc(q.ref)}</p><h1>Hi ${esc(first)}, here is the cover you discussed</h1><p>For your ${esc(q.model)} (${esc(q.asset)}). Choose each one yourself. Nothing is selected for you.</p>
      <div class="from"><span class="av">R</span><span>Shared by ${esc(AGENT.name)} · ${esc(AGENT.store)}</span></div></section>
    ${steps()}
    ${q.items.map(card).join('')}
    <div class="sticky-pay"><div class="tot"><span>${n ? `${n} product${n > 1 ? 's' : ''} selected` : 'Accept at least one product to continue'}</span><b>${inr(total())}</b></div>
      <button class="btn" data-go="verify" ${n ? '' : 'disabled style="opacity:.45"'}>Continue <i class="ph-bold ph-arrow-right"></i></button></div>`;
}

function vVerify() {
  const q = B.q;
  return `${steps()}<h2 class="s-title">Confirm it's you</h2><p class="s-sub">We sent a 6-digit code to the mobile ending ${esc(q.mobileLast4)}.</p>
    <div class="card"><div class="fgrid">
      <div class="f full"><span>Name</span><b>${esc(q.name)}</b></div>
      <div class="f full"><span>Email</span><b>${esc(q.email)}</b></div>
    </div></div>
    <div class="otp">${[0, 1, 2, 3, 4, 5].map(i => `<input inputmode="numeric" maxlength="1" aria-label="Digit ${i + 1}" data-otp="${i}">`).join('')}</div>
    <span class="demo-code"><i class="ph-bold ph-info"></i> Demo code: ${DEMO_OTP}</span>
    ${B.err ? `<p class="err-inline" role="alert">${esc(B.err)}</p>` : ''}
    <div class="sticky-pay"><div class="tot"><span>To pay</span><b>${inr(total())}</b></div><button class="btn" data-act="verify">Verify and continue</button></div>`;
}

function vPay() {
  const m = [['upi', 'ph-qr-code', 'UPI', 'Any UPI app'], ['card', 'ph-credit-card', 'Debit or credit card', 'Visa, Mastercard, RuPay'], ['nb', 'ph-bank', 'Net banking', 'All major banks']];
  return `${steps()}<h2 class="s-title">Pay ${inr(total())}</h2><p class="s-sub">${accepted().map(x => esc(nameOf(x))).join(' · ')}</p>
    <div class="methods">${m.map(([id, ic, t, s]) => `<label class="method"><input type="radio" name="m" value="${id}" ${B.method === id ? 'checked' : ''}><i class="ph-bold ${ic}"></i><span><b>${t}</b><small>${s}</small></span></label>`).join('')}</div>
    <div class="sticky-pay"><div class="tot"><span>Total · GST included</span><b>${inr(total())}</b></div><button class="btn" data-act="pay"><i class="ph-bold ph-lock-simple"></i> Pay ${inr(total())}</button></div>`;
}

const vPaying = () => `<div class="paying"><div class="cmp-mark"><img src="./assets/symbo-mark.png" alt=""><span class="ring"></span></div><h2 class="s-title">Confirming your payment</h2><p class="s-sub" style="justify-content:center">Please keep this page open.</p></div>`;

function vDone() {
  const first = firstName(B.q.name);
  return `${steps()}<div class="done-hero"><div class="tick"><i class="ph-bold ph-check"></i></div><h1>You're covered, ${esc(first)}</h1><p>Payment of ${inr(total())} received. Your certificates are below and on their way to ${esc(B.q.email)}.</p></div>
    ${B.certs.map(c => `<div class="cert"><span class="r-ico"><i class="ph-bold ${ICONS[c.id] || 'ph-shield'}"></i></span><div class="r-t"><b>${esc(c.name)}${c.variant ? ' · ' + esc(c.variant) : ''}</b><small>${esc(c.no)}</small></div><b class="amt">${inr(c.price)}</b></div>`).join('')}
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:18px">
      <button class="btn" data-act="receipt"><i class="ph-bold ph-download-simple"></i> Download receipt</button>
      <p class="hint" style="justify-content:center"><i class="ph-bold ph-user-circle"></i> ${esc(AGENT.name)} at ${esc(AGENT.store)} has been notified.</p>
    </div>`;
}

const vEmpty = (title, text) => `<div class="empty"><i class="ph-bold ph-link-break"></i><h1>${title}</h1><p>${text}</p></div>`;

function render() {
  const views = { review: vReview, verify: vVerify, pay: vPay, paying: vPaying, done: vDone,
    invalid: () => vEmpty('This link is incomplete', 'Ask the agent who shared it to send it again.'),
    expired: () => vEmpty('This quote has expired', `Quotes are valid for 48 hours. Ask ${esc(AGENT.name)} to share a fresh one.`) };
  $('#buy').innerHTML = views[B.step]();
  if (B.step === 'verify') $('[data-otp="0"]')?.focus();
  window.scrollTo(0, 0);
}
function go(step) { B.step = step; B.err = ''; render(); }

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t || t.disabled) return;
  if (t.dataset.open) { B.open[t.dataset.open] = true; record(`Opened the terms for ${nameOf({ id: t.dataset.open })}`); return render(); }
  if (t.dataset.no) { B.dec[t.dataset.no] = 'no'; record(`Chose not to take ${nameOf({ id: t.dataset.no })}`); return render(); }
  if (t.dataset.change) { delete B.dec[t.dataset.change]; B.open[t.dataset.change] = false; return render(); }
  if (t.dataset.go === 'verify') { record('Continued with ' + accepted().map(nameOf).join(', '), inr(total())); return go('verify'); }
  switch (t.dataset.act) {
    case 'verify': {
      const code = [...document.querySelectorAll('[data-otp]')].map(i => i.value).join('');
      if (code !== DEMO_OTP) { B.err = 'That code is not right. Use the demo code shown.'; return render(); }
      record(`Verified by OTP on the mobile ending ${B.q.mobileLast4}`); return go('pay');
    }
    case 'pay': {
      B.method = document.querySelector('input[name="m"]:checked')?.value || 'upi';
      go('paying');
      setTimeout(() => {
        const items = accepted();
        B.certs = items.map(x => ({ ...x, name: nameOf(x), no: `SYM/${x.id.toUpperCase()}/${B.q.ref.slice(-4)}/${Math.floor(10000 + Math.random() * 90000)}` }));
        const method = { upi: 'UPI', card: 'card', nb: 'net banking' }[B.method];
        record(`Paid ${inr(total())} by ${method} and bought ${items.length} product${items.length > 1 ? 's' : ''}`, B.certs.map(c => `${c.name}: ${c.no}`).join(' · '), sale => {
          sale.status = 'Purchased'; sale.purchasedAt = Date.now();
          sale.offered = sale.offered || sale.quote.items;
          sale.quote = { ...sale.quote, items: items.map(x => ({ id: x.id, name: nameOf(x), variant: x.variant, price: x.price })), total: total() };
        });
        go('done');
      }, 1800);
      return;
    }
    case 'receipt': {
      const q = B.q;
      const lines = ['LOANBEE · PROTECTION RECEIPT (DEMO)', `Quote ${q.ref}`, `Customer: ${q.name} · ${q.email}`, `Purchase: ${q.model} (${q.asset})`, `Sold by: ${AGENT.name} (${AGENT.id}) · ${AGENT.store}`, '', ...B.certs.map(c => `${c.name}${c.variant ? ' · ' + c.variant : ''} · ${inr(c.price)} · certificate ${c.no}`), '', `Total paid: ${inr(total())} (GST included)`, `Date: ${new Date().toLocaleString('en-IN')}`, '', 'Demonstration only. No payment was collected and no policy was issued.'];
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' })); a.download = `receipt-${q.ref}.txt`; a.click();
      return;
    }
  }
});
document.addEventListener('change', e => {
  const c = e.target.closest('[data-consent]');
  if (c && c.checked) { B.dec[c.dataset.consent] = 'yes'; record(`Read the terms and consented to ${nameOf({ id: c.dataset.consent })}`, inr(B.q.items.find(x => x.id === c.dataset.consent).price)); render(); }
});
document.addEventListener('input', e => {
  const i = e.target.closest('[data-otp]'); if (!i) return;
  i.value = i.value.replace(/\D/g, '').slice(-1);
  if (i.value) document.querySelector(`[data-otp="${Number(i.dataset.otp) + 1}"]`)?.focus();
});
document.addEventListener('paste', e => {
  const i = e.target.closest('[data-otp]'); if (!i) return;
  const d = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!d) return;
  e.preventDefault(); document.querySelectorAll('[data-otp]').forEach((x, k) => { x.value = d[k] || ''; });
});
document.addEventListener('keydown', e => {
  const i = e.target.closest('[data-otp]');
  if (i && e.key === 'Backspace' && !i.value) document.querySelector(`[data-otp="${Number(i.dataset.otp) - 1}"]`)?.focus();
});

/* boot */
import('./store.js').then(({ decodeQuote }) => {
  const m = /[#&]q=([A-Za-z0-9_-]+)/.exec(location.hash);
  B.q = m ? decodeQuote(m[1]) : null;
  if (!B.q) return go('invalid');
  if (B.q.expiresAt && Date.now() > B.q.expiresAt) return go('expired');
  const sale = getSale(B.q.ref);
  if (sale && sale.status === 'Purchased') { B.q.items.forEach(x => { B.dec[x.id] = (sale.quote.items.some(i => i.id === x.id)) ? 'yes' : 'no'; }); B.certs = sale.quote.items.map(x => ({ ...x, no: (sale.audit.find(a => a.stage === 'Purchase')?.detail.match(new RegExp(x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ': (\\S+)')) || [])[1] || '' })); return go('done'); }
  record('Opened the quote link', '', s => { if (['Quote ready', 'Quote shared'].includes(s.status)) s.status = 'Viewed'; });
  go('review');
});

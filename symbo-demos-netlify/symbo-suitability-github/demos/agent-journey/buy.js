/* Customer buy page opened from the agent's WhatsApp link (store or bank).
   The quote travels in the link, so it works on any device. If the agent portal is open in this same
   browser, the sale's status and audit trail update there live. Nothing is charged or issued. */
import { CHANNELS, orgLogo, esc, inr, firstName, getSale, saveSale, log, eventId, postEvent, fetchStatus, decodeQuote } from './store.js';
import { ENGINES } from './engines.js';

const $ = s => document.querySelector(s);
const DEMO_OTP = '123456';
const B = { q: null, step: 'review', dec: {}, open: {}, method: 'upi', certs: [], err: '' };
let CH = CHANNELS.store, ENGINE = ENGINES.store, AGENT = CH.agent, ICONS = ENGINE.icons;
const CATALOGUE = { get: id => ENGINE.info(id) };

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
const accepted = () => B.q.items.filter(x => B.dec[x.id] === 'yes');
const total = () => accepted().reduce((n, x) => n + x.price, 0);
const nameOf = x => CATALOGUE.get(x.id)?.name || x.id;

/* Every customer action goes to Rohan's record: straight into this browser's copy when the agent app
   shares it, and to the sync function so the agent sees it from another device. Same id both ways. */
function record(text, detail = '', opts = {}) {
  const id = eventId();
  const stage = opts.status === 'Purchased' ? 'Purchase' : 'Consent';
  const sale = getSale(B.q.ref);
  if (sale) {
    if (opts.patch) opts.patch(sale);
    log(sale, 'Customer', stage, text, detail, id);
    saveSale(sale);
  }
  postEvent({ ref: B.q.ref, id, stage, text, detail, status: opts.status, items: opts.items, total: opts.total });
}
/* Certificate numbers are kept in the purchase event's detail ("Name: SYM/..."). */
function certsFrom(items, events) {
  const detail = (events || []).find(e => e.stage === 'Purchase')?.detail || '';
  return items.map(x => {
    const name = nameOf(x);
    const at = detail.indexOf(name + ': ');
    const no = at < 0 ? '' : detail.slice(at + name.length + 2).split(' ')[0];
    return { ...x, name, no };
  });
}

function steps() {
  const order = ['review', 'verify', 'pay', 'done'];
  const cur = order.indexOf(B.step === 'paying' ? 'pay' : B.step);
  return `<div class="steps">${['Review', 'Verify', 'Pay', 'Done'].map((l, i) => `<div class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"><i></i>${l}</div>`).join('')}</div>`;
}

function vReview() {
  const q = B.q, first = firstName(q.name);
  const card = x => {
    const p = CATALOGUE.get(x.id) || {}, d = B.dec[x.id];
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
  const forWhat = q.channel === 'bank' ? `For your ${esc(q.subject.toLowerCase())} ${esc(q.subjectDetail.split(' · ')[0])}.` : `For your ${esc(q.subjectDetail)} (${esc(q.subject)}).`;
  return `<section class="b-hero"><p class="eyebrow light">Quote ${esc(q.ref)}</p><h1>Hi ${esc(first)}, here is the cover you discussed</h1><p>${forWhat} Choose each one yourself. Nothing is selected for you.</p>
      <div class="from"><span class="av">${esc(AGENT.name.split(' ').map(x => x[0]).join(''))}</span><span>Shared by ${esc(AGENT.name)} · ${esc(CH.org)}, ${esc(AGENT.branch.split(',')[0])}</span></div></section>
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
    <div class="sms" role="status"><span class="sms-ico"><i class="ph-fill ph-chat-circle-text"></i></span><div><b>${esc(CH.short)} · now</b><span>${DEMO_OTP} is your code to confirm quote ${esc(q.ref)}. Do not share it with anyone.</span></div></div>
    <div class="otp">${[0, 1, 2, 3, 4, 5].map(i => `<input inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Digit ${i + 1}" data-otp="${i}">`).join('')}</div>
    ${B.err ? `<p class="err-inline" role="alert">${esc(B.err)}</p>` : ''}
    <div class="sticky-pay"><div class="tot"><span>To pay</span><b>${inr(total())}</b></div><button class="btn" data-act="verify">Verify and continue</button></div>`;
}

function vPay() {
  const m = [...(B.q.channel === 'bank' ? [['acct', 'ph-bank', 'KBI savings account', 'Debit from your account ending 4821']] : []),
    ['upi', 'ph-qr-code', 'UPI', 'Any UPI app'], ['card', 'ph-credit-card', 'Debit or credit card', 'Visa, Mastercard, RuPay'], ['nb', 'ph-buildings', 'Net banking', 'All major banks']];
  return `${steps()}<h2 class="s-title">Pay ${inr(total())}</h2><p class="s-sub">${accepted().map(x => esc(nameOf(x))).join(' · ')}</p>
    <div class="methods">${m.map(([id, ic, t, s]) => `<label class="method"><input type="radio" name="m" value="${id}" ${B.method === id ? 'checked' : ''}><i class="ph-bold ${ic}"></i><span><b>${t}</b><small>${s}</small></span></label>`).join('')}</div>
    <div class="sticky-pay"><div class="tot"><span>Total · GST included</span><b>${inr(total())}</b></div><button class="btn" data-act="pay"><i class="ph-bold ph-lock-simple"></i> Pay ${inr(total())}</button></div>`;
}

const vPaying = () => `<div class="paying"><div class="cmp-mark"><img src="./assets/symbo-mark.png" alt=""><span class="ring"></span></div><h2 class="s-title">Confirming your payment</h2><p class="s-sub" style="justify-content:center">Please keep this page open.</p></div>`;

function vDone() {
  const first = firstName(B.q.name);
  return `${steps()}<div class="done-hero"><div class="tick"><i class="ph-bold ph-check"></i></div><h1>You're covered, ${esc(first)}</h1><p>Payment of ${inr(total())} received. Your certificates are below and on their way to ${esc(B.q.email)}. An acknowledgement with our helpline number is coming by SMS.</p></div>
    ${B.certs.map(c => `<div class="cert"><span class="r-ico"><i class="ph-bold ${ICONS[c.id] || 'ph-shield'}"></i></span><div class="r-t"><b>${esc(c.name)}${c.variant ? ' · ' + esc(c.variant) : ''}</b><small>${esc(c.no)}</small></div><b class="amt">${inr(c.price)}</b></div>`).join('')}
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:18px">
      <button class="btn" data-act="receipt"><i class="ph-bold ph-download-simple"></i> Download receipt</button>
      <p class="hint" style="justify-content:center"><i class="ph-bold ph-user-circle"></i> ${esc(AGENT.name)} at ${esc(CH.org)} has been notified.</p>
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
      if (code !== DEMO_OTP) { B.err = 'That code is not right. Check the SMS and try again.'; return render(); }
      record(`Verified by OTP on the mobile ending ${B.q.mobileLast4}`); return go('pay');
    }
    case 'pay': {
      B.method = document.querySelector('input[name="m"]:checked')?.value || 'upi';
      go('paying');
      setTimeout(() => {
        const items = accepted();
        B.certs = items.map(x => ({ ...x, name: nameOf(x), no: `SYM/${x.id.toUpperCase()}/${B.q.ref.slice(-4)}/${Math.floor(10000 + Math.random() * 90000)}` }));
        const method = { acct: 'KBI account debit', upi: 'UPI', card: 'card', nb: 'net banking' }[B.method];
        record(`Paid ${inr(total())} by ${method} and bought ${items.length} product${items.length > 1 ? 's' : ''}`, B.certs.map(c => `${c.name}: ${c.no}`).join(' · '), {
          status: 'Purchased', total: total(), items: items.map(x => ({ id: x.id, variant: x.variant, price: x.price })),
          patch: sale => {
            sale.status = 'Purchased'; sale.purchasedAt = Date.now();
            sale.offered = sale.offered || sale.quote.items;
            sale.quote = { ...sale.quote, items: items.map(x => ({ id: x.id, name: nameOf(x), variant: x.variant, price: x.price })), total: total() };
          }
        });
        go('done');
      }, 1800);
      return;
    }
    case 'receipt': {
      const q = B.q;
      const lines = [`${CH.org.toUpperCase()} · PROTECTION RECEIPT`, `Quote ${q.ref}`, `Customer: ${q.name} · ${q.email}`, `${q.channel === 'bank' ? 'Loan' : 'Purchase'}: ${q.subject} · ${q.subjectDetail}`, `Sold by: ${AGENT.name} (${AGENT.id}) · ${CH.org}, ${AGENT.branch}`, '', ...B.certs.map(c => `${c.name}${c.variant ? ' · ' + c.variant : ''} · ${inr(c.price)} · certificate ${c.no}`), '', `Total paid: ${inr(total())} (GST included)`, `Date: ${new Date().toLocaleString('en-IN')}`, '', 'Generated on the Symbo platform.'];
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
function showBought(items, events) {
  B.q.items.forEach(x => { B.dec[x.id] = items.some(i => i.id === x.id) ? 'yes' : 'no'; });
  B.certs = certsFrom(B.q.items.filter(x => B.dec[x.id] === 'yes'), events);
  go('done');
}
(async () => {
  const m = /[#&]q=([A-Za-z0-9_-]+)/.exec(location.hash);
  B.q = m ? decodeQuote(m[1]) : null;
  if (B.q) { CH = CHANNELS[B.q.channel]; ENGINE = ENGINES[B.q.channel]; AGENT = CH.agent; ICONS = ENGINE.icons; }
  $('#brand').innerHTML = `${orgLogo(CH.id, 26)}<span>${esc(CH.org)}</span>`;
  document.title = `Your protection quote · ${CH.org}`;
  if (!B.q) return go('invalid');
  const sale = getSale(B.q.ref);
  if (sale && sale.status === 'Purchased') return showBought(sale.quote.items, sale.audit);
  if (!sale) {
    /* Opened on another device: if it was already bought, show the policy instead of a fresh quote. */
    const remote = (await fetchStatus([B.q.ref]))?.[B.q.ref];
    if (remote && remote.status === 'Purchased') return showBought(remote.items || [], remote.events);
  }
  if (B.q.expiresAt && Date.now() > B.q.expiresAt) return go('expired');
  record('Opened the quote link', '', { status: 'Viewed', patch: s => { if (['Quote ready', 'Quote shared'].includes(s.status)) s.status = 'Viewed'; } });
  go('review');
})();

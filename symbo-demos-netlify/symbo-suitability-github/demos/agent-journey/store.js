/* Agent Journey · shared data layer for the agent app and the customer buy page.
   Everything is fictional and stays in this browser (localStorage). Nothing is sent, charged or issued. */

export const AGENT = { name: 'Rohan', id: 'SYM-AG-1042', store: 'Sharma Electronics, Andheri West', partner: 'LoanBee', ruleset: 'CD-SUIT v1.4' };
export const AGENT_LABEL = `${AGENT.name} (${AGENT.id})`;
export const TARGET_POLICIES = 40;

const KEY = 'symbo-agent-journey:v1';
const DAY = 864e5;

export const PRODUCT_NAMES = {
  ew: 'Extended Warranty', adld: 'Accidental & Liquid Damage', health: 'Wellness Access',
  epicure: 'Home & Digital Assist', galaxy: 'Hospital Cash & EMI Support', insta: 'Future Purchase Programme'
};

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const firstName = n => String(n || '').trim().split(/\s+/)[0] || 'the customer';
export function when(ts) {
  const d = new Date(ts), now = new Date();
  const t = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'Today, ' + t;
  if (d.toDateString() === new Date(now - DAY).toDateString()) return 'Yesterday, ' + t;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + t;
}
export const stamp = ts => new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/* ── storage (wrapped: private windows and blocked storage must not break the demo) ── */
let memory = null;
function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return memory; } }
function write(v) { memory = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* memory only */ } }

export function load() {
  let s = read();
  if (!s || !Array.isArray(s.sales)) { s = { sales: seedSales() }; write(s); }
  return s;
}
export function resetAll() { const s = { sales: seedSales() }; write(s); return s; }
export function saveSale(sale) {
  const s = load();
  const i = s.sales.findIndex(x => x.ref === sale.ref);
  if (i >= 0) s.sales[i] = sale; else s.sales.unshift(sale);
  write(s);
  return sale;
}
/* Read-only lookup: never seeds, so a customer's own phone does not get Rohan's demo data. */
export function getSale(ref) { const s = read(); return (s && Array.isArray(s.sales) && s.sales.find(x => x.ref === ref)) || null; }
export const STORAGE_KEY = KEY;

export const eventId = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
export function log(sale, actor, stage, text, detail = '', id = eventId()) {
  (sale.audit ||= []).push({ at: Date.now(), actor, stage, text, detail, id });
}

/* ── cross-device sync (Netlify function behind the access gate; silently off when unavailable) ── */
export const SYNC_URL = '/api/journey/';
export async function postEvent(ev, retries = 1) {
  try {
    const r = await fetch(SYNC_URL + 'event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev), keepalive: true, credentials: 'same-origin' });
    if (r.ok) return true;
    /* Retry once on a write conflict or server hiccup; the event id makes a repeat harmless. */
    if (retries > 0 && (r.status === 409 || r.status >= 500)) { await new Promise(res => setTimeout(res, 400)); return postEvent(ev, retries - 1); }
    return false;
  } catch { return false; }
}
export async function fetchStatus(refs) {
  if (!refs.length) return null;
  try {
    const r = await fetch(SYNC_URL + 'status?refs=' + encodeURIComponent(refs.join(',')), { cache: 'no-store', credentials: 'same-origin' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('application/json')) return null;
    return (await r.json()).sales || null;
  } catch { return null; }
}
export function newRef() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `AJ-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/* ── share payload: the buy link carries the quote, so it opens on any device ── */
function b64u(str) { const b = new TextEncoder().encode(str); let s = ''; b.forEach(x => s += String.fromCharCode(x)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(str) { const s = str.replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(s + '==='.slice((s.length + 3) % 4)); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
export function encodeQuote(sale) {
  const c = sale.customer;
  return b64u(JSON.stringify({
    r: sale.ref, n: c.name, e: c.email, m: String(c.mobile).slice(-4), a: sale.assetName, b: `${c.brand} ${c.model}`.trim(), c: c.assetCost,
    i: sale.quote.items.map(x => [x.id, x.variant || '', Math.round(x.price)]), t: Math.round(sale.quote.total), x: sale.quote.expiresAt
  }));
}
export function decodeQuote(str) {
  try {
    const o = JSON.parse(unb64u(str));
    if (!o || !o.r || !Array.isArray(o.i) || !o.i.length) return null;
    return { ref: o.r, name: o.n, email: o.e, mobileLast4: o.m, asset: o.a, model: o.b, assetCost: o.c, items: o.i.map(([id, variant, price]) => ({ id, variant, price })), total: o.t, expiresAt: o.x };
  } catch { return null; }
}

/* ── dashboard maths ── */
export function stats(sales, now = Date.now()) {
  const recent = sales.filter(s => now - s.createdAt < 30 * DAY && s.status !== 'Draft');
  const bought = recent.filter(s => s.status === 'Purchased');
  const today = bought.filter(s => new Date(s.purchasedAt || s.createdAt).toDateString() === new Date(now).toDateString());
  const policies = bought.reduce((n, s) => n + s.quote.items.length, 0);
  const pitched = recent.filter(s => s.status !== 'Draft');
  return {
    policies, premium: bought.reduce((n, s) => n + s.quote.total, 0),
    todayPolicies: today.reduce((n, s) => n + s.quote.items.length, 0), todayPremium: today.reduce((n, s) => n + s.quote.total, 0),
    conversion: pitched.length ? Math.round(bought.length / pitched.length * 100) : 0,
    open: recent.filter(s => s.status === 'Quote shared' || s.status === 'Viewed').length,
    target: TARGET_POLICIES
  };
}

/* ── seeded history so Rohan's dashboard is not empty ── */
function seedSales() {
  const now = Date.now();
  const rows = [
    ['Priya Nair', 'Refrigerator', 'Whirlpool 340L', 32990, [['ew', '2 years', 893], ['health', 'Silver', 750]], 'Purchased', 0.12],
    ['Imran Shaikh', 'Mobile - Android', 'Galaxy A55', 39999, [['adld', '', 1200], ['epicure', 'Prime', 1199]], 'Purchased', 0.2],
    ['Kavita Joshi', 'LED TV', 'Bravia 50"', 58990, [['ew', '3 years', 3275], ['galaxy', '', 999]], 'Quote shared', 0.3],
    ['Suresh Patil', 'Washing Machine', 'LG 8kg', 36490, [['epicure', 'Lite', 250]], 'Purchased', 1.1],
    ['Neha Gupta', 'Air Conditioner', 'Voltas 1.5T', 41990, [['ew', '2 years', 1554], ['epicure', 'Prime', 1199], ['health', 'Gold', 1300]], 'Purchased', 2.2],
    ['Arjun Rao', 'Mobile - Apple', 'iPhone 15', 69900, [['adld', '', 2097]], 'Viewed', 2.4],
    ['Farah Khan', 'LED TV', 'TCL 55"', 44990, [['galaxy', '', 999], ['health', 'Bronze', 350]], 'Purchased', 3.3],
    ['Deepak Yadav', 'Refrigerator', 'Godrej 260L', 27490, [['ew', '1 year', 479]], 'Purchased', 5.2],
    ['Meera Iyer', 'Washing Machine', 'Bosch 7kg', 38990, [['epicure', 'Prime', 1199], ['galaxy', '', 999]], 'Purchased', 8.4],
    ['Rahul Desai', 'Air Conditioner', 'Daikin 1T', 37990, [['ew', '3 years', 2117]], 'Not taken', 9.1],
    ['Sana Mirza', 'LED TV', 'Samsung 43"', 31990, [['ew', '2 years', 1184], ['health', 'Bronze Plus', 550]], 'Purchased', 12.3],
    ['Vikram Singh', 'Mobile - Android', 'OnePlus 12R', 42999, [['adld', '', 1290]], 'Purchased', 15.2]
  ];
  return rows.map(([name, assetName, model, cost, items, status, ago], k) => {
    const createdAt = now - ago * DAY - 40 * 60e3;
    const ref = `AJ-S${String(k + 1).padStart(3, '0')}`;
    const quoteItems = items.map(([id, variant, price]) => ({ id, name: PRODUCT_NAMES[id], variant, price }));
    const total = quoteItems.reduce((n, x) => n + x.price, 0);
    const sale = {
      ref, seed: true, createdAt, status, assetName,
      customer: { name, model, assetCost: cost },
      quote: { items: quoteItems, total, expiresAt: createdAt + 2 * DAY },
      purchasedAt: status === 'Purchased' ? createdAt + 35 * 60e3 : null, audit: []
    };
    const at = (m, actor, stage, text, detail = '') => sale.audit.push({ at: createdAt + m * 60e3, actor, stage, text, detail });
    at(0, AGENT_LABEL, 'Customer', `Started sale for ${name}`, `${assetName} · ${model} · ${inr(cost)}`);
    at(6, AGENT_LABEL, 'Needs', 'Suitability questions completed');
    at(7, 'Symbo', 'Recommendation', `${quoteItems.length} product${quoteItems.length > 1 ? 's' : ''} recommended`, quoteItems.map(x => x.name).join(', '));
    at(14, AGENT_LABEL, 'Pitch', 'Customer interested', quoteItems.map(x => x.name).join(', '));
    at(15, AGENT_LABEL, 'Share', `Quote ${ref} shared on WhatsApp`, inr(total));
    if (status !== 'Quote shared') at(22, 'Customer', 'Consent', 'Opened the quote link');
    if (status === 'Purchased') at(33, 'Customer', 'Consent', `Read the terms and consented to ${quoteItems.length} product${quoteItems.length > 1 ? 's' : ''}; verified by OTP`);
    if (status === 'Purchased') at(35, 'Customer', 'Purchase', `Paid ${inr(total)} and bought ${quoteItems.length} product${quoteItems.length > 1 ? 's' : ''}`);
    if (status === 'Not taken') at(30, 'Customer', 'Consent', 'Did not buy before the quote expired');
    return sale;
  });
}

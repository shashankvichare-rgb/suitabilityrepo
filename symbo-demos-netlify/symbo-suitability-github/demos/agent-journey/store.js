/* Agent portal · shared data layer for the agent portal and the customer buy page.
   Two channels (store, bank), each with its own browser-local record of sales. */

export const CHANNELS = {
  store: { id: 'store', org: 'Ajay Sales Electronics', short: 'Ajay Sales', ref: 'AJ', key: 'symbo-agent-portal:store:v2',
    agent: { name: 'Rohan', id: 'AJS-SA-1042', role: 'Sales agent', branch: 'Andheri West, Mumbai' }, target: 40 },
  bank: { id: 'bank', org: 'KBI Bank', short: 'KBI Bank', ref: 'KB', key: 'symbo-agent-portal:bank:v2',
    agent: { name: 'Rohan Joshi', id: 'KBI-RM-2087', role: 'Relationship manager', branch: 'BKC Branch, Mumbai' }, target: 60 }
};
/* Fictional brand marks for the two partners. */
export function orgLogo(ch, size = 32) {
  const svg = ch === 'bank'
    ? `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="#0f2f6b"/><text x="20" y="24.5" text-anchor="middle" font-family="Inter Tight,Arial,sans-serif" font-weight="800" font-size="13" fill="#fff" letter-spacing=".5">KBI</text><rect x="9" y="29" width="22" height="3" rx="1.5" fill="#f7941d"/></svg>`
    : `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="#e23b2e"/><path d="M22.5 7 11 22.5h7.5L16.5 33 29 16.5h-7.6z" fill="#fff"/></svg>`;
  return `<span class="org-logo" style="width:${size}px;height:${size}px">${svg}</span>`;
}
export const channelOfRef = ref => String(ref || '').startsWith('KB-') ? 'bank' : 'store';
export const agentLabel = ch => `${CHANNELS[ch].agent.name} (${CHANNELS[ch].agent.id})`;

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const firstName = n => String(n || '').trim().split(/\s+/)[0] || 'the customer';
const DAY = 864e5;
export function when(ts) {
  const d = new Date(ts), now = new Date();
  const t = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'Today, ' + t;
  if (d.toDateString() === new Date(now - DAY).toDateString()) return 'Yesterday, ' + t;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + t;
}
export const stamp = ts => new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const dateOnly = ts => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/* ── storage (wrapped: private windows and blocked storage must not break the portal) ── */
const memory = {};
function read(ch) { try { return JSON.parse(localStorage.getItem(CHANNELS[ch].key) || 'null'); } catch { return memory[ch] || null; } }
function write(ch, v) { memory[ch] = v; try { localStorage.setItem(CHANNELS[ch].key, JSON.stringify(v)); } catch { /* memory only */ } }
export function load(ch, seed) {
  let s = read(ch);
  if (!s || !Array.isArray(s.sales)) { s = { sales: seed ? seed() : [] }; write(ch, s); }
  return s;
}
export function resetChannel(ch, seed) { const s = { sales: seed() }; write(ch, s); return s; }
export function saveSale(sale) {
  const ch = sale.channel;
  const s = read(ch) || { sales: [] };
  const i = s.sales.findIndex(x => x.ref === sale.ref);
  if (i >= 0) s.sales[i] = sale; else s.sales.unshift(sale);
  write(ch, s);
  return sale;
}
/* Read-only lookup: never seeds, so a customer's phone does not get the agent's records. */
export function getSale(ref, ch = channelOfRef(ref)) { const s = read(ch); return (s && Array.isArray(s.sales) && s.sales.find(x => x.ref === ref)) || null; }
export const storageKeys = () => Object.values(CHANNELS).map(c => c.key);

export const eventId = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
export function log(sale, actor, stage, text, detail = '', id = eventId()) {
  (sale.audit ||= []).push({ at: Date.now(), actor, stage, text, detail, id });
}
export function newRef(ch) {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${CHANNELS[ch].ref}-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/* ── share payload: the buy link carries the quote, so it opens on any device ── */
function b64u(str) { const b = new TextEncoder().encode(str); let s = ''; b.forEach(x => s += String.fromCharCode(x)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(str) { const s = str.replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(s + '==='.slice((s.length + 3) % 4)); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
export function encodeQuote(sale) {
  const c = sale.customer;
  return b64u(JSON.stringify({
    h: sale.channel === 'bank' ? 'b' : 's', r: sale.ref, n: c.name, e: c.email, m: String(c.mobile).slice(-4), a: sale.subject, b: sale.subjectDetail,
    i: sale.quote.items.map(x => [x.id, x.variant || '', Math.round(x.price)]), t: Math.round(sale.quote.total), x: sale.quote.expiresAt
  }));
}
export function decodeQuote(str) {
  try {
    const o = JSON.parse(unb64u(str));
    if (!o || !o.r || !Array.isArray(o.i) || !o.i.length) return null;
    return { channel: o.h === 'b' ? 'bank' : 'store', ref: o.r, name: o.n, email: o.e, mobileLast4: o.m, subject: o.a, subjectDetail: o.b,
      items: o.i.map(([id, variant, price]) => ({ id, variant, price })), total: o.t, expiresAt: o.x };
  } catch { return null; }
}

/* ── cross-device sync (Netlify function behind the access gate; silently off when unavailable) ── */
export const SYNC_URL = '/api/journey/';
export async function postEvent(ev, retries = 1) {
  try {
    const r = await fetch(SYNC_URL + 'event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev), keepalive: true, credentials: 'same-origin' });
    if (r.ok) return true;
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

/* ── dashboard maths ── */
export function stats(sales, target, now = Date.now()) {
  const recent = sales.filter(s => now - s.createdAt < 30 * DAY && s.status !== 'Draft');
  const bought = recent.filter(s => s.status === 'Purchased');
  const today = bought.filter(s => new Date(s.purchasedAt || s.createdAt).toDateString() === new Date(now).toDateString());
  return {
    policies: bought.reduce((n, s) => n + s.quote.items.length, 0), premium: bought.reduce((n, s) => n + s.quote.total, 0),
    todayPolicies: today.reduce((n, s) => n + s.quote.items.length, 0), todayPremium: today.reduce((n, s) => n + s.quote.total, 0),
    conversion: recent.length ? Math.round(bought.length / recent.length * 100) : 0,
    open: recent.filter(s => ['Quote ready', 'Quote shared', 'Viewed'].includes(s.status)).length, target
  };
}

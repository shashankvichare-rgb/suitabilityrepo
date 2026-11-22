/* Agent Journey sync (Netlify Functions v2 + Netlify Blobs).
   The customer's buy page posts what they do; Rohan's app polls for its open quotes and merges the events.
   This lets a purchase on the customer's phone show up on the agent's screen.
   Routes (behind the access gate, under /api/journey/):
     POST event   { ref, id, stage, text, detail?, status?, items?, total? }
     GET  status?refs=AJ-...,AJ-...                                       */
import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'agent-journey', consistency: 'strong' });
const REF = /^AJ-\d{6}-\d{4}$/;
const EVENT_ID = /^[A-Za-z0-9_-]{6,40}$/;
const STAGES = new Set(['Consent', 'Purchase']);
const PRODUCTS = new Set(['ew', 'adld', 'health', 'epicure', 'galaxy', 'insta']);
const MAX_EVENTS = 60;

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }
});
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function readEvent(b) {
  const ref = String(b.ref || '');
  const id = String(b.id || '');
  if (!REF.test(ref)) throw new HttpError(400, 'Invalid quote reference.');
  if (!EVENT_ID.test(id)) throw new HttpError(400, 'Invalid event id.');
  if (!STAGES.has(b.stage)) throw new HttpError(400, 'Invalid stage.');
  const text = clean(b.text, 200);
  if (!text) throw new HttpError(400, 'Event text is required.');
  const ev = { ref, id, stage: b.stage, text, detail: clean(b.detail, 400) };
  if (b.status === 'Viewed') ev.status = 'Viewed';
  if (b.status === 'Purchased') {
    const items = Array.isArray(b.items) ? b.items.slice(0, 6) : [];
    ev.items = items.map(x => ({ id: String(x?.id || ''), variant: clean(x?.variant, 40), price: Math.round(Number(x?.price)) }))
      .filter(x => PRODUCTS.has(x.id) && Number.isFinite(x.price) && x.price >= 0 && x.price <= 1e6);
    if (!ev.items.length) throw new HttpError(400, 'A purchase needs at least one product.');
    ev.total = ev.items.reduce((n, x) => n + x.price, 0);
    ev.status = 'Purchased';
  }
  return ev;
}

async function addEvent(ev) {
  const s = store();
  const key = 'sale/' + ev.ref;
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 15 + Math.random() * 40 * attempt)); /* back off on write conflicts */
    const entry = await s.getWithMetadata(key, { type: 'json' });
    const rec = entry?.data || { ref: ev.ref, status: 'Quote shared', events: [], createdAt: Date.now() };
    if (!rec.events.some(e => e.id === ev.id)) {
      rec.events.push({ id: ev.id, at: Date.now(), actor: 'Customer', stage: ev.stage, text: ev.text, detail: ev.detail });
      rec.events = rec.events.slice(-MAX_EVENTS);
    }
    if (ev.status === 'Purchased' && rec.status !== 'Purchased') {
      rec.status = 'Purchased'; rec.purchasedAt = Date.now(); rec.items = ev.items; rec.total = ev.total;
    } else if (ev.status === 'Viewed' && rec.status !== 'Purchased') rec.status = 'Viewed';
    rec.updatedAt = Date.now();
    const w = entry
      ? await s.setJSON(key, rec, { onlyIfMatch: entry.etag })
      : await s.setJSON(key, rec, { onlyIfNew: true });
    if (w.modified) return rec;
  }
  throw new HttpError(409, 'Please try again.');
}

async function statusOf(refsParam) {
  const refs = [...new Set(String(refsParam || '').split(',').filter(r => REF.test(r)))].slice(0, 20);
  const s = store();
  const found = await Promise.all(refs.map(r => s.get('sale/' + r, { type: 'json' })));
  const sales = {};
  refs.forEach((r, i) => { if (found[i]) sales[r] = found[i]; });
  return sales;
}

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/(api\/journey|journey-api)\/?/, '').replace(/\/$/, '');
  try {
    if (req.method === 'POST' && route === 'event') {
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-site request blocked.');
      let body = {};
      try { body = await req.json(); } catch { body = {}; }
      const rec = await addEvent(readEvent(body));
      return json(200, { ok: true, status: rec.status });
    }
    if (req.method === 'GET' && route === 'status') return json(200, { sales: await statusOf(url.searchParams.get('refs')) });
    throw new HttpError(404, 'Not found.');
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { message: e.message });
    console.log('journey-api error', e?.stack || String(e));
    return json(500, { message: 'Something went wrong.' });
  }
};

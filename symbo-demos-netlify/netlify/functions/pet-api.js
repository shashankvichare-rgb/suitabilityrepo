/* Netlify Function: Pet insurance demo API.
   Routes (POST JSON):  /api/health · /api/premium · /api/otp/send · /api/otp/verify · /api/payment/create · /api/payment/confirm
   Quote storage, KYC and resume links stay browser-local in this demo (see README → "Going to production").
   Place at: symbo-demos-netlify/netlify/functions/pet-api.js  (redirect /api/* → /.netlify/functions/pet-api/:splat) */
const crypto = require('crypto');
const E = require('../../symbo-suitability-github/demos/pet-insurance/petins/engine.js'); /* literal path so Netlify's bundler includes it */
const CFG = require('../../symbo-suitability-github/demos/pet-insurance/petins/config.js');
const SECRET = process.env.PET_API_SECRET || 'demo-secret-change-me';
const DEMO_OTP = process.env.PET_DEMO_OTP || CFG.demo.otp;

const sign = (obj) => { const b = Buffer.from(JSON.stringify(obj)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', SECRET).update(b).digest('base64url'); };
const unsign = (tok) => { const [b, s] = String(tok || '').split('.'); if (!b || s !== crypto.createHmac('sha256', SECRET).update(b).digest('base64url')) return null; const o = JSON.parse(Buffer.from(b, 'base64url').toString()); return o.exp && o.exp < Date.now() ? null : o; };
const json = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

const routes = {
  health: () => ({ ok: true, engine: 'pet-insurance', mode: 'mock' }),
  premium: (b) => E.quote(b),
  'otp/send': (b) => {
    if (E.V.mobile(b.mobile)) throw [400, 'Enter a valid 10-digit mobile number'];
    /* PROD: call SMS/OTP provider (e.g. MSG91, Gupshup) here. Never return the code. */
    return { requestId: sign({ m: b.mobile, exp: Date.now() + 5 * 60e3 }), expiresIn: 300, resendIn: 30, demoCode: DEMO_OTP };
  },
  'otp/verify': (b) => {
    const r = unsign(b.requestId); if (!r) throw [400, 'OTP expired. Request a new one.'];
    if (b.code !== DEMO_OTP) throw [400, 'Incorrect OTP'];
    return { verified: true, token: sign({ m: r.m, v: 1, exp: Date.now() + 24 * 3600e3 }) };
  },
  'payment/create': (b) => {
    /* Server re-prices from the quote input so the client can't change the amount. */
    const q = E.quote(b.quoteInput || {});
    if (b.amount && Math.abs(b.amount - q.total) > 1) throw [409, 'Price changed. Please review your quote.'];
    /* PROD: create a Razorpay/PayU order here and return its id + key. */
    return { orderId: sign({ q: b.quoteId, a: q.total, exp: Date.now() + 30 * 60e3 }), amount: q.total, currency: 'INR', gateway: 'mock' };
  },
  'payment/confirm': (b) => {
    const o = unsign(b.orderId); if (!o) throw [400, 'Payment session expired'];
    /* PROD: verify the gateway signature / webhook, then call the insurer's policy-issuance API. */
    if (b.simulate === 'fail') return { status: 'failed', reference: '11-8466-' + String(Date.now()).slice(-10) + '-00', amount: o.a };
    return { status: 'paid', paymentId: 'pay_' + crypto.randomBytes(6).toString('hex'), policy: { number: E.policyNumber(Date.now()), period: E.policyPeriod(), amount: o.a, issuedAt: Date.now() } };
  }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { message: 'POST only' });
  const route = (event.path || '').replace(/^.*\/(api|pet-api)\//, '').replace(/\/$/, '');
  const fn = routes[route]; if (!fn) return json(404, { message: 'Unknown route: ' + route });
  try { return json(200, await fn(JSON.parse(event.body || '{}'))); }
  catch (e) { return Array.isArray(e) ? json(e[0], { message: e[1] }) : json(500, { message: 'Server error' }); }
};

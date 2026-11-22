/* Symbo demo access: shared logic for the edge gate and the access API.
   Pure Web Crypto, no Node or Deno globals, so both runtimes can import it. */

export const STORE = 'symbo-access';
export const SESSION_COOKIE = 'symbo_access';
export const DEVICE_COOKIE = 'symbo_device';
export const TEAM_HOURS = 12;

/* Every gated demo. `prefixes` decide which demo a request belongs to.
   Add a row here when a new demo ships; guests can only open demos listed on their invite. */
export const DEMOS = [
  { id: 'widget', name: 'Embedded widget · LoanBee checkout', home: '/demos/loanbee-checkout/', prefixes: ['/demos/loanbee-checkout'] },
  { id: 'creditlife', name: 'Credit Life journey', home: '/demos/suitability-agent-journey/', prefixes: ['/demos/suitability-agent-journey'] },
  { id: 'agentjourney', name: 'Agent journey · Rohan (consumer durable)', home: '/demos/agent-journey/', prefixes: ['/demos/agent-journey', '/api/journey'] },
  { id: 'agent', name: 'Agent journey · consumer durables (earlier build)', home: '/demos/agent-suitaibility-demo/', prefixes: ['/demos/agent-suitaibility-demo', '/demos/agent-suitability-demo'] },
  { id: 'engine', name: 'Suitability engine', home: '/demos/suitabilityengine/', prefixes: ['/demos/suitabilityengine'] },
  { id: 'motor', name: 'Motor agent journey', home: '/demos/motor/', prefixes: ['/demos/motor'] },
  { id: 'pet', name: 'Pet insurance', home: '/demos/pet-insurance/', prefixes: ['/demos/pet-insurance', '/api/health', '/api/premium', '/api/otp', '/api/payment'] }
];
export const DEMO_IDS = DEMOS.map(d => d.id);

/* Paths anyone can load: the sign-in page, its assets, and the access API (which checks auth itself). */
export function isPublicPath(path) {
  if (path.startsWith('/access/admin')) return false;
  return path === '/access' || path.startsWith('/access/') || path.startsWith('/api/access/') ||
    path === '/favicon.ico' || path === '/robots.txt';
}

/* Paths every signed-in visitor may load regardless of invite scope (the hub and its logo). */
export function isHubPath(path) {
  return path === '/' || path === '/index.html' || path === '/symbo-logo.png';
}

export function demoForPath(path) {
  const p = path.toLowerCase();
  for (const d of DEMOS) for (const pre of d.prefixes) if (p === pre || p.startsWith(pre + '/') || p.startsWith(pre + '?')) return d.id;
  return null;
}

/* ── encoding ─────────────────────────────── */
const te = new TextEncoder();
const td = new TextDecoder();
export function b64u(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64u(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
export async function sha256Hex(value) {
  const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(String(value))));
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function randomId(bytes = 12) {
  return b64u(crypto.getRandomValues(new Uint8Array(bytes)));
}

/* ── secrets ──────────────────────────────── */
export function teamCode(env) {
  return env('ACCESS_TEAM_CODE') || env('DEMO_INDEX_PASSWORD') || '';
}
/* ACCESS_SIGNING_SECRET should be set. Falling back to a key derived from the team code keeps
   the first deploy working; changing the team code then signs everyone out, which is intended. */
export function signingSecret(env) {
  const s = env('ACCESS_SIGNING_SECRET');
  if (s && s.length >= 16) return s;
  const t = teamCode(env);
  return t ? 'derived-from-team-code:' + t : '';
}

const keyCache = new Map();
async function hmacKey(secret) {
  if (!keyCache.has(secret)) {
    keyCache.set(secret, crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  }
  return keyCache.get(secret);
}
export async function signToken(payload, secret) {
  const body = b64u(te.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), te.encode(body)));
  return body + '.' + b64u(sig);
}
export async function verifyToken(token, secret) {
  if (!token || !secret) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64u(sig), te.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(td.decode(fromB64u(body)));
    if (!payload.exp || payload.exp <= Date.now()) return null;
    return payload;
  } catch { return null; }
}
/* Constant-time comparison of two strings via their hashes. */
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0 && String(a).length > 0;
}

/* ── invite codes ─────────────────────────── */
/* 31 characters with no 0/O, 1/I/L. 8 characters ≈ 8.5 × 10^11 combinations. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newInviteCode() {
  const out = [];
  while (out.length < 8) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    for (const x of b) if (x < 248 && out.length < 8) out.push(ALPHABET[x % 31]);
  }
  return out.slice(0, 4).join('') + '-' + out.slice(4).join('');
}
export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export async function codeHash(code, secret) {
  return sha256Hex('code:' + secret + ':' + normalizeCode(code));
}

/* ── request helpers ──────────────────────── */
export function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return '';
}
export function cookie(name, value, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`;
}
export async function uaHash(request) {
  return (await sha256Hex('ua:' + (request.headers.get('user-agent') || ''))).slice(0, 16);
}
export function isDocumentRequest(request) {
  const dest = request.headers.get('sec-fetch-dest');
  if (dest) return dest === 'document' || dest === 'iframe';
  return (request.headers.get('accept') || '').includes('text/html');
}
/* Only allow same-site relative redirects after sign-in. */
export function safeNext(next) {
  const n = String(next || '');
  if (!n.startsWith('/') || n.startsWith('//') || n.startsWith('/\\') || n.startsWith('/access')) return '/';
  return n.slice(0, 500);
}

export const SECURITY_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

/* Invite status as the admin console and gate see it. */
export function inviteState(inv, now = Date.now()) {
  if (inv.status === 'revoked') return 'revoked';
  if (inv.status === 'locked') return 'locked';
  if (inv.firstAt) return now < inv.firstAt + inv.durationMin * 60e3 ? 'active' : 'ended';
  return now < inv.redeemBy ? 'unused' : 'expired';
}
export function inviteSessionEnd(inv) {
  return inv.firstAt ? inv.firstAt + inv.durationMin * 60e3 : null;
}

/* Symbo demo access API (Netlify Functions v2 + Netlify Blobs).
   Public:  POST team · POST redeem · POST signout · POST ping
   Team only: GET/POST admin/invites · POST admin/invites/:id/(revoke|extend) · GET admin/events · POST admin/team/signout-all */
import { getStore } from '@netlify/blobs';
import {
  STORE, SESSION_COOKIE, DEVICE_COOKIE, TEAM_HOURS, DEMOS, DEMO_IDS, teamCode, signingSecret, signToken, verifyToken,
  safeEqual, newInviteCode, normalizeCode, codeHash, getCookie, cookie, uaHash, randomId, sha256Hex,
  inviteState, inviteSessionEnd, safeNext
} from '../lib/access-core.mjs';

const env = key => process.env[key] || (globalThis.Netlify?.env?.get(key) ?? '');
const store = () => getStore({ name: STORE, consistency: 'strong' });

const MAX_IP_FAILURES = 10;
const IP_WINDOW_MS = 15 * 60e3;
const MAX_EMAIL_FAILURES = 5;

class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const json = (status, body, cookies = []) => {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers });
};
const clean = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

async function log(event) {
  const at = Date.now();
  const key = `event/${String(9e15 - at).padStart(16, '0')}-${randomId(4)}`; /* reverse time: newest first when listed */
  try { await store().setJSON(key, { at, ...event }); } catch (e) { console.log('access-api: log failed', String(e)); }
}

/* ── per-IP failure throttle ───────────────── */
async function ipKey(ip) { return 'ratelimit/' + (await sha256Hex('ip:' + ip)).slice(0, 24); }
async function checkThrottle(ip) {
  const rec = await store().get(await ipKey(ip), { type: 'json' });
  if (rec && rec.resetAt > Date.now() && rec.count >= MAX_IP_FAILURES) {
    throw new HttpError(429, 'Too many attempts. Wait 15 minutes, then try again.');
  }
}
async function recordFailure(ip) {
  const key = await ipKey(ip);
  const rec = await store().get(key, { type: 'json' });
  const fresh = !rec || rec.resetAt <= Date.now();
  await store().setJSON(key, { count: fresh ? 1 : rec.count + 1, resetAt: fresh ? Date.now() + IP_WINDOW_MS : rec.resetAt });
}

/* ── sessions ─────────────────────────────── */
async function currentSession(req) {
  return verifyToken(getCookie(req, SESSION_COOKIE), signingSecret(env));
}
async function requireTeam(req) {
  const s = await currentSession(req);
  if (!s || s.k !== 'team') throw new HttpError(401, 'Team sign-in required.');
  const cfg = await store().get('config/team-epoch', { type: 'json' });
  if ((cfg?.epoch || 0) > (s.ep || 0)) throw new HttpError(401, 'Team sessions were signed out. Sign in again.');
  return s;
}
function deviceCookie(req) {
  const existing = getCookie(req, DEVICE_COOKIE);
  const did = /^[A-Za-z0-9_-]{16,40}$/.test(existing) ? existing : randomId(16);
  return { did, set: cookie(DEVICE_COOKIE, did, 400 * 86400) };
}

/* ── public routes ────────────────────────── */
async function team(req, body, ip) {
  await checkThrottle(ip);
  const expected = teamCode(env);
  if (!expected) throw new HttpError(503, 'Team access is not configured yet.');
  const name = clean(body.name, 60);
  if (!name) throw new HttpError(400, 'Enter your name so the team log shows who signed in.');
  if (!(await safeEqual(String(body.code || ''), expected))) {
    await recordFailure(ip);
    await log({ type: 'team_signin_failed', name, ip });
    throw new HttpError(401, "That team code isn't right.");
  }
  const cfg = await store().get('config/team-epoch', { type: 'json' });
  const now = Date.now();
  const session = { v: 1, sid: randomId(), k: 'team', n: name, s: ['*'], iat: now, exp: now + TEAM_HOURS * 3600e3, ep: cfg?.epoch || 0, ua: await uaHash(req) };
  const token = await signToken(session, signingSecret(env));
  await log({ type: 'team_signin', name, sid: session.sid, ip });
  return json(200, { ok: true, next: safeNext(body.next), exp: session.exp }, [cookie(SESSION_COOKIE, token, TEAM_HOURS * 3600)]);
}

async function redeem(req, body, ip) {
  await checkThrottle(ip);
  const secret = signingSecret(env);
  if (!secret) throw new HttpError(503, 'Demo access is not configured yet.');
  const email = clean(body.email, 160).toLowerCase();
  const code = normalizeCode(body.code);
  if (!isEmail(email) || code.length !== 8) throw new HttpError(400, 'Enter the email you were invited with and the 8-character access code.');

  const s = store();
  const pointer = await s.get('code/' + await codeHash(code, secret), { type: 'json' });
  if (!pointer || (body.invite && body.invite !== pointer.id)) {
    await recordFailure(ip);
    await log({ type: 'redeem_failed', reason: 'unknown_code', email, ip });
    throw new HttpError(401, "That code and email don't match an invite.");
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const entry = await s.getWithMetadata('invite/' + pointer.id, { type: 'json' });
    if (!entry) throw new HttpError(401, "That code and email don't match an invite.");
    const inv = entry.data;
    const now = Date.now();
    const state = inviteState(inv, now);
    const base = { inviteId: inv.id, name: inv.name, email, ip, ua: req.headers.get('user-agent') || '' };

    if (state === 'revoked' || state === 'locked') {
      await log({ ...base, type: 'redeem_failed', reason: state });
      throw new HttpError(410, 'This invite is no longer active. Ask your Symbo contact for a new one.');
    }
    if (email !== inv.email) {
      inv.failed = (inv.failed || 0) + 1;
      if (inv.failed >= MAX_EMAIL_FAILURES) inv.status = 'locked';
      const w = await s.setJSON('invite/' + inv.id, inv, { onlyIfMatch: entry.etag });
      if (!w.modified) continue;
      await recordFailure(ip);
      await log({ ...base, type: inv.status === 'locked' ? 'invite_locked' : 'redeem_failed', reason: 'email_mismatch' });
      throw new HttpError(401, "That code and email don't match an invite.");
    }
    if (state === 'expired') {
      await log({ ...base, type: 'redeem_failed', reason: 'expired' });
      throw new HttpError(410, 'This invite expired before it was used. Ask your Symbo contact for a new one.');
    }
    if (state === 'ended') {
      await log({ ...base, type: 'redeem_failed', reason: 'ended' });
      throw new HttpError(410, 'Your viewing time for this invite has ended. Ask your Symbo contact if you need more time.');
    }

    const dev = deviceCookie(req);
    const ua = await uaHash(req);
    inv.devices = inv.devices || [];
    let device = inv.devices.find(d => d.did === dev.did);
    const isNewDevice = !device;
    if (!device) {
      if (inv.devices.length >= inv.maxDevices) {
        inv.blocked = (inv.blocked || 0) + 1;
        const w = await s.setJSON('invite/' + inv.id, inv, { onlyIfMatch: entry.etag });
        if (!w.modified) continue;
        await log({ ...base, type: 'reuse_blocked' });
        throw new HttpError(403, 'This invite was already opened on another device. Ask your Symbo contact for your own invite.');
      }
      device = { did: dev.did, at: now, ip, ua: base.ua.slice(0, 200) };
      inv.devices.push(device);
    }
    device.sid = randomId();
    device.lastAt = now;
    if (!inv.firstAt) inv.firstAt = now;
    const end = inviteSessionEnd(inv);
    const w = await s.setJSON('invite/' + inv.id, inv, { onlyIfMatch: entry.etag });
    if (!w.modified) continue;

    const session = { v: 1, sid: device.sid, k: 'guest', inv: inv.id, n: inv.name, e: inv.email, c: inv.company || '', s: inv.demos, iat: now, exp: end, ua };
    const token = await signToken(session, secret);
    await log({ ...base, type: isNewDevice ? 'invite_redeemed' : 'invite_resumed', sid: device.sid });
    const first = DEMOS.find(d => d.id === inv.demos[0]);
    const next = inv.demos.length === 1 && first ? first.home : '/';
    return json(200, { ok: true, next, exp: end }, [cookie(SESSION_COOKIE, token, (end - now) / 1000), dev.set]);
  }
  throw new HttpError(409, 'Please try again.');
}

async function signout(req) {
  const s = await currentSession(req);
  if (s) await log({ type: 'signout', sid: s.sid, inviteId: s.inv, name: s.n });
  return json(200, { ok: true }, [cookie(SESSION_COOKIE, '', 0)]);
}

async function ping(req, body) {
  const s = await currentSession(req);
  if (!s) throw new HttpError(401, 'Session ended.');
  if (s.k === 'team') {
    const cfg = await store().get('config/team-epoch', { type: 'json' });
    if ((cfg?.epoch || 0) > (s.ep || 0)) throw new HttpError(401, 'Session ended.');
    return json(200, { ok: true, exp: s.exp });
  }
  const st = store();
  const entry = await st.getWithMetadata('invite/' + s.inv, { type: 'json' });
  const inv = entry?.data;
  if (!inv || inviteState(inv) !== 'active' || !inv.devices?.some(d => d.sid === s.sid)) throw new HttpError(401, 'Session ended.');
  const path = clean(body.path, 200);
  inv.views = (inv.views || 0) + 1;
  inv.lastSeenAt = Date.now();
  inv.lastPath = path;
  await st.setJSON('invite/' + inv.id, inv, { onlyIfMatch: entry.etag });
  if (body.view) await log({ type: 'page_view', inviteId: inv.id, name: inv.name, email: inv.email, sid: s.sid, path });
  /* If the team extended or shortened the window, re-issue the cookie to match it. */
  const end = inviteSessionEnd(inv);
  if (end !== s.exp) {
    const token = await signToken({ ...s, exp: end }, signingSecret(env));
    return json(200, { ok: true, exp: end }, [cookie(SESSION_COOKIE, token, (end - Date.now()) / 1000)]);
  }
  return json(200, { ok: true, exp: end });
}

/* ── admin routes ─────────────────────────── */
function publicInvite(inv, now = Date.now()) {
  const { codeHash: _omit, ...rest } = inv;
  return { ...rest, state: inviteState(inv, now), sessionEnd: inviteSessionEnd(inv), deviceCount: inv.devices?.length || 0 };
}
async function listInvites() {
  const s = store();
  const { blobs } = await s.list({ prefix: 'invite/' });
  const invites = (await Promise.all(blobs.map(b => s.get(b.key, { type: 'json' })))).filter(Boolean);
  invites.sort((a, b) => b.createdAt - a.createdAt);
  return json(200, { invites: invites.map(i => publicInvite(i)), demos: DEMOS.map(({ id, name, home }) => ({ id, name, home })) });
}
async function createInvite(req, body, admin) {
  const secret = signingSecret(env);
  const name = clean(body.name, 80);
  const email = clean(body.email, 160).toLowerCase();
  const company = clean(body.company, 80);
  const note = clean(body.note, 240);
  const demos = [...new Set((Array.isArray(body.demos) ? body.demos : []).filter(d => DEMO_IDS.includes(d)))];
  const durationMin = Math.round(Number(body.durationMin) || 15);
  const maxDevices = Math.round(Number(body.maxDevices) || 1);
  const validHours = Math.round(Number(body.validHours) || 48);
  if (!name) throw new HttpError(400, "Add the recipient's name. It appears in their watermark.");
  if (!isEmail(email)) throw new HttpError(400, "Add the recipient's email. They need it to sign in.");
  if (!demos.length) throw new HttpError(400, 'Pick at least one demo.');
  if (durationMin < 5 || durationMin > 480) throw new HttpError(400, 'Viewing time must be 5 to 480 minutes.');
  if (maxDevices < 1 || maxDevices > 10) throw new HttpError(400, 'Devices must be 1 to 10.');
  if (validHours < 1 || validHours > 24 * 30) throw new HttpError(400, 'The invite must be usable for 1 hour to 30 days.');

  const s = store();
  for (let i = 0; i < 5; i++) {
    const code = newInviteCode();
    const hash = await codeHash(code, secret);
    const id = randomId(9);
    const claimed = await s.setJSON('code/' + hash, { id }, { onlyIfNew: true });
    if (!claimed.modified) continue;
    const now = Date.now();
    const inv = { id, codeHash: hash, name, email, company, note, demos, durationMin, maxDevices, createdAt: now, createdBy: admin.n, redeemBy: now + validHours * 3600e3, status: 'active', devices: [], views: 0, blocked: 0, failed: 0 };
    await s.setJSON('invite/' + id, inv);
    await log({ type: 'invite_created', inviteId: id, name, email, by: admin.n, demos });
    const origin = new URL(req.url).origin;
    return json(201, { invite: publicInvite(inv), code, link: `${origin}/access/?invite=${id}` });
  }
  throw new HttpError(500, 'Could not create a unique code. Try again.');
}
async function updateInvite(id, action, body, admin) {
  const s = store();
  for (let attempt = 0; attempt < 4; attempt++) {
    const entry = await s.getWithMetadata('invite/' + id, { type: 'json' });
    if (!entry) throw new HttpError(404, 'Invite not found.');
    const inv = entry.data;
    if (action === 'revoke') inv.status = 'revoked';
    else if (action === 'extend') {
      const add = Math.round(Number(body.minutes) || 15);
      if (add < 5 || add > 240) throw new HttpError(400, 'Extend by 5 to 240 minutes.');
      if (inv.status !== 'active') throw new HttpError(409, 'Only active invites can be extended.');
      inv.durationMin += add;
      if (!inv.firstAt) inv.redeemBy = Math.max(inv.redeemBy, Date.now()) + add * 60e3;
    } else if (action === 'unlock') {
      if (inv.status === 'locked') inv.status = 'active';
      inv.failed = 0;
    } else throw new HttpError(404, 'Unknown action.');
    const w = await s.setJSON('invite/' + id, inv, { onlyIfMatch: entry.etag });
    if (!w.modified) continue;
    await log({ type: 'invite_' + action, inviteId: id, name: inv.name, email: inv.email, by: admin.n, detail: action === 'extend' ? `+${body.minutes || 15} min` : '' });
    return json(200, { invite: publicInvite(inv) });
  }
  throw new HttpError(409, 'Please try again.');
}
async function listEvents(url) {
  const s = store();
  const inviteId = url.searchParams.get('invite');
  const { blobs } = await s.list({ prefix: 'event/' });
  const keys = blobs.map(b => b.key).sort().slice(0, inviteId ? 2000 : 300);
  let events = (await Promise.all(keys.map(k => s.get(k, { type: 'json' })))).filter(Boolean);
  if (inviteId) events = events.filter(e => e.inviteId === inviteId).slice(0, 300);
  return json(200, { events });
}
async function signoutAllTeam(admin) {
  const epoch = Date.now();
  await store().setJSON('config/team-epoch', { epoch, by: admin.n });
  await log({ type: 'team_signout_all', by: admin.n });
  return json(200, { ok: true }, [cookie(SESSION_COOKIE, '', 0)]);
}

/* ── router ───────────────────────────────── */
export default async (req, context) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/(api\/access|access-api)\/?/, '').replace(/\/$/, '');
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  try {
    if (req.method === 'POST') {
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-site request blocked.');
    }
    let body = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch { body = {}; } }

    if (req.method === 'POST' && route === 'team') return await team(req, body, ip);
    if (req.method === 'POST' && route === 'redeem') return await redeem(req, body, ip);
    if (req.method === 'POST' && route === 'signout') return await signout(req);
    if (req.method === 'POST' && route === 'ping') return await ping(req, body);
    if (req.method === 'GET' && route === 'session') {
      const s = await currentSession(req);
      return json(200, s ? { signedIn: true, kind: s.k, name: s.n, exp: s.exp } : { signedIn: false });
    }

    if (route.startsWith('admin/')) {
      const admin = await requireTeam(req);
      if (req.method === 'GET' && route === 'admin/invites') return await listInvites();
      if (req.method === 'POST' && route === 'admin/invites') return await createInvite(req, body, admin);
      const m = /^admin\/invites\/([A-Za-z0-9_-]+)\/(revoke|extend|unlock)$/.exec(route);
      if (req.method === 'POST' && m) return await updateInvite(m[1], m[2], body, admin);
      if (req.method === 'GET' && route === 'admin/events') return await listEvents(url);
      if (req.method === 'POST' && route === 'admin/team/signout-all') return await signoutAllTeam(admin);
    }
    throw new HttpError(404, 'Not found.');
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { message: e.message, ...(e.extra || {}) });
    console.log('access-api error', e?.stack || String(e));
    return json(500, { message: 'Something went wrong. Try again.' });
  }
};

/* Symbo demo access gate. Runs in front of every path on symbo.si.
   No valid session → sign-in page. Guests only reach the demos on their invite.
   HTML pages get the session layer (watermark, countdown, sign-out) injected. */
import { getStore } from '@netlify/blobs';
import {
  STORE, SESSION_COOKIE, DEMOS, isPublicPath, isHubPath, demoForPath, signingSecret, verifyToken,
  getCookie, cookie, uaHash, isDocumentRequest, SECURITY_HEADERS, inviteState, inviteSessionEnd
} from '../lib/access-core.mjs';

const env = key => Netlify.env.get(key);

function withHeaders(response, extra = {}) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function redirect(location, clear = false) {
  const headers = { Location: location, ...SECURITY_HEADERS };
  const res = new Response(null, { status: 302, headers });
  if (clear) res.headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', 0));
  return res;
}
function deny(request, reason, status = 401) {
  if (isDocumentRequest(request)) {
    const url = new URL(request.url);
    const next = encodeURIComponent(url.pathname + url.search);
    return redirect(`/access/?reason=${reason}&next=${next}`, status === 401);
  }
  return new Response(JSON.stringify({ message: 'Sign in to view this Symbo demo.', reason }), {
    status, headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
  });
}
function scopePage(session) {
  const allowed = DEMOS.filter(d => session.s.includes(d.id));
  const links = allowed.map(d => `<a href="${d.home}">${d.name} →</a>`).join('');
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not on your invite · Symbo</title>
<link rel="stylesheet" href="/access/access.css"></head><body class="plain"><main class="notice-card"><img src="/access/symbo-logo.png" alt="Symbo" class="notice-logo">
<p class="eyebrow">NOT ON YOUR INVITE</p><h1>This demo wasn't shared with you.</h1><p>Your invite covers the demos below. Ask your Symbo contact if you need access to more.</p>
<div class="notice-links">${links}</div></main></body></html>`, {
    status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS }
  });
}

/* Revocation, lock and team-wide sign-out are checked on page loads only, to keep asset requests fast.
   If the store is unreachable the signed cookie still stands; it expires on its own. */
async function stillValid(session) {
  try {
    const store = getStore({ name: STORE, consistency: 'strong' });
    if (session.k === 'team') {
      const cfg = await store.get('config/team-epoch', { type: 'json' });
      return (cfg?.epoch || 0) <= (session.ep || 0);
    }
    const inv = await store.get('invite/' + session.inv, { type: 'json' });
    if (!inv) return false;
    const state = inviteState(inv);
    if (state !== 'active') return false;
    if (!inv.devices?.some(d => d.sid === session.sid)) return false;
    session.exp = Math.min(session.exp, inviteSessionEnd(inv) || session.exp);
    return true;
  } catch (e) {
    console.log('access-gate: store check skipped', String(e));
    return true;
  }
}

function sessionLayer(session) {
  const data = {
    k: session.k, n: session.n || '', e: session.e || '', c: session.c || '', exp: session.exp,
    demos: session.s.includes('*') ? DEMOS.filter(d => !d.hidden).map(d => ({ id: d.id, name: d.name, home: d.home }))
      : DEMOS.filter(d => session.s.includes(d.id)).map(d => ({ id: d.id, name: d.name, home: d.home }))
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');
  return `<script>window.__SYMBO_SESSION=${json};</script><script src="/access/session.js" defer></script>`;
}

export default async function gate(request, context) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (isPublicPath(path)) {
    const res = await context.next();
    return withHeaders(res);
  }

  const secret = signingSecret(env);
  if (!secret) {
    return new Response('Symbo demos are awaiting access configuration. Set ACCESS_TEAM_CODE and ACCESS_SIGNING_SECRET in Netlify.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS }
    });
  }

  const session = await verifyToken(getCookie(request, SESSION_COOKIE), secret);
  if (!session) return deny(request, getCookie(request, SESSION_COOKIE) ? 'expired' : 'signin');
  if (session.ua && session.ua !== await uaHash(request)) return deny(request, 'device');

  const isTeam = session.k === 'team';
  if (path.startsWith('/access/admin') && !isTeam) return redirect('/');

  const demo = demoForPath(path);
  if (!isTeam) {
    if (demo && !session.s.includes(demo)) return isDocumentRequest(request) ? scopePage(session) : deny(request, 'scope', 403);
    if (!demo && !isHubPath(path)) return isDocumentRequest(request) ? scopePage(session) : deny(request, 'scope', 403);
    if ((path === '/' || path === '/index.html') && session.s.length === 1) {
      const only = DEMOS.find(d => d.id === session.s[0]);
      if (only) return redirect(only.home);
    }
  }

  const doc = isDocumentRequest(request);
  if (doc && !(await stillValid(session))) return deny(request, isTeam ? 'signedout' : 'ended');

  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!doc || !type.includes('text/html') || response.status >= 300 || path.startsWith('/access/admin')) return withHeaders(response);

  const html = await response.text();
  const layer = sessionLayer(session);
  const at = html.toLowerCase().lastIndexOf('</body>');
  const out = at === -1 ? html + layer : html.slice(0, at) + layer + html.slice(at);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(out, { status: response.status, headers });
}

export const config = {
  path: '/*',
  excludedPath: ['/.netlify/*']
};

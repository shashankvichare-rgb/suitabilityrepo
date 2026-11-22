/* Symbo demo session layer. Injected by the access gate into every gated page.
   Guests: name/email watermark, countdown pill, auto sign-out, revocation check every 45 s.
   Team: a small pill with links to the hub and the access console. */
(() => {
  const S = window.__SYMBO_SESSION;
  if (!S || window.__symboLayer) return;
  window.__symboLayer = true;
  const guest = S.k !== 'team';
  let exp = S.exp;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stamp = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  function watermarkUrl() {
    const line1 = [S.n, S.c].filter(Boolean).join(' · ');
    const line2 = `${S.e} · ${stamp}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240"><g transform="rotate(-24 210 120)" font-family="Inter, Arial, sans-serif" fill="#013a51" text-anchor="middle"><text x="210" y="112" font-size="15" font-weight="600">${esc(line1)}</text><text x="210" y="134" font-size="12">${esc(line2)}</text><text x="210" y="154" font-size="10" letter-spacing="2">SYMBO · CONFIDENTIAL DEMO</text></g></svg>`;
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }

  const css = `
  :host { all: initial; }
  .wm { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; background-image: var(--wm); background-repeat: repeat; opacity: .075; }
  @media print { .wm { opacity: .22; } }
  .pill { position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 12px;
    background: rgba(1,26,20,.92); color: #fff; border: 1px solid rgba(255,255,255,.12); border-radius: 9999px; font: 500 12px/1 Inter, system-ui, -apple-system, sans-serif;
    box-shadow: 0 10px 30px -10px rgba(0,0,0,.45); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); transition: opacity .2s, transform .2s; }
  .pill.min { padding: 8px; }
  .pill.min .body { display: none; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #00c98f; flex: none; box-shadow: 0 0 0 4px rgba(0,201,143,.18); }
  .pill.warn .dot { background: #fdd340; box-shadow: 0 0 0 4px rgba(253,211,64,.2); }
  .pill.end .dot { background: #ff7c7c; box-shadow: 0 0 0 4px rgba(255,124,124,.2); }
  .body { display: flex; align-items: center; gap: 10px; }
  .who { color: rgba(255,255,255,.7); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .time { font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; font-size: 12px; color: #fff; letter-spacing: .04em; }
  .pill.warn .time { color: #fdd340; }
  a, button { all: unset; cursor: pointer; font: 600 12px/1 Inter, system-ui, sans-serif; color: #fff; padding: 7px 10px; border-radius: 9999px; border: 1px solid rgba(255,255,255,.16); }
  a:hover, button:hover { border-color: #00c98f; color: #00c98f; }
  button.min-btn { border: 0; padding: 4px 6px; color: rgba(255,255,255,.6); }
  .sep { width: 1px; height: 16px; background: rgba(255,255,255,.18); }
  .banner { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); z-index: 2147483647; background: #013a51; color: #fff; padding: 12px 16px; border-radius: 12px;
    font: 500 14px/1.4 Inter, system-ui, sans-serif; box-shadow: 0 20px 40px -12px rgba(0,0,0,.4); display: none; max-width: calc(100vw - 32px); }
  .banner.show { display: block; }
  @media (max-width: 560px) { .who { display: none; } .pill { left: 10px; bottom: 10px; } }
  `;

  function build() {
    const host = document.createElement('symbo-access-layer');
    const root = host.attachShadow({ mode: 'closed' });
    const fmtWho = guest ? esc([S.n, S.c].filter(Boolean).join(' · ')) : 'Team · ' + esc(S.n);
    root.innerHTML = `<style>${css}</style>${guest ? `<div class="wm" style="--wm:${watermarkUrl().replace(/"/g, '&quot;')}"></div>` : ''}
      <div class="banner" role="status"></div>
      <div class="pill" role="region" aria-label="Demo session">
        <span class="dot"></span>
        <span class="body">
          <span class="who">${fmtWho}</span>
          ${guest ? '<span class="sep"></span><span class="time" aria-live="off">--:--</span>' : ''}
          ${!guest ? '<a href="/" title="Demo hub">Hub</a><a href="/access/admin/" title="Share demos">Share access</a>' : (S.demos.length > 1 ? '<a href="/">All demos</a>' : '')}
          <button class="out" type="button">Sign out</button>
        </span>
        ${!guest ? '<button class="min-btn" type="button" aria-label="Collapse">–</button>' : ''}
      </div>`;
    root.querySelector('.out').onclick = signOut;
    const minBtn = root.querySelector('.min-btn');
    if (minBtn) minBtn.onclick = () => {
      const p = root.querySelector('.pill');
      p.classList.toggle('min');
      minBtn.textContent = p.classList.contains('min') ? '+' : '–';
      try { sessionStorage.setItem('symbo-pill-min', p.classList.contains('min') ? '1' : ''); } catch {}
    };
    try { if (!guest && sessionStorage.getItem('symbo-pill-min')) minBtn?.click(); } catch {}
    return { host, root };
  }

  let layer = null;
  function ensure() {
    if (!document.body) return;
    if (!layer) layer = build();
    if (!layer.host.isConnected) document.body.appendChild(layer.host);
  }

  async function signOut() {
    try { await fetch('/api/access/signout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch {}
    location.replace('/access/?reason=signedoutself');
  }
  function endSession(reason) { location.replace('/access/?reason=' + reason); }

  function tick() {
    ensure();
    if (!guest || !layer) return;
    const left = Math.max(0, exp - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    const t = layer.root.querySelector('.time');
    if (t) t.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} left`;
    const pill = layer.root.querySelector('.pill');
    pill.classList.toggle('warn', left < 3 * 60e3 && left > 0);
    pill.classList.toggle('end', left === 0);
    const banner = layer.root.querySelector('.banner');
    if (left < 2 * 60e3 && left > 0 && !banner.dataset.shown) {
      banner.textContent = 'Your demo session ends in under 2 minutes.';
      banner.classList.add('show');
      banner.dataset.shown = '1';
      setTimeout(() => banner.classList.remove('show'), 6000);
    }
    if (left === 0) endSession('ended');
  }

  async function ping(view) {
    try {
      const res = await fetch('/api/access/ping', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: location.pathname + location.hash.replace(/#.{12,}/, '#…'), view })
      });
      if (res.status === 401) return endSession(guest ? 'ended' : 'signedout');
      const data = await res.json();
      if (data.exp) exp = data.exp;
    } catch {}
  }

  setInterval(tick, 1000);
  document.addEventListener('DOMContentLoaded', tick);
  tick();
  ping(true);
  setInterval(() => ping(false), 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(false); });
})();

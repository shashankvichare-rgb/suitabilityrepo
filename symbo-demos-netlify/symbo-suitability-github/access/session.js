/* Symbo demo session layer. Injected by the access gate into every gated page.
   A corner menu button: who is signed in, the demos they can open, share access (team) and sign out.
   Guests also get a name/email watermark, a countdown, auto sign-out and a revocation check every 45 s.
   A page can lift the button above its own bottom bar with <body data-symbo-menu-bottom="84">. */
(() => {
  const S = window.__SYMBO_SESSION;
  if (!S || window.__symboLayer) return;
  window.__symboLayer = true;
  const guest = S.k !== 'team';
  let exp = S.exp;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stamp = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const initials = String(S.n || 'S').trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();

  /* Install as an app: every gated page gets the manifest and home-screen icon, so "Install" / "Add to Home Screen"
     works from wherever the visitor is. Chrome and Edge raise beforeinstallprompt; iOS needs the Share menu. */
  (function appMeta() {
    const head = document.head;
    if (!head || head.querySelector('link[rel="manifest"]')) return;
    const add = (tag, attrs) => { const el = document.createElement(tag); for (const k in attrs) el.setAttribute(k, attrs[k]); head.appendChild(el); };
    add('link', { rel: 'manifest', href: '/access/app/manifest.webmanifest' });
    add('link', { rel: 'apple-touch-icon', href: '/access/app/apple-touch-icon.png' });
    add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-title', content: 'Symbo' });
    add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' });
  })();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installEvent = null, showInstall = () => {};
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; showInstall(); });
  window.addEventListener('appinstalled', () => { installEvent = null; showInstall(); });

  function watermarkUrl() {
    const line1 = [S.n, S.c].filter(Boolean).join(' · ');
    const line2 = `${S.e} · ${stamp}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240"><g transform="rotate(-24 210 120)" font-family="Inter, Arial, sans-serif" fill="#013a51" text-anchor="middle"><text x="210" y="112" font-size="15" font-weight="600">${esc(line1)}</text><text x="210" y="134" font-size="12">${esc(line2)}</text><text x="210" y="154" font-size="10" letter-spacing="2">SYMBO · CONFIDENTIAL DEMO</text></g></svg>`;
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }

  const css = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .wm { position: fixed; inset: 0; pointer-events: none; z-index: 2147483645; background-image: var(--wm); background-repeat: repeat; opacity: .075; }
  @media print { .wm { opacity: .22; } .fab, .menu { display: none; } }
  .fab { position: fixed; left: 14px; bottom: var(--b, 14px); z-index: 2147483647; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border: 1px solid rgba(255,255,255,.14);
    background: rgba(1,26,20,.94); color: #fff; border-radius: 14px; cursor: pointer; font: 600 12px/1 Inter, system-ui, -apple-system, sans-serif; box-shadow: 0 12px 30px -10px rgba(0,0,0,.5); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); transition: transform .15s, border-color .15s, bottom .2s; }
  .fab:hover { border-color: #00c98f; transform: translateY(-1px); } .fab:focus-visible { outline: 2px solid #00c98f; outline-offset: 2px; }
  .bars { width: 18px; height: 14px; position: relative; flex: none; } .bars i { position: absolute; left: 0; right: 0; height: 2px; border-radius: 2px; background: #fff; transition: transform .2s, opacity .2s, top .2s; }
  .bars i:nth-child(1) { top: 0; } .bars i:nth-child(2) { top: 6px; } .bars i:nth-child(3) { top: 12px; }
  .open .bars i:nth-child(1) { top: 6px; transform: rotate(45deg); } .open .bars i:nth-child(2) { opacity: 0; } .open .bars i:nth-child(3) { top: 6px; transform: rotate(-45deg); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #00c98f; box-shadow: 0 0 0 3px rgba(0,201,143,.2); flex: none; }
  .warn .dot { background: #fdd340; box-shadow: 0 0 0 3px rgba(253,211,64,.22); } .end .dot { background: #ff7c7c; }
  .time { font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; font-size: 12px; letter-spacing: .03em; } .warn .time { color: #fdd340; }
  .menu { position: fixed; left: 14px; bottom: calc(var(--b, 14px) + 54px); z-index: 2147483647; width: 292px; max-height: calc(100vh - 90px); overflow-y: auto; background: #011a14; color: #fff; border: 1px solid rgba(255,255,255,.12); border-radius: 16px;
    box-shadow: 0 24px 60px -16px rgba(0,0,0,.6); font: 500 13px/1.4 Inter, system-ui, -apple-system, sans-serif; padding: 12px; opacity: 0; transform: translateY(8px) scale(.98); transform-origin: bottom left; pointer-events: none; transition: opacity .16s ease, transform .16s ease; }
  .open + .menu { opacity: 1; transform: none; pointer-events: auto; }
  .me { display: flex; align-items: center; gap: 10px; padding: 4px 4px 12px; border-bottom: 1px solid rgba(255,255,255,.1); }
  .av { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(180deg, #006d41, #00d182); display: grid; place-items: center; font-weight: 700; font-size: 13px; flex: none; }
  .me b { display: block; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; } .me small { font-size: 11.5px; color: rgba(255,255,255,.6); }
  .left { margin: 10px 4px 2px; } .left div { display: flex; justify-content: space-between; font-size: 11.5px; color: rgba(255,255,255,.7); margin-bottom: 5px; } .left span { font-family: 'JetBrains Mono', ui-monospace, monospace; color: #fff; }
  .bar { height: 5px; border-radius: 99px; background: rgba(255,255,255,.12); overflow: hidden; } .bar i { display: block; height: 100%; background: linear-gradient(90deg, #00d182 25%, #fdd340 84%); border-radius: 99px; transition: width 1s linear; }
  .sec { font: 500 9.5px 'JetBrains Mono', ui-monospace, monospace; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.45); margin: 12px 6px 4px; }
  [hidden] { display: none !important; }
  a, button.item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 10px; cursor: pointer; color: rgba(255,255,255,.88); font: 500 13px/1.3 Inter, system-ui, sans-serif; }
  a:hover, button.item:hover, a:focus-visible, button.item:focus-visible { background: rgba(255,255,255,.08); color: #fff; }
  a.cur { background: rgba(0,201,143,.16); color: #fff; box-shadow: inset 3px 0 0 #00c98f; }
  svg { width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: .8; }
  .out { color: #ffb3ab !important; margin-top: 6px; border-top: 1px solid rgba(255,255,255,.1); border-radius: 0 0 10px 10px; padding-top: 12px !important; }
  .banner { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); z-index: 2147483647; background: #013a51; color: #fff; padding: 12px 16px; border-radius: 12px; font: 500 14px/1.4 Inter, system-ui, sans-serif; box-shadow: 0 20px 40px -12px rgba(0,0,0,.4); display: none; max-width: calc(100vw - 32px); }
  .banner.show { display: block; }
  @media (max-width: 560px) {
    .fab { left: 10px; height: 42px; } .fab .who { display: none; }
    .menu { left: 8px; right: 8px; width: auto; bottom: calc(var(--b, 14px) + 52px); }
  }`;
  const ICON = {
    grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    play: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/></svg>',
    share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.7 15.4 6.5M8.6 13.3l6.8 4.2"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    app: '<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 7v7M9 11.5l3 3 3-3M10 18.5h4"/></svg>'
  };

  function build() {
    const host = document.createElement('symbo-access-layer');
    const root = host.attachShadow({ mode: 'closed' });
    const here = location.pathname;
    const demos = (S.demos || []).map(d => `<a href="${esc(d.home)}" class="${here.startsWith(d.home.replace(/\/$/, '')) ? 'cur' : ''}">${ICON.play}<span>${esc(d.name)}</span></a>`).join('');
    const showHub = !guest || (S.demos || []).length > 1;
    root.innerHTML = `<style>${css}</style>${guest ? `<div class="wm" style="--wm:${watermarkUrl().replace(/"/g, '&quot;')}"></div>` : ''}
      <div class="banner" role="status"></div>
      <button class="fab" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Demo menu"><span class="bars"><i></i><i></i><i></i></span>${guest ? '<span class="time">--:--</span>' : `<span class="who">${esc(initials)}</span>`}<span class="dot"></span></button>
      <nav class="menu" aria-label="Demo menu">
        <div class="me"><span class="av">${esc(initials)}</span><div><b>${esc(S.n || 'Guest')}</b><small>${guest ? esc(S.c || S.e || 'Invited guest') : 'Symbo team'}</small></div></div>
        ${guest ? '<div class="left"><div>Time left<span class="t2">--:--</span></div><div class="bar"><i style="width:100%"></i></div></div>' : ''}
        ${showHub ? `<p class="sec">Go to</p><a href="/" class="${here === '/' ? 'cur' : ''}">${ICON.grid}<span>All demos</span></a>` : ''}
        ${demos ? `<p class="sec">Demos</p>${demos}` : ''}
        ${!guest ? `<p class="sec">Team</p><a href="/access/admin/">${ICON.share}<span>Share access</span></a>` : ''}
        <button class="item inst" type="button" hidden>${ICON.app}<span>${ios ? 'Add to Home Screen' : 'Install as an app'}</span></button>
        <button class="item out" type="button">${ICON.out}<span>Sign out</span></button>
      </nav>`;
    const inst = root.querySelector('.inst'), banner = root.querySelector('.banner');
    showInstall = () => { inst.hidden = standalone || !(installEvent || ios); };
    showInstall();
    inst.onclick = async () => {
      if (installEvent) { const ev = installEvent; installEvent = null; ev.prompt(); try { await ev.userChoice; } catch {} showInstall(); return; }
      banner.textContent = 'Tap the Share button, then "Add to Home Screen".';
      banner.classList.add('show'); setTimeout(() => banner.classList.remove('show'), 7000);
    };
    const fab = root.querySelector('.fab');
    const toggle = open => { const on = open ?? !fab.classList.contains('open'); fab.classList.toggle('open', on); fab.setAttribute('aria-expanded', String(on)); };
    fab.onclick = e => { e.stopPropagation(); toggle(); };
    root.querySelector('.menu').onclick = e => e.stopPropagation();
    root.querySelector('.out').onclick = signOut;
    document.addEventListener('click', () => toggle(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
    return { host, root, fab, total: Math.max(1, exp - Date.now()) };
  }

  let layer = null;
  function ensure() {
    if (!document.body) return;
    if (!layer) layer = build();
    if (!layer.host.isConnected) document.body.appendChild(layer.host);
    const lift = Number(document.body.dataset.symboMenuBottom) || 14;
    layer.host.style.setProperty('--b', lift + 'px');
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
    const txt = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const t = layer.root.querySelector('.time'), t2 = layer.root.querySelector('.t2'), bar = layer.root.querySelector('.bar i');
    if (t) t.textContent = txt; if (t2) t2.textContent = txt + ' left';
    layer.total = Math.max(layer.total, left);
    if (bar) bar.style.width = Math.round(left / layer.total * 100) + '%';
    layer.fab.classList.toggle('warn', left < 3 * 60e3 && left > 0);
    layer.fab.classList.toggle('end', left === 0);
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

/* Symbo access console */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = t => t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const mins = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 120 ? Math.round(m / 60) + ' h' : m + ' min'; };
  const S = { invites: [], demos: [], filter: 'all', tab: 'invites', eventScope: '', last: null };

  function toast(text) {
    const t = $('#toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(S.tt); S.tt = setTimeout(() => t.classList.remove('show'), 3200);
  }
  async function api(path, body) {
    const res = await fetch('/api/access/' + path, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { location.replace('/access/?reason=expired&next=/access/admin/'); throw new Error('Signed out'); }
    if (!res.ok) throw new Error(data.message || 'Something went wrong.');
    return data;
  }

  const STATE = {
    active: ['green', 'Viewing'], unused: ['blue', 'Not opened'], ended: ['gray', 'Finished'],
    expired: ['gray', 'Expired unused'], revoked: ['red', 'Revoked'], locked: ['red', 'Locked']
  };
  const FILTERS = [['all', 'All'], ['active', 'Viewing'], ['unused', 'Not opened'], ['flagged', 'Flagged'], ['closed', 'Closed']];
  const matches = (i, f) => f === 'all' || (f === 'flagged' ? (i.blocked > 0 || i.state === 'locked' || i.failed > 0) : f === 'closed' ? ['ended', 'expired', 'revoked', 'locked'].includes(i.state) : i.state === f);

  function renderDemoPicks() {
    $('#demo-picks').innerHTML = S.demos.map(d => `<label class="demo-pick"><input type="checkbox" name="demos" value="${esc(d.id)}"><span>${esc(d.name)}</span></label>`).join('');
  }
  function renderStats() {
    const weekAgo = Date.now() - 7 * 864e5;
    $('#st-active').textContent = S.invites.filter(i => i.state === 'active').length;
    $('#st-unused').textContent = S.invites.filter(i => i.state === 'unused').length;
    $('#st-week').textContent = S.invites.filter(i => i.createdAt > weekAgo).length;
    $('#st-blocked').textContent = S.invites.reduce((n, i) => n + (i.blocked || 0), 0);
    $('#count-invites').textContent = String(S.invites.length).padStart(2, '0');
  }
  function renderFilters() {
    $('#filters').innerHTML = FILTERS.map(([id, label]) => {
      const n = S.invites.filter(i => matches(i, id)).length;
      return `<button type="button" data-filter="${id}" aria-pressed="${S.filter === id}">${label} <span style="opacity:.6;font-family:var(--font-mono);font-size:11px">${n}</span></button>`;
    }).join('');
    $$('[data-filter]').forEach(b => b.onclick = () => { S.filter = b.dataset.filter; renderInvites(); });
  }
  function timeCell(i) {
    const now = Date.now();
    if (i.state === 'active') return `<b>${mins(i.sessionEnd - now)} left</b>`;
    if (i.state === 'unused') return `<b>Opens within ${mins(i.redeemBy - now)}</b>`;
    if (i.firstAt) return `<b>${i.durationMin} min used</b>`;
    return '<b>—</b>';
  }
  function renderInvites() {
    renderFilters();
    const list = S.invites.filter(i => matches(i, S.filter));
    if (!S.invites.length) {
      $('#invite-list').innerHTML = '<div class="empty"><h3>No invites yet</h3><p>Create one on the left. It appears here with live status.</p></div>';
      return;
    }
    if (!list.length) { $('#invite-list').innerHTML = '<div class="empty"><p>Nothing in this view.</p></div>'; return; }
    const names = Object.fromEntries(S.demos.map(d => [d.id, d.name]));
    $('#invite-list').innerHTML = list.map(i => {
      const [tone, label] = STATE[i.state] || ['gray', i.state];
      const flagged = i.blocked > 0 || i.state === 'locked';
      const open = ['active', 'unused'].includes(i.state);
      return `<article class="invite ${flagged ? 'flag' : ''}">
        <div class="who">
          <h3>${esc(i.name)} <span class="tag ${tone}">${i.state === 'active' ? '<span class="dot"></span>' : ''}${label}</span>${flagged ? '<span class="tag red">Possible forwarding</span>' : ''}</h3>
          <p>${esc([i.company, i.email].filter(Boolean).join(' · '))} · created ${when(i.createdAt)} by ${esc(i.createdBy || 'team')}${i.note ? ' · ' + esc(i.note) : ''}</p>
        </div>
        <div class="actions">
          ${open ? `<button class="btn secondary small" data-act="extend" data-id="${i.id}">+15 min</button>` : ''}
          ${i.state === 'locked' ? `<button class="btn secondary small" data-act="unlock" data-id="${i.id}">Unlock</button>` : ''}
          <button class="btn secondary small" data-act="log" data-id="${i.id}">Activity</button>
          ${open || i.state === 'locked' ? `<button class="btn danger small" data-act="revoke" data-id="${i.id}">Revoke</button>` : ''}
        </div>
        <div class="chips">${i.demos.map(d => `<span class="chip">${esc(names[d] || d)}</span>`).join('')}<span class="chip">${i.durationMin} min window</span><span class="chip">${i.maxDevices} device${i.maxDevices > 1 ? 's' : ''}</span></div>
        <div class="meta">
          <div><span>Time</span>${timeCell(i)}</div>
          <div><span>Devices</span><b>${i.deviceCount} / ${i.maxDevices}</b></div>
          <div><span>Page views</span><b>${i.views || 0}${i.lastSeenAt ? ` · ${when(i.lastSeenAt)}` : ''}</b></div>
          <div><span>Blocked / wrong email</span><b class="${flagged || i.failed ? 'bad' : ''}">${i.blocked || 0} / ${i.failed || 0}</b></div>
        </div>
      </article>`;
    }).join('');
    $$('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b.dataset.id, b));
  }

  async function act(action, id, btn) {
    const inv = S.invites.find(i => i.id === id);
    if (action === 'log') { S.eventScope = id; switchTab('activity'); return; }
    if (action === 'revoke' && !confirmInline(btn, 'Confirm revoke')) return;
    btn.disabled = true;
    try {
      await api(`admin/invites/${id}/${action}`, action === 'extend' ? { minutes: 15 } : {});
      toast(action === 'revoke' ? `Revoked ${inv.name}'s access. Their page closes within a minute.` : action === 'extend' ? `Added 15 minutes for ${inv.name}.` : 'Invite unlocked.');
      await load();
    } catch (e) { toast(e.message); btn.disabled = false; }
  }
  /* Two-step confirm without browser dialogs: first click arms the button. */
  function confirmInline(btn, label) {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = '1';
    const old = btn.textContent;
    btn.textContent = label;
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 3500);
    return false;
  }

  const EVENT = {
    invite_created: 'Invite created', invite_redeemed: 'Opened on a new device', invite_resumed: 'Signed in again (same device)',
    page_view: 'Viewed page', reuse_blocked: 'Blocked: another device tried this invite', redeem_failed: 'Failed sign-in',
    invite_locked: 'Locked after wrong emails', invite_revoke: 'Revoked', invite_extend: 'Extended', invite_unlock: 'Unlocked',
    team_signin: 'Team sign-in', team_signin_failed: 'Failed team sign-in', team_signout_all: 'All team sessions signed out', signout: 'Signed out'
  };
  const BAD = new Set(['reuse_blocked', 'redeem_failed', 'invite_locked', 'team_signin_failed']);
  async function loadEvents() {
    const scope = S.eventScope ? S.invites.find(i => i.id === S.eventScope) : null;
    $('#activity-scope').innerHTML = scope
      ? `<button type="button" aria-pressed="true">${esc(scope.name)}</button><button type="button" id="all-events">Show everyone</button>`
      : '<button type="button" aria-pressed="true">Everyone · latest 300</button>';
    const all = $('#all-events'); if (all) all.onclick = () => { S.eventScope = ''; loadEvents(); };
    $('#events').innerHTML = '<tr><td colspan="4" class="mono">Loading…</td></tr>';
    try {
      const { events } = await api('admin/events' + (S.eventScope ? '?invite=' + encodeURIComponent(S.eventScope) : ''));
      $('#events').innerHTML = events.length ? events.map(e => {
        const detail = [e.path, e.reason && e.reason.replace(/_/g, ' '), e.detail, e.by && 'by ' + e.by, e.ip && e.ip !== 'unknown' && 'IP ' + e.ip, e.ua && shortUa(e.ua)].filter(Boolean).join(' · ');
        return `<tr class="${BAD.has(e.type) ? 'bad' : ''}"><td class="mono">${when(e.at)}</td><td>${BAD.has(e.type) ? '<span class="tag red">' + esc(EVENT[e.type] || e.type) + '</span>' : esc(EVENT[e.type] || e.type)}</td><td>${esc(e.name || '')}${e.email ? '<br><span class="muted small">' + esc(e.email) + '</span>' : ''}</td><td class="muted small">${esc(detail)}</td></tr>`;
      }).join('') : '<tr><td colspan="4" class="mono">No activity yet.</td></tr>';
    } catch (e) { $('#events').innerHTML = `<tr><td colspan="4">${esc(e.message)}</td></tr>`; }
  }
  function shortUa(ua) {
    const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
    const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
    return [br, os].filter(Boolean).join(' on ');
  }

  function switchTab(tab) {
    S.tab = tab;
    $$('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $('#panel-invites').hidden = tab !== 'invites';
    $('#panel-activity').hidden = tab !== 'activity';
    if (tab === 'activity') loadEvents();
  }
  $$('[data-tab]').forEach(b => b.onclick = () => { if (b.dataset.tab === 'activity') S.eventScope = ''; switchTab(b.dataset.tab); });

  async function load() {
    const data = await api('admin/invites');
    S.invites = data.invites;
    if (!S.demos.length) { S.demos = data.demos; renderDemoPicks(); }
    renderStats();
    renderInvites();
  }

  $('#create').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const err = $('#create-error');
    err.classList.remove('show');
    const f = new FormData(form);
    const body = {
      name: f.get('name'), company: f.get('company'), email: f.get('email'), note: f.get('note'),
      demos: f.getAll('demos'), durationMin: Number(f.get('durationMin')), validHours: Number(f.get('validHours')), maxDevices: Number(f.get('maxDevices'))
    };
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const r = await api('admin/invites', body);
      S.last = r;
      showShare(r, body);
      form.reset();
      await load();
      toast('Invite ready. Copy the link and code below.');
    } catch (e2) { err.textContent = e2.message; err.classList.add('show'); }
    btn.disabled = false;
  });

  function showShare(r, body) {
    const first = String(body.name).trim().split(/\s+/)[0];
    const names = S.demos.filter(d => body.demos.includes(d.id)).map(d => d.name);
    const dur = body.durationMin >= 60 ? (body.durationMin / 60) + (body.durationMin === 60 ? ' hour' : ' hours') : body.durationMin + ' minutes';
    const valid = { 4: '4 hours', 24: '24 hours', 48: '48 hours', 168: '7 days' }[body.validHours] || body.validHours + ' hours';
    S.messages = {
      'link-msg': `Hi ${first},\n\nHere is your private Symbo demo (${names.join(', ')}):\n${r.link}\n\nSign in with ${String(body.email).toLowerCase()}. Your access code comes in a separate message. You'll have ${dur} once you sign in, and the invite works on one device, so open it where you plan to watch. Please open it within ${valid}.\n\nThe demo is confidential and carries your name as a watermark, so please don't forward it.\n\nTeam Symbo`,
      'code-msg': `Your Symbo demo access code: ${r.code}\nIt works once, on one device, with the link I emailed you.`
    };
    $('#share-link').textContent = r.link;
    $('#share-code').textContent = r.code;
    $('#share-for').textContent = 'for ' + body.name;
    $('#share').classList.add('show');
    $('#share').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $$('[data-copy]').forEach(b => b.onclick = async () => {
    const text = S.messages?.[b.dataset.copy];
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into ' + (b.dataset.copy === 'link-msg' ? 'your email.' : 'WhatsApp or SMS.')); }
    catch { toast('Copy failed. Select the text and copy it manually.'); }
  });

  $('#refresh').onclick = () => (S.tab === 'activity' ? loadEvents() : load()).then(() => toast('Updated.')).catch(e => toast(e.message));
  $('#signout-all').onclick = async e => {
    if (!confirmInline(e.target, 'Click again to sign out everyone')) return;
    try { await api('admin/team/signout-all', {}); location.replace('/access/?reason=signedout'); } catch (er) { toast(er.message); }
  };

  api('session').then(s => { if (s.name) $('#me').textContent = 'Signed in as ' + s.name; }).catch(() => {});
  load().catch(e => toast(e.message));
  setInterval(() => { if (!document.hidden && S.tab === 'invites') load().catch(() => {}); }, 30000);
})();

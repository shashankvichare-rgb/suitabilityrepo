/* Suitability in action · desktop dashboard over the shared Symbo engine. */
import { PERSONAS, OPTIONS, SEGMENTS, PRODUCTS, VAS, BUNDLES, REG, JOURNEY, EVIDENCE, run, apiView, markersFor, inr, short } from '/hub/engine/engine.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEG_TABS = [['NBFC', 'Lending', 'ph-hand-coins'], ['BANK', 'Bank', 'ph-bank'], ['MFI', 'Microfinance', 'ph-users-three'], ['MER', 'Merchant', 'ph-storefront'], ['MOB', 'Gig & mobility', 'ph-moped'], ['TRV', 'Travel', 'ph-airplane-tilt'], ['EDU', 'Education', 'ph-graduation-cap'], ['RET', 'Retail', 'ph-device-mobile']];
const STATE = { unmapped: ['Not for this partner type', 1], ineligible: ['Ruled out by eligibility', 2], lowfit: ['No real need', 3], overlap: ['Already covered', 3], alt: ['Fits, held in reserve', 4], recommended: ['Recommended', 5], fit: ['Fits', 4], eligible: ['Eligible', 3] };
const STAGES = [['Signals', 'ph-broadcast', 'Datapoints read about the customer, the transaction and consent'], ['Catalogue', 'ph-stack', 'Every product in the Symbo master'], ['Mapped', 'ph-funnel', 'Products this partner type can distribute'], ['Eligible', 'ph-check-square', 'Pass context, age, ticket and channel rules'], ['Fit', 'ph-target', 'Meet a need the customer actually has'], ['Recommended', 'ph-seal-check', 'One per need, inside the premium cap']];
const FAMILIES = [['FIN', 'Protection & health'], ['MER', 'Merchant & shop'], ['MOT', 'Motor'], ['MOB', 'Gig & rides'], ['TRV', 'Travel'], ['EDU', 'Education'], ['RET', 'Device & retail'], ['LOG', 'Logistics']];

const S = { p: { ...PERSONAS[0] }, res: null, phase: 6, tab: 'audit', view: 'run', tampered: null, pops: new Map() };
let timers = [];

function pop(html) { const id = 'p' + S.pops.size; S.pops.set(id, html); return `data-pop="${id}"`; }
function rerun(animate = true) {
  S.pops = new Map(); S.tampered = null;
  S.res = run(S.p);
  timers.forEach(clearTimeout); timers = [];
  if (!animate) { S.phase = 6; return render(); }
  S.phase = 0; render();
  [1, 2, 3, 4, 5, 6].forEach((ph, i) => timers.push(setTimeout(() => { S.phase = ph; paint(); }, 260 + i * 330)));
}

/* ── left: signals ── */
function control(key, label) {
  const v = S.p[key], opts = OPTIONS[key];
  if (key === 'age' || key === 'income') {
    const step = key === 'age' ? 1 : 5000;
    return `<div class="ctl"><label>${label}</label><div class="stepper"><button data-step="${key}" data-by="${-step}" aria-label="Lower ${label}">−</button><b>${key === 'income' ? inr(v) : v}</b><button data-step="${key}" data-by="${step}" aria-label="Raise ${label}">+</button></div></div>`;
  }
  return `<div class="ctl"><label>${label}</label><div class="seg">${opts.map(o => `<button class="${String(o) === String(v) ? 'on' : ''}" data-set="${key}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
}
function vLeft() {
  const r = S.res, groups = [...new Set(r.datapoints.map(d => d.group))];
  return `<aside class="col left">
    <div class="who"><span class="av">${esc(S.p.name.split(' ').map(x => x[0]).join(''))}</span><div><b>${esc(S.p.name)}</b><small>${esc(S.p.tag)}</small></div></div>
    <div class="txn"><span>${esc(S.p.txn)}</span><b>${short(S.p.amount)}</b>${r.derived.emi ? `<em>EMI ${inr(r.derived.emi)} × ${S.p.tenure}</em>` : S.p.days ? `<em>${S.p.days} days</em>` : ''}</div>
    <p class="eyebrow">Change a signal</p>
    ${control('age', 'Age')}${control('income', 'Income / month')}${control('occupation', 'Occupation')}${control('dependants', 'Dependants')}${control('savings', 'Savings buffer')}
    ${control('life', 'Life cover held')}${control('healthCover', 'Health cover held')}${control('pa', 'Accident cover held')}${control('commute', 'Travel exposure')}${control('upi', 'UPI use')}${control('channel', 'Channel')}
    <p class="eyebrow dp-h"><span>${r.datapoints.length} datapoints read</span><i class="ph-bold ph-broadcast"></i></p>
    <div class="dps">${groups.map(g => `<div class="dpg"><small>${g}</small>${r.datapoints.filter(d => d.group === g).map((d, i) => `<span class="dp src-${d.src}" style="--i:${i}" ${pop(`<b>${esc(d.label)}</b><p>${esc(d.value)}</p><em>Source: ${({ partner: 'partner journey', bureau: 'credit bureau', derived: 'derived by the engine', consent: 'consent ledger', policy: 'partner policy', kyc: 'KYC record' })[d.src]}</em>`)}>${esc(d.label)}</span>`).join('')}</div>`).join('')}</div>
  </aside>`;
}

/* ── centre: pipeline, catalogue field, mix ── */
function vPipeline() {
  const c = S.res.counts, nums = [S.res.datapoints.length, c.catalogue, c.mapped, c.eligible, c.fit, c.recommended];
  return `<div class="pipe">${STAGES.map(([name, icon, tip], i) => `<div class="stage" data-stage="${i + 1}" ${pop(`<b>${name}</b><p>${tip}</p>`)}><span class="s-ico"><i class="ph-bold ${icon}"></i></span><b class="s-n">${nums[i]}</b><small>${name}</small></div>${i < 5 ? '<i class="flow"></i>' : ''}`).join('')}</div>`;
}
function vField() {
  const r = S.res;
  const dot = x => { const [lbl, ph] = STATE[x.state] || ['', 1]; return `<i class="dot" data-state="${x.state}" data-ph="${ph}" ${pop(`<b>${esc(x.name)}</b><p>${esc(x.cat)} · ${esc(x.id)}</p><em class="st-${x.state}">${lbl}${x.reason ? ': ' + esc(x.reason) : x.state === 'recommended' ? ` · fit ${x.score}` : ''}</em>`)}></i>`; };
  return `<div class="field-wrap"><div class="field-h"><p class="eyebrow">Every product, checked</p><div class="legend"><span><i class="dot lg-out"></i>Ruled out</span><span><i class="dot lg-fit"></i>Fits</span><span><i class="dot lg-rec"></i>Recommended</span></div></div>
    <div class="field">${FAMILIES.map(([fam, name]) => `<div class="fam"><small>${name}</small><div>${r.all.filter(x => x.id.startsWith(fam)).map(dot).join('')}</div></div>`).join('')}</div></div>`;
}
function vMix() {
  const r = S.res, p = S.p;
  if (!r.picked.length) return `<div class="none"><i class="ph-bold ph-shield-slash"></i><b>Nothing is suitable for ${esc(p.name.split(' ')[0])}</b><p>The engine shows no offer. That outcome is logged too.</p></div>`;
  const card = (x, i) => {
    const why = `<b>Why ${esc(x.name)}</b>${x.matched.slice(0, 2).map(m => `<p class="pn">${esc(m.need)}</p><div class="chips">${m.signals.map(s => `<span>${esc(s)}</span>`).join('')}</div>`).join('')}<div class="fitbar"><i style="width:${x.score}%"></i></div><em>Fit ${x.score}/100 · rank ${i + 1} of ${r.counts.eligible} eligible</em>`;
    const comp = `<b>Compliance markers</b>${markersFor(x, p, r.derived).map(m => `<p class="mk"><i class="ph-fill ph-check-circle"></i><span>${esc(m.title)}<small>${esc(m.ref)}</small></span></p>`).join('')}`;
    return `<article class="rec" style="--i:${i}" ${pop(why)}>
      <div class="rec-top"><span class="rk">${i + 1}</span><b>${esc(x.name)}</b><span class="shield" ${pop(comp)}><i class="ph-fill ph-shield-check"></i></span></div>
      <p class="need">${esc(x.matched[0]?.need || x.cat)}</p>
      <div class="rec-b"><span class="score"><i style="width:${x.score}%"></i></span><b>${x.priceValue ? inr(x.priceValue) : 'On request'}</b></div>
      <small>${x.priceValue ? esc(x.unit) : 'Insurer quote'} · ${esc(x.id)}</small></article>`;
  };
  const priced = r.picked.filter(x => x.priceValue), tot = r.total || 1;
  const mixBar = [...priced.map((x, i) => `<i class="mx m${i}" style="width:${x.priceValue / tot * 100}%" ${pop(`<b>${esc(x.name)}</b><p>${inr(x.priceValue)} · ${Math.round(x.priceValue / tot * 100)}% of the mix</p>`)}></i>`), r.vasFee ? `<i class="mx mv" style="width:${r.vasFee / tot * 100}%" ${pop(`<b>Value-added services</b><p>${inr(r.vasFee)} service fee, shown separately from insurance</p>`)}></i>` : ''].join('');
  return `<div class="mix-h"><p class="eyebrow">Recommended mix for ${esc(p.name.split(' ')[0])}</p><span class="hint"><i class="ph-bold ph-cursor"></i> Hover a card for why · the shield for compliance</span></div>
    <div class="recs">${r.picked.map(card).join('')}</div>
    <div class="extras">
      <div class="vas"><small>Services added</small>${r.vas.map(v => `<span ${pop(`<b>${esc(v.name)}</b><p>${esc(v.desc)}</p><em>${esc(v.cat)} · service, not insurance</em>`)}><i class="ph-bold ph-plus-circle"></i>${esc(v.name)}</span>`).join('') || '<span class="muted">None</span>'}${r.bundle ? `<span class="bdl" ${pop(`<b>${esc(r.bundle.name)}</b><p>${esc(r.bundle.items)}</p><em>Ready-made bundle for this segment</em>`)}><i class="ph-bold ph-package"></i>${esc(r.bundle.name)}</span>` : ''}</div>
      <div class="price"><small>Pricing mix</small><div class="mxbar">${mixBar}</div><b>${inr(r.total)}</b><em>${r.ratio}% of ${short(r.derived.ticket)} · cap ${r.derived.capPct}%</em></div>
    </div>
    ${r.alternatives.length ? `<div class="alts"><small>Held in reserve</small>${r.alternatives.slice(0, 5).map(x => `<span ${pop(`<b>${esc(x.name)}</b><p>${esc(x.reason)}</p><em>Fit ${x.score}/100</em>`)}>${esc(x.name)}</span>`).join('')}</div>` : ''}`;
}
function vNeeds() {
  return `<div class="needs"><p class="eyebrow">Protection gaps found</p>${S.res.needs.slice(0, 6).map(n => `<div class="nd" ${pop(`<b>${esc(n.label)}</b><div class="chips">${n.signals.map(s => `<span>${esc(s)}</span>`).join('')}</div>`)}><span>${esc(n.label)}</span><i><b style="width:${Math.round(n.level * 100)}%"></b></i></div>`).join('') || '<p class="muted">No gaps found.</p>'}</div>`;
}
function vCatalogue() {
  const segs = Object.keys(SEGMENTS);
  const cell = (fam, seg) => { const list = PRODUCTS.filter(x => x.id.startsWith(fam) && x.segs.includes(seg)); const n = list.length; return `<td class="h${Math.min(5, Math.ceil(n / 3))}" ${n ? pop(`<b>${n} product${n > 1 ? 's' : ''}</b><p>${list.slice(0, 9).map(x => esc(x.name)).join(' · ')}${n > 9 ? ' …' : ''}</p>`) : ''}>${n || ''}</td>`; };
  return `<div class="cat"><div class="cat-n"><div><b>${PRODUCTS.length}</b><small>insurance products</small></div><div><b>${VAS.length}</b><small>value-added services</small></div><div><b>${BUNDLES.length}</b><small>ready bundles</small></div><div><b>${segs.length}</b><small>partner types</small></div><div><b>${PRODUCTS.filter(x => x.priced).length}</b><small>priced today</small></div></div>
    <p class="eyebrow">Product mapping · what each partner type can distribute</p>
    <table class="heat"><thead><tr><th></th>${segs.map(s => `<th>${esc(SEGMENTS[s].replace(' & ', ' · '))}</th>`).join('')}</tr></thead><tbody>${FAMILIES.map(([fam, name]) => `<tr><th>${name}</th>${segs.map(s => cell(fam, s)).join('')}</tr>`).join('')}</tbody></table>
    <p class="eyebrow" style="margin-top:18px">Services the engine can attach</p>
    <div class="vcat">${Object.entries(VAS.reduce((a, v) => ((a[v.cat] = (a[v.cat] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([c, n]) => `<span ${pop(`<b>${esc(c)}</b><p>${VAS.filter(v => v.cat === c).slice(0, 8).map(v => esc(v.name)).join(' · ')}</p>`)}>${esc(c)} <b>${n}</b></span>`).join('')}</div></div>`;
}

/* ── right: audit, API, guardrails ── */
function vRight() {
  const r = S.res;
  let body;
  if (S.tab === 'audit') {
    const bad = S.tampered;
    body = `<div class="chain ${bad ? 'broken' : 'ok'}"><i class="ph-fill ${bad ? 'ph-warning-octagon' : 'ph-link'}"></i><span>${bad ? `Chain broken at entry ${bad}. The change is detected.` : `${r.log.entries.length} entries · hash chain intact`}</span>
      <button data-act="${bad ? 'restore' : 'tamper'}">${bad ? 'Restore' : 'Try altering one'}</button></div>
      <ol class="log">${r.log.entries.map(e => `<li class="${bad && e.n >= bad ? 'bad' : ''}" style="--i:${e.n}"><div class="lg-h"><b>${esc(e.step)}</b><time>${new Date(e.at).toLocaleTimeString('en-IN', { hour12: false })}</time></div><p>${esc(bad === e.n ? e.text.replace(/\d+/, m => String(Number(m) + 2)) : e.text)}</p>${e.data ? `<small>${esc(e.data)}</small>` : ''}<code>${e.prev} → ${bad && e.n >= bad ? '✕ mismatch' : e.hash}</code></li>`).join('')}</ol>
      <div class="evi"><p class="eyebrow">Kept for every policy · 5 records</p>${EVIDENCE.map(([t, d]) => `<span ${pop(`<b>${esc(t)}</b><p>${esc(d)}</p><em>Exportable for an RBI audit</em>`)}><i class="ph-bold ph-file-text"></i>${esc(t)}</span>`).join('')}</div>`;
  } else if (S.tab === 'api') {
    const v = apiView(r), j = o => esc(JSON.stringify(o, null, 1)).replace(/&quot;([^&]+?)&quot;:/g, '<i>"$1"</i>:');
    body = `<div class="api"><p class="ep"><b>POST</b> /v1/suitability/recommend</p><pre>${j(v.request)}</pre><p class="ep ok"><b>200</b> ${r.counts.catalogue} evaluated · ${r.picked.length} returned</p><pre>${j(v.response)}</pre></div>`;
  } else {
    body = `<div class="reg"><i class="ph-fill ph-scales"></i><span><b>${esc(REG.name)}</b><small>Effective ${esc(REG.effective)} · checked on every request</small></span></div>
      <ul class="guards">${r.guards.map(g => `<li class="${g.ok ? 'ok' : 'no'}${g.flag ? ' flag' : ''}" ${pop(`<b>${esc(g.title)}</b><p>${esc(g.text)}</p><em>${esc(g.ref)}</em>`)}><i class="ph-fill ${g.ok ? 'ph-check-circle' : 'ph-x-circle'}"></i><span>${esc(g.title)}<small>${esc(g.ref)}</small></span></li>`).join('')}</ul>
      <p class="eyebrow sub-h">The compliant journey · 7 steps</p>
      <ol class="jsteps">${JOURNEY.map(([t, d, ref], i) => `<li ${pop(`<b>${esc(t)}</b><p>${esc(d)}</p><em>${esc(ref)}</em>`)}><span>${i + 1}</span><b>${esc(t)}</b><em>${esc(ref)}</em></li>`).join('')}</ol>`;
  }
  const tab = (k, label, n) => `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}">${label}${n != null ? `<em>${n}</em>` : ''}</button>`;
  return `<aside class="col right"><div class="tabs">${tab('audit', 'Audit log', r.log.entries.length)}${tab('guards', 'Guardrails', r.guards.filter(g => g.ok).length + '/' + r.guards.length)}${tab('api', 'API')}</div>${body}
    <div class="powers"><small>The same API runs inside</small><a href="/demos/loanbee-checkout/"><i class="ph-bold ph-device-mobile"></i> Embedded widget journey</a><a href="/demos/agent-journey/"><i class="ph-bold ph-headset"></i> Agent journey</a></div></aside>`;
}

function render() {
  const seg = S.p.seg;
  $('#app').innerHTML = `<header class="top"><a class="brand" href="/"><img src="/hub/brand/symbo-logo.png" alt="Symbo"></a><div class="ttl"><small>Suitability engine</small><b>In action</b></div>
      <nav class="segs">${SEG_TABS.map(([k, label, icon]) => `<button class="${seg === k ? 'on' : ''}" data-seg="${k}"><i class="ph-bold ${icon}"></i>${label}</button>`).join('')}</nav>
      <span class="insured">Insured by <img src="/hub/brand/digit.png" alt="Digit"></span></header>
    <main class="grid" data-phase="${S.phase}">${vLeft()}
      <section class="col mid"><div class="mid-h">${vPipeline()}<div class="views"><button class="${S.view === 'run' ? 'on' : ''}" data-view="run">Engine run</button><button class="${S.view === 'cat' ? 'on' : ''}" data-view="cat">Catalogue map</button><button class="replay" data-act="replay" title="Run again"><i class="ph-bold ph-arrow-clockwise"></i></button></div></div>
        ${S.view === 'run' ? `${vField()}<div class="out">${vMix()}</div>${vNeeds()}` : vCatalogue()}</section>
      ${vRight()}</main>`;
  paint();
}
/* advance the run: light up stages, settle dots, reveal the mix */
function paint() {
  const g = $('.grid'); if (!g) return;
  g.dataset.phase = S.phase;
  document.querySelectorAll('.stage').forEach(s => s.classList.toggle('on', Number(s.dataset.stage) <= S.phase));
  document.querySelectorAll('.field .dot').forEach(d => { const ph = Number(d.dataset.ph); d.classList.toggle('out', S.phase > ph && ph < 4); d.classList.toggle('fit', S.phase >= 5 && d.dataset.state === 'alt'); d.classList.toggle('rec', S.phase >= 6 && d.dataset.state === 'recommended'); });
}

/* ── events ── */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-seg],[data-set],[data-step],[data-tab],[data-view],[data-act]'); if (!t) return;
  const d = t.dataset;
  if (d.seg) { S.p = { ...PERSONAS.find(x => x.seg === d.seg) }; S.view = 'run'; return rerun(); }
  if (d.set) { const cur = S.p[d.set]; S.p[d.set] = typeof cur === 'number' ? Number(d.val) : d.val; return rerun(); }
  if (d.step) { const lim = d.step === 'age' ? [18, 75] : [8000, 500000]; S.p[d.step] = Math.max(lim[0], Math.min(lim[1], S.p[d.step] + Number(d.by))); return rerun(); }
  if (d.tab) { S.tab = d.tab; S.pops = new Map(); return render(); }
  if (d.view) { S.view = d.view; S.pops = new Map(); return render(); }
  if (d.act === 'replay') return rerun();
  if (d.act === 'tamper') { S.tampered = 3 + Math.floor(Math.random() * 3); return render(); }
  if (d.act === 'restore') { S.tampered = null; return render(); }
});
const popEl = $('#pop');
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-pop]'); if (!t) { popEl.classList.remove('on'); return; }
  const html = S.pops.get(t.dataset.pop); if (!html) return;
  popEl.innerHTML = html; popEl.classList.add('on');
  const r = t.getBoundingClientRect(), w = popEl.offsetWidth, h = popEl.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.bottom + 10;
  if (y + h > innerHeight - 8) y = r.top - h - 10;
  popEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px'; popEl.style.top = Math.max(8, y) + 'px';
});
document.addEventListener('scroll', () => popEl.classList.remove('on'), true);
rerun();

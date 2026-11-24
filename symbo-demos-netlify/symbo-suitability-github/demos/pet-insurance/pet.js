/* Pet insurance landing v3: shared behaviour for a.html, b.html and quote.html.
   No framework. Needs icons.js (window.TI) and hospitals.js (window.HOSPITALS) loaded first.

   INTEGRATION POINTS (search for "TODO:")
   1. loadLead()  : replace DEMO_LEAD with the lead API response for ?referenceId=...
   2. price()     : replace the mock rates with the Quote API response
   3. submitLead(): post the confirmed details before moving to the quote page            */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var inr = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
  var ic = function (n) { return '<i class="ic" data-i="' + n + '"></i>'; };
  function icons(root) {
    $$('i[data-i]', root).forEach(function (el) {
      if (el.firstChild) return;
      var b = (window.TI || {})[el.getAttribute('data-i')];
      if (b) el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + b + '</svg>';
    });
  }

  /* ---------------- plan + price ---------------- */
  var PLAN = { sumInsured: 500000, years: 3, indicative: 11000 };
  var DAYS = PLAN.years * 365;
  function ownerAge(dob) {
    var d = new Date(dob); if (isNaN(d)) return null;
    var n = new Date(), a = n.getFullYear() - d.getFullYear();
    if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
    return a;
  }
  /* TODO: MOCK rates carried over from the earlier demo engine. Replace with the Quote API. */
  function price(lead) {
    var base = lead.petType === 'cat' ? 9980 : 10482;
    var a = ownerAge(lead.dob) || 32;
    var f = a < 36 ? 1 : a < 46 ? 1.02 : a < 56 ? 1.05 : 1.09;
    var net = Math.round(base * f), disc = Math.round(net * 0.08), gst = Math.round((net - disc) * 0.18);
    var total = net - disc + gst;
    return { net: net, disc: disc, gst: gst, total: total, perDay: Math.round(total / DAYS) };
  }

  /* ---------------- lead (prefilled details) ---------------- */
  var KEY = 'petins:lead:v3';
  /* TODO: sample only. The partner passes name, surname, DOB, city, state, pincode, pet type and pet age through the lead API. */
  var DEMO_LEAD = { first: 'Aarav', last: 'Mehta', dob: '1991-03-14', mobile: '9820012345', pincode: '400052', city: 'Mumbai', state: 'Maharashtra', petType: 'dog', petAge: '3', partner: 'PawsIndia' };
  function loadLead() {
    try { var s = JSON.parse(sessionStorage.getItem(KEY)); if (s && s.first) return s; } catch (e) {}
    var l = {}; for (var k in DEMO_LEAD) l[k] = DEMO_LEAD[k]; return l;
  }
  function saveLead(l) { try { sessionStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} }
  var lead = loadLead();
  var PET_AGES = [['0.25', '3 to 6 months'], ['0.5', '6 to 12 months']].concat(
    Array.apply(null, Array(15)).map(function (_, i) { return [String(i + 1), (i + 1) + (i ? ' years' : ' year')]; }), [['16', 'Over 15 years']]);
  function petAgeLabel(v) { for (var i = 0; i < PET_AGES.length; i++) if (PET_AGES[i][0] === String(v)) return PET_AGES[i][1]; return ''; }

  /* ---------------- hospitals ---------------- */
  var H = window.HOSPITALS || [];
  var CITIES = (function () {
    var m = {}; H.forEach(function (h) { m[h.c] = (m[h.c] || 0) + 1; });
    return Object.keys(m).map(function (c) { return { c: c, n: m[c] }; }).sort(function (a, b) { return b.n - a.n || a.c.localeCompare(b.c); });
  })();
  function cityOfPin(pin) { for (var i = 0; i < H.length; i++) if (H[i].p.slice(0, 3) === String(pin).slice(0, 3)) return H[i].c; return ''; }
  /* Closest by pincode: same pincode, then same postal sub-region, then same city. (No lat/long in the list.) */
  function near(pin) {
    pin = String(pin || ''); if (!/^\d{6}$/.test(pin)) return [];
    var city = cityOfPin(pin);
    return H.map(function (h) {
      var s = h.p === pin ? 0 : h.p.slice(0, 4) === pin.slice(0, 4) ? 1 : h.p.slice(0, 3) === pin.slice(0, 3) ? 2 : (city && h.c === city) ? 3 : -1;
      return { h: h, s: s, d: Math.abs(+h.p - +pin) };
    }).filter(function (x) { return x.s >= 0; }).sort(function (a, b) { return a.s - b.s || a.d - b.d; })
      .map(function (x) { var o = {}; for (var k in x.h) o[k] = x.h[k]; o.rank = x.s; return o; });
  }
  function hcard(h) {
    var tag = h.rank === 0 ? '<span class="tag tag--near">' + ic('map-pin') + 'Your pincode</span>' : h.rank === 1 ? '<span class="tag tag--near">' + ic('map-pin') + 'Near you</span>' : '';
    var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(h.n + ' ' + h.c + ' ' + h.p);
    return '<div class="hcard"><div class="iconbox">' + ic('building-hospital') + '</div><div class="hcard__body">' +
      '<div class="hcard__name">' + esc(h.n) + '</div><div class="hcard__city">' + esc(h.c) + ' · ' + esc(h.p) + '</div><div class="hcard__addr">' + esc(h.a) + '</div>' +
      '<div class="hcard__meta"><span class="tag">' + ic('circle-check-filled') + 'Cashless</span>' + tag + '</div></div>' +
      '<a class="hcard__dir" href="' + maps + '" target="_blank" rel="noopener" aria-label="Directions to ' + esc(h.n) + '">' + ic('map-search') + '</a></div>';
  }
  function mountFinder(el) {
    var compact = el.hasAttribute('data-compact');
    var st = { q: '', city: '', all: false };
    var limit = function () { return compact ? 3 : (window.innerWidth >= 900 ? 6 : 4); };
    el.innerHTML = '<div class="finder__top"><label class="finder__search">' + ic('search') +
      '<input type="text" inputmode="search" autocomplete="off" placeholder="Pincode, city or area" aria-label="Search cashless hospitals by pincode, city or area">' +
      '<button type="button" class="finder__clear" aria-label="Clear search">' + ic('x') + '</button></label>' +
      '<div class="chips"></div></div><div class="finder__status"></div><div class="hlist"></div>' +
      '<button type="button" class="finder__more"></button>' +
      (compact ? '' : '<div class="finder__foot">' + ic('info-circle') + '<span>Vet not on the list? You can still use any vet and claim online. New hospitals are being added.</span></div>');
    var inp = $('input', el), chips = $('.chips', el), status = $('.finder__status', el), list = $('.hlist', el), more = $('.finder__more', el), clear = $('.finder__clear', el);
    function results() {
      var q = st.q.trim();
      if (/^\d{6}$/.test(q)) return { rows: near(q), label: 'near ' + q, pin: q };
      if (q) { var s = q.toLowerCase(); return { rows: H.filter(function (h) { return (h.n + ' ' + h.a + ' ' + h.c + ' ' + h.s + ' ' + h.p).toLowerCase().indexOf(s) >= 0; }), label: 'for “' + q + '”' }; }
      if (st.city) return { rows: H.filter(function (h) { return h.c === st.city; }), label: 'in ' + st.city };
      var n = near(lead.pincode);
      return n.length ? { rows: n, label: 'near ' + lead.pincode, pin: lead.pincode } : { rows: H, label: 'across India' };
    }
    function draw() {
      var r = results(), rows = r.rows, lim = limit(); if (!compact && rows.length <= lim + 2) lim = rows.length;
      var nearOn = !st.q && !st.city;
      chips.innerHTML = '<button type="button" class="chip' + (nearOn ? ' on' : '') + '" data-city="">' + ic('map-pin') + 'Near ' + esc(lead.pincode) + '</button>' +
        CITIES.map(function (c) { return '<button type="button" class="chip' + (st.city === c.c && !st.q ? ' on' : '') + '" data-city="' + esc(c.c) + '">' + esc(c.c) + '<small>' + c.n + '</small></button>'; }).join('');
      clear.style.display = st.q ? 'flex' : 'none';
      if (rows.length) {
        status.innerHTML = ic('circle-check-filled') + '<span><b>' + rows.length + ' cashless hospital' + (rows.length > 1 ? 's' : '') + '</b> ' + esc(r.label) + '</span>';
        list.innerHTML = rows.slice(0, st.all ? rows.length : lim).map(hcard).join('');
      } else {
        status.innerHTML = ic('info-circle') + '<span>No cashless hospital ' + esc(r.label) + ' yet</span>';
        list.innerHTML = '<div class="finder__empty">' + ic('receipt-rupee') + '<span><b>You are still covered.</b> Visit any vet, pay the bill and claim it back online. Pick a city above to see the network.</span></div>';
      }
      var rest = rows.length - lim;
      more.style.display = rest > 0 ? 'flex' : 'none';
      more.innerHTML = st.all ? 'Show fewer' + ic('chevron-up') : 'Show ' + rest + ' more' + ic('chevron-down');
      icons(el);
    }
    inp.addEventListener('input', function () { st.q = inp.value; st.all = false; draw(); });
    clear.addEventListener('click', function () { st.q = inp.value = ''; draw(); inp.focus(); });
    chips.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; st.city = b.getAttribute('data-city'); st.q = inp.value = ''; st.all = false; draw(); });
    more.addEventListener('click', function () { st.all = !st.all; draw(); });
    el._redraw = draw; draw();
  }

  /* ---------------- personalisation ---------------- */
  function fill() {
    var n = near(lead.pincode), p = price(lead), city = cityOfPin(lead.pincode) || lead.city;
    var indicativeDay = Math.round(PLAN.indicative / DAYS);
    var v = {
      first: lead.first, name: lead.first + ' ' + lead.last, pet: lead.petType, pets: lead.petType + 's', city: city, pincode: lead.pincode, partner: lead.partner || 'PawsIndia',
      petAge: petAgeLabel(lead.petAge), ownerAge: ownerAge(lead.dob), mobile: '+91 ' + lead.mobile,
      hCount: H.length, hCities: CITIES.length, nearCount: n.length,
      nearLine: n.length ? n.length + ' cashless vet hospital' + (n.length > 1 ? 's are' : ' is') + ' near you' : H.length + ' cashless vet hospitals across ' + CITIES.length + ' cities',
      nearShort: n.length ? n.length + ' near ' + lead.pincode : H.length + ' across India',
      perDay: '₹' + indicativeDay, indicative: inr(PLAN.indicative),
      qTotal: inr(p.total), qDay: '₹' + p.perDay, qNet: inr(p.net), qDisc: '− ' + inr(p.disc), qGst: inr(p.gst), si: '₹5,00,000'
    };
    $$('[data-v]').forEach(function (el) { var k = el.getAttribute('data-v'); if (k in v && v[k] != null) el.textContent = v[k]; });
    $$('[data-mini-near]').forEach(function (el) {
      var rows = n.slice(0, +el.getAttribute('data-mini-near') || 2);
      el.innerHTML = rows.length ? '<div class="minis__label">Closest to ' + esc(lead.pincode) + '</div>' + rows.map(function (h) {
        return '<div class="mini">' + ic('building-hospital') + '<div><b>' + esc(h.n) + '</b><span>' + esc(h.c) + ' ' + esc(h.p) + ' · Cashless</span></div></div>';
      }).join('') : '';
    });
    $$('[data-near-one]').forEach(function (el) {
      el.innerHTML = n.length ? ic('building-hospital') + '<span><b>' + esc(n[0].n) + '</b> is your nearest cashless hospital. ' + (n.length > 1 ? (n.length - 1) + ' more near ' + esc(lead.pincode) + '.' : '') + '</span>'
        : ic('receipt-rupee') + '<span>No cashless hospital near ' + esc(lead.pincode) + ' yet. Use any vet and <b>claim online</b>.</span>';
    });
    $$('[data-finder]').forEach(function (el) { if (el._redraw) el._redraw(); });
    icons();
  }

  /* ---------------- details sheet ---------------- */
  var sheet, onDone;
  function buildSheet() {
    sheet = document.createElement('div'); sheet.className = 'sheet-bg';
    sheet.innerHTML = '<form class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT" novalidate><div class="sheet__grab"></div>' +
      '<div class="sheet__head"><div><h2 id="shT">Check your details</h2><p>Takes a few seconds. Your price is on the next screen.</p></div><button type="button" class="sheet__x" aria-label="Close">' + ic('x') + '</button></div>' +
      '<div class="sheet__body"><div class="prefilled">' + ic('circle-check-filled') + '<span>Filled in from your <span data-v="partner">PawsIndia</span> account. Change anything that is wrong.</span></div>' +
      '<div class="fgrid">' +
      '<div class="field" data-f="first"><label for="f_first">First name</label><input class="inp" id="f_first" autocomplete="given-name" maxlength="40"><small></small></div>' +
      '<div class="field" data-f="last"><label for="f_last">Last name</label><input class="inp" id="f_last" autocomplete="family-name" maxlength="40"><small></small></div>' +
      '<div class="field" data-f="dob"><label for="f_dob">Your date of birth</label><input class="inp" id="f_dob" type="date" autocomplete="bday"><small>The premium depends on your age</small></div>' +
      '<div class="field" data-f="mobile"><label for="f_mobile">Mobile number</label><div class="inp"><span class="pre">+91</span><input id="f_mobile" inputmode="numeric" autocomplete="tel-national" maxlength="10"></div><small></small></div>' +
      '<div class="field" data-f="pincode"><label for="f_pincode">Pincode</label><input class="inp" id="f_pincode" inputmode="numeric" autocomplete="postal-code" maxlength="6"><small></small></div>' +
      '<div class="field" data-f="city"><label for="f_city">City</label><input class="inp" id="f_city" autocomplete="address-level2" maxlength="40"><small></small></div>' +
      '<div class="field field--full"><span class="lbl">Your pet is a</span><div class="pick"><button type="button" data-pet="dog">' + ic('dog') + 'Dog</button><button type="button" data-pet="cat">' + ic('cat') + 'Cat</button></div></div>' +
      '<div class="field field--full" data-f="petAge"><label for="f_petAge">Pet’s age</label><select class="inp" id="f_petAge">' + PET_AGES.map(function (a) { return '<option value="' + a[0] + '">' + a[1] + '</option>'; }).join('') + '</select><small>Any age above 3 months is covered</small></div>' +
      '</div>' +
      '<label class="consent"><input type="checkbox" id="f_consent" checked><span>I agree to be contacted by call, SMS or WhatsApp about this request and accept the Privacy Policy.</span></label>' +
      '</div><div class="sheet__foot"><div class="formerr">' + ic('alert-triangle') + '<span></span></div>' +
      '<button type="submit" class="btn btn--lg btn--block"><span data-sheet-cta>See my price</span>' + ic('arrow-right') + '</button>' +
      '<div class="lockline">' + ic('lock') + 'No payment on the next screen</div></div></form>';
    document.body.appendChild(sheet);
    var f = function (id) { return $('#f_' + id, sheet); };
    var pet = lead.petType;
    function setPet(p) { pet = p; $$('[data-pet]', sheet).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-pet') === p); }); }
    sheet._load = function () {
      ['first', 'last', 'dob', 'mobile', 'pincode', 'city', 'petAge'].forEach(function (k) { f(k).value = lead[k] || ''; });
      setPet(lead.petType); $$('.field.err', sheet).forEach(function (x) { x.classList.remove('err'); }); $('.formerr', sheet).classList.remove('on');
    };
    $$('[data-pet]', sheet).forEach(function (b) { b.addEventListener('click', function () { setPet(b.getAttribute('data-pet')); }); });
    f('mobile').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 10); });
    f('pincode').addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 6);
      if (this.value.length === 6) { var c = cityOfPin(this.value); if (c) f('city').value = c; }
    });
    function close() { sheet.classList.remove('on'); document.body.style.overflow = ''; }
    sheet._close = close;
    $('.sheet__x', sheet).addEventListener('click', close);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('on')) close(); });
    $('form', sheet).addEventListener('submit', function (e) {
      e.preventDefault();
      var v = { first: f('first').value.trim(), last: f('last').value.trim(), dob: f('dob').value, mobile: f('mobile').value, pincode: f('pincode').value, city: f('city').value.trim(), petAge: f('petAge').value };
      var age = ownerAge(v.dob), nameRe = /^[A-Za-z][A-Za-z .'-]{0,39}$/;
      var errs = {
        first: nameRe.test(v.first) ? '' : 'Enter your first name', last: nameRe.test(v.last) ? '' : 'Enter your last name',
        dob: age == null ? 'Enter your date of birth' : age < 18 ? 'You must be 18 or older' : age > 80 ? 'Proposer must be 80 or younger' : '',
        mobile: /^[6-9]\d{9}$/.test(v.mobile) ? '' : 'Enter a 10-digit mobile number', pincode: /^[1-9]\d{5}$/.test(v.pincode) ? '' : 'Enter a 6-digit pincode', city: v.city ? '' : 'Enter your city'
      };
      var first = null;
      Object.keys(errs).forEach(function (k) {
        var box = $('[data-f="' + k + '"]', sheet), sm = $('small', box);
        if (!sm.hasAttribute('data-h')) sm.setAttribute('data-h', sm.textContent);
        box.classList.toggle('err', !!errs[k]); sm.textContent = errs[k] || sm.getAttribute('data-h');
        if (errs[k] && !first) first = k;
      });
      var fe = $('.formerr', sheet), msg = first ? 'Please check the highlighted details' : !f('consent').checked ? 'Please tick the box to continue' : '';
      fe.classList.toggle('on', !!msg); $('span', fe).textContent = msg;
      if (msg) { if (first) f(first).focus(); return; }
      for (var k in v) lead[k] = v[k];
      lead.petType = pet; lead.state = lead.state || '';
      saveLead(lead); submitLead(lead);
      close(); fill(); if (onDone) onDone(lead);
    });
    icons(sheet);
  }
  /* TODO: POST the confirmed details (and consent) to the lead/quote API here. */
  function submitLead() {}
  function openSheet(opts) {
    if (!sheet) buildSheet();
    opts = opts || {}; onDone = opts.done || null;
    $('[data-sheet-cta]', sheet).textContent = opts.cta || 'See my price';
    $('#shT', sheet).textContent = opts.title || 'Check your details';
    sheet._load(); fill();
    sheet.classList.add('on'); document.body.style.overflow = 'hidden';
  }

  /* ---------------- page wiring ---------------- */
  function init() {
    var variant = document.body.getAttribute('data-variant') || '';
    $$('[data-finder]').forEach(mountFinder);
    fill();
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-buy]'); if (!b) return;
      e.preventDefault();
      if (b.getAttribute('data-buy') === 'edit') openSheet({ cta: 'Update my price', title: 'Edit your details' });
      else openSheet({ done: function () { try { sessionStorage.setItem('petins:from', variant); } catch (e) {} location.href = 'quote.html'; } });
    });
    /* segmented panes */
    $$('[data-seg]').forEach(function (seg) {
      var scope = seg.parentNode;
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        $$('button', seg).forEach(function (x) { x.classList.toggle('on', x === b); });
        $$('[data-pane]', scope).forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-pane') === b.getAttribute('data-to')); });
      });
    });
    /* scroll spy for section nav + tab bar */
    var links = $$('[data-spy] a[href^="#"]');
    var ids = links.map(function (a) { return a.getAttribute('href').slice(1); }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var float = $('.floatbar');
    function onScroll() {
      var y = window.scrollY + 160, cur = '';
      ids.forEach(function (id) { var s = document.getElementById(id); if (s && s.offsetTop <= y) cur = id; });
      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + cur; a.classList.toggle('on', on);
        if (on && a.parentNode.classList.contains('secnav__in')) { var p = a.parentNode; p.scrollTo({ left: a.offsetLeft - p.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' }); }
      });
      if (float) float.classList.toggle('on', window.scrollY > 640);
    }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    icons();
  }
  window.Pet = { lead: function () { return lead; }, price: price, near: near, fill: fill, openSheet: openSheet, icons: icons, inr: inr };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

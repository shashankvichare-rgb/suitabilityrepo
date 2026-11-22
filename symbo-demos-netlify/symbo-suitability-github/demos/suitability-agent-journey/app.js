/* Suitability Agent Journey · Credit Life for business loans
   LoanBee (fictional lender) agent app in the centre, Symbo decision view on the right.
   Browser-only demo: no loan, payment, SMS/OTP or policy is real. */
(() => {
  'use strict';
  const E = window.CreditLifeEngine;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const inr2 = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lakh = n => n >= 1e5 ? '₹' + (n / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + 'L' : inr(n);
  const time = t => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = t => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const mask = m => m ? '••••••' + String(m).slice(-4) : '';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PERSONAS = [
    { id: 'ravi', tag: 'A', title: 'Ravi Kumar', sub: 'Kirana store owner', blurb: 'Business loan ₹8L over 36 months. Sole earner with 3 dependants and no life cover.',
      applicant: { name: 'Ravi Kumar', dob: '1985-06-14', gender: 'Male', mobile: '9800001234', email: 'ravi.kumar@example.com', occupation: 'Self-employed · retail', income: 85000, dependants: 3, coBorrower: false, coBorrowerName: '', coBorrowerDob: '', nominee: 'Sunita Kumar', nomineeRelation: 'Spouse' },
      loan: { type: 'Business loan', amount: 800000, tenure: 36, rate: 16 },
      answers: { repay: 'Family would have to', cover: 'None', collateral: 'Yes', household: 'Single income' }, health: { h1: 'No', h2: 'No', h3: 'No', h4: 'No' } },
    { id: 'meena', tag: 'B', title: 'Meena & Arun Shah', sub: 'Co-borrowers', blurb: 'Business loan ₹15L over 60 months. Two incomes, home pledged as security.',
      applicant: { name: 'Meena Shah', dob: '1979-02-02', gender: 'Female', mobile: '9800005678', email: 'meena.shah@example.com', occupation: 'Self-employed · garments', income: 140000, dependants: 2, coBorrower: true, coBorrowerName: 'Arun Shah', coBorrowerDob: '1976-09-20', nominee: 'Riya Shah', nomineeRelation: 'Daughter' },
      loan: { type: 'Business loan', amount: 1500000, tenure: 60, rate: 15 },
      answers: { repay: 'Co-borrower would', cover: 'Less than the loan', collateral: 'Yes', household: 'Two or more incomes' }, health: { h1: 'No', h2: 'No', h3: 'No', h4: 'No' } },
    { id: 'kabir', tag: 'C', title: 'Kabir Rao', sub: 'Low need', blurb: 'Personal loan ₹1.5L over 12 months. Single, no dependants, already has term cover.',
      applicant: { name: 'Kabir Rao', dob: '1999-11-05', gender: 'Male', mobile: '9800009012', email: 'kabir.rao@example.com', occupation: 'Salaried · IT', income: 95000, dependants: 0, coBorrower: false, coBorrowerName: '', coBorrowerDob: '', nominee: 'Lata Rao', nomineeRelation: 'Mother' },
      loan: { type: 'Personal loan', amount: 150000, tenure: 12, rate: 14 },
      answers: { repay: 'Savings would cover it', cover: 'Covers the loan', collateral: 'No', household: 'Two or more incomes' }, health: { h1: 'No', h2: 'No', h3: 'No', h4: 'No' } },
    { id: 'suresh', tag: 'D', title: 'Suresh Iyer', sub: 'Age limit', blurb: 'Business loan ₹6L over 60 months at 64. Cover would run past age 68.',
      applicant: { name: 'Suresh Iyer', dob: '1962-01-10', gender: 'Male', mobile: '9800003456', email: 'suresh.iyer@example.com', occupation: 'Self-employed · workshop', income: 70000, dependants: 1, coBorrower: false, coBorrowerName: '', coBorrowerDob: '', nominee: 'Kamala Iyer', nomineeRelation: 'Spouse' },
      loan: { type: 'Business loan', amount: 600000, tenure: 60, rate: 17 },
      answers: { repay: 'Family would have to', cover: 'None', collateral: 'No', household: 'Single income' }, health: { h1: 'No', h2: 'No', h3: 'No', h4: 'No' } },
    { id: 'blank', tag: '+', title: 'New borrower', sub: 'Blank form', blurb: 'Enter your own borrower. Nothing is pre-filled or pre-selected.',
      applicant: { name: '', dob: '', gender: '', mobile: '', email: '', occupation: '', income: '', dependants: 0, coBorrower: false, coBorrowerName: '', coBorrowerDob: '', nominee: '', nomineeRelation: '' },
      loan: { type: 'Business loan', amount: '', tenure: 36, rate: 16 }, answers: {}, health: {} }
  ];
  const STEPS = ['Borrower', 'Loan', 'Needs', 'Cover', 'Customer', 'Done'];
  const REL = ['Spouse', 'Son', 'Daughter', 'Mother', 'Father', 'Brother', 'Sister', 'Other'];

  let S;
  function fresh(p) {
    const ref = 'LB-' + (p.loan.type === 'Personal loan' ? 'PL' : 'BL') + '-' + String(Math.floor(100000 + Math.random() * 900000));
    return {
      persona: p.id, step: 1, view: 'agent', ref,
      applicant: structuredClone(p.applicant), loan: structuredClone(p.loan), answers: structuredClone(p.answers), health: structuredClone(p.health),
      plan: null, payMode: 'loan', reason: '', assessedAt: null, sent: null, decision: null, coi: null,
      cust: { stage: 'review', readTerms: false, health: false, nominee: false, c1: false, c2: false, otp: '', code: '', otpAt: null, viewedAt: null, verifiedAt: null },
      events: [], errors: {}
    };
  }
  function log(title, detail = '') { S.events.push({ at: Date.now(), title, detail }); }

  /* ── derived ────────────────────────────── */
  function ages() {
    const a = S.applicant;
    return { age: E.ageFromDob(a.dob), coAge: a.coBorrower && a.coBorrowerDob ? E.ageFromDob(a.coBorrowerDob) : 0 };
  }
  function assess() {
    const { age, coAge } = ages();
    return E.assess({
      applicant: { age, income: S.applicant.income, dependants: S.applicant.dependants, coBorrower: S.applicant.coBorrower, coBorrowerAge: coAge },
      loan: S.loan, answers: S.answers, health: S.health, payMode: S.payMode, plan: S.plan
    });
  }
  const firstName = () => (S.applicant.name || 'the customer').split(' ')[0];
  function needsReason(r) { return r.need.band === 'low' || r.chosen !== r.recommendation.plan; }

  /* ── state binding ──────────────────────── */
  function setPath(path, value) {
    if (path === 'reason') { S.reason = value; return; }
    const [root, key] = path.split('.');
    S[root][key] = value;
  }
  function readInput(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.dataset.t === 'num') return el.value === '' ? '' : Number(el.value);
    return el.value;
  }

  /* ── personas ───────────────────────────── */
  function renderPersonas() {
    $('#personas').innerHTML = PERSONAS.map(p => `<button type="button" class="persona ${S.persona === p.id ? 'on' : ''}" data-persona="${p.id}">
      <span class="key">${p.tag}</span><span><b>${esc(p.title)}</b> <span class="sub">· ${esc(p.sub)}</span></span>${S.persona === p.id ? '<span class="sel">Selected</span>' : '<span></span>'}
      <span class="blurb">${esc(p.blurb)}</span></button>`).join('');
  }

  /* ── agent app chrome ───────────────────── */
  function appbar(customer) {
    if (customer) return `<div class="appbar"><span class="lb"><i></i>LoanBee</span><span class="cust-banner"><span class="dot"></span>Secure link</span></div>`;
    return `<div class="appbar"><button class="back" type="button" data-act="back" aria-label="Back" ${S.step === 1 || S.step >= 5 ? 'disabled' : ''}>←</button>
      <span class="lb"><i></i>LoanBee <small>Partner</small></span><span class="chip-agent">AG-1042</span></div>
      <div class="progress" aria-label="Step ${S.step} of 6">${STEPS.map((s, i) => `<i class="${i + 1 < S.step ? 'done' : i + 1 === S.step ? 'cur' : ''}" title="${s}"></i>`).join('')}</div>`;
  }
  const title = (t, sub) => `<h2 class="s-title">${t}</h2><p class="s-sub">${sub}</p>`;
  const field = (label, path, value, type = 'text', extra = '', cls = '') => `<label class="f ${cls} ${S.errors[path] ? 'bad' : ''}"><span>${label}</span><input data-k="${path}" type="${type}" value="${esc(value)}" ${type === 'number' ? 'data-t="num" inputmode="numeric"' : ''} ${extra}></label>`;
  const select = (label, path, value, opts, cls = '') => `<label class="f ${cls} ${S.errors[path] ? 'bad' : ''}"><span>${label}</span><select data-k="${path}">${value === '' ? '<option value="" selected>Select</option>' : ''}${opts.map(o => `<option ${String(o) === String(value) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;

  /* Step 1 · Borrower */
  function stepBorrower() {
    const a = S.applicant;
    return `${title('Borrower details', 'Step 1 of 6 · From the loan application')}
    <div class="card"><h3>Applicant</h3><div class="fgrid">
      ${field('Full name', 'applicant.name', a.name, 'text', 'autocomplete="off"', 'full')}
      ${field('Date of birth', 'applicant.dob', a.dob, 'date')}
      ${select('Gender', 'applicant.gender', a.gender, ['Female', 'Male', 'Other'])}
      ${field('Mobile', 'applicant.mobile', a.mobile, 'tel', 'maxlength="10" inputmode="numeric"')}
      ${field('Email', 'applicant.email', a.email, 'email')}
      ${field('Occupation', 'applicant.occupation', a.occupation, 'text', '', 'full')}
      ${field('Monthly income (₹)', 'applicant.income', a.income, 'number', 'min="0"')}
      ${field('Dependants', 'applicant.dependants', a.dependants, 'number', 'min="0" max="15"')}
    </div></div>
    <div class="card"><h3>Co-borrower <label class="switch"><input type="checkbox" data-k="applicant.coBorrower" ${a.coBorrower ? 'checked' : ''} aria-label="Has co-borrower"><span></span></label></h3>
      ${a.coBorrower ? `<div class="fgrid">${field('Co-borrower name', 'applicant.coBorrowerName', a.coBorrowerName, 'text', '', 'full')}${field('Co-borrower date of birth', 'applicant.coBorrowerDob', a.coBorrowerDob, 'date', '', 'full')}</div>` : '<p class="s-sub" style="margin:0">No co-borrower on this loan.</p>'}
    </div>
    <div class="card"><h3>Nominee</h3><div class="fgrid">
      ${field('Nominee name', 'applicant.nominee', a.nominee)}
      ${select('Relationship', 'applicant.nomineeRelation', a.nomineeRelation, REL)}
    </div></div>`;
  }
  function validBorrower() {
    const a = S.applicant, e = {};
    const { age, coAge } = ages();
    if (!a.name.trim()) e['applicant.name'] = 'Enter the borrower name.';
    if (!a.dob || age < 18 || age > 80) e['applicant.dob'] = 'Enter a date of birth for an adult borrower.';
    if (!a.gender) e['applicant.gender'] = 'Select gender.';
    if (!/^\d{10}$/.test(String(a.mobile))) e['applicant.mobile'] = 'Enter a 10-digit mobile number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email)) e['applicant.email'] = 'Enter an email address.';
    if (!(a.income > 0)) e['applicant.income'] = 'Enter monthly income.';
    if (a.coBorrower && !a.coBorrowerName.trim()) e['applicant.coBorrowerName'] = 'Enter the co-borrower name.';
    if (a.coBorrower && (!a.coBorrowerDob || coAge < 18)) e['applicant.coBorrowerDob'] = 'Enter the co-borrower date of birth.';
    if (!a.nominee.trim()) e['applicant.nominee'] = 'Enter a nominee.';
    if (!a.nomineeRelation) e['applicant.nomineeRelation'] = 'Select the nominee relationship.';
    return e;
  }

  /* Step 2 · Loan */
  function stepLoan() {
    const l = S.loan;
    const emi = l.amount > 0 && l.tenure > 0 ? E.emi(l.amount, l.rate, l.tenure) : 0;
    return `${title('Loan details', 'Step 2 of 6 · Sanctioned, awaiting disbursal')}
    <div class="card"><div class="loan-hero"><div><span class="s-sub" style="margin:0">${esc(l.type)}</span><div class="amt">${l.amount ? inr(l.amount) : '₹—'}</div></div><span class="pill green"><span class="dot"></span>Sanctioned</span></div>
      <div class="kv"><div><span>Tenure</span><b>${l.tenure || '—'} months</b></div><div><span>Monthly EMI</span><b>${emi ? inr(emi) : '—'}</b></div><div><span>Interest</span><b>${l.rate}% p.a.</b></div><div><span>Loan account</span><b class="mono" style="font-size:13px">${S.ref}</b></div></div></div>
    <div class="card"><h3>Edit terms</h3><div class="fgrid">
      ${select('Loan type', 'loan.type', l.type, ['Business loan', 'Personal loan', 'Loan against property'], 'full')}
      ${field('Loan amount (₹)', 'loan.amount', l.amount, 'number', 'min="10000" step="10000"', 'full')}
      ${select('Tenure (months)', 'loan.tenure', l.tenure, [6, 12, 18, 24, 36, 48, 60, 72, 84])}
      ${field('Interest (% p.a.)', 'loan.rate', l.rate, 'number', 'min="1" max="36" step="0.25"')}
    </div>
    <p class="note">Disbursal waits for the protection step. Credit Life is optional and never a condition of this loan.</p></div>`;
  }
  function validLoan() {
    const e = {};
    if (!(S.loan.amount >= 10000)) e['loan.amount'] = 'Enter a loan amount of at least ₹10,000.';
    if (!(S.loan.rate > 0)) e['loan.rate'] = 'Enter the interest rate.';
    return e;
  }

  /* Step 3 · Needs + health declaration */
  function stepNeeds() {
    const qs = E.NEED_QUESTIONS.map(q => `<div class="q"><p>${esc(q.title)}</p><div class="chips">${q.options.map(o => `<label><input type="radio" name="answers.${q.id}" value="${esc(o)}" ${S.answers[q.id] === o ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div></div>`).join('');
    const hs = E.HEALTH_QUESTIONS.map((q, i) => `<div class="yn"><span>${i + 1}. ${esc(q.text)}</span><span class="seg">${['No', 'Yes'].map(v => `<label><input type="radio" name="health.${q.id}" value="${v}" ${S.health[q.id] === v ? 'checked' : ''}><span>${v}</span></label>`).join('')}</span></div>`).join('');
    return `${title('Protection check', `Step 3 of 6 · Ask ${esc(firstName())} directly`)}
    <div class="block"><div class="block-head"><img class="pulse" src="./assets/pulse.gif" alt=""><div><b>Credit Life</b><span>4 questions · skip any the customer won't answer</span></div></div>
      <div class="block-body">${qs}</div></div>
    <div class="card" style="margin-top:12px"><h3>Health declaration <span class="pill gray">${E.HEALTH_QUESTIONS.filter(q => S.health[q.id]).length}/4</span></h3>${hs}
      <p class="note">Read each question to the customer. They confirm these answers themselves before consenting.</p></div>`;
  }

  /* Step 4 · Cover */
  function stepCover() {
    const r = assess();
    const el = r.eligibility;
    if (!el.eligible) {
      const failed = el.checks.filter(c => !c.ok && c.id !== 'coborrower');
      const fix = /(\d+) months/.exec(el.suggestion || '');
      return `${title('Credit Life', 'Step 4 of 6 · Not available as entered')}
      <div class="block"><div class="block-head"><img class="pulse" src="./assets/pulse.gif" alt=""><div><b>Credit Life</b><span>${el.referral === 'underwriting' ? 'Needs underwriting review' : 'Outside the cover rules'}</span></div></div>
        <div class="block-body"><ul class="why">${failed.map(c => `<li><span><b>${esc(c.label)}.</b> ${esc(c.detail)}</span></li>`).join('')}</ul>
        ${el.suggestion ? `<p class="note amber">${esc(el.suggestion)}</p>` : ''}
        ${el.referral === 'underwriting' ? '<p class="note amber">A "Yes" in the health declaration needs a medical review before cover. The loan can go ahead without it.</p>' : ''}
        ${el.referral === 'medicals' ? '<p class="note amber">Cover above ₹50 lakh needs medical tests. Refer the case to underwriting.</p>' : ''}</div></div>`;
    }
    const p = r.price, rec = r.recommendation;
    const bandPill = { high: '<span class="pill green">Recommended</span>', medium: '<span class="pill blue">Suitable · optional</span>', low: '<span class="pill amber">Low need</span>' }[r.need.band];
    const reasons = r.need.reasons.filter(x => r.need.band === 'low' ? true : x.points > 0).sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 3);
    const planIds = Object.keys(r.plans);
    const { age } = ages();
    const endAge = Math.floor(age + S.loan.tenure / 12);
    return `${title('Credit Life', `Step 4 of 6 · Offer to ${esc(firstName())}`)}
    <div class="block"><div class="block-head"><img class="pulse" src="./assets/pulse.gif" alt=""><div style="flex:1"><b>Credit Life</b><span>Need score ${r.need.score}/100</span></div>${bandPill}</div>
      <div class="block-body">
        <ul class="why">${reasons.map(x => `<li>${esc(x.label)}</li>`).join('') || '<li>Few answers given. The customer decides.</li>'}</ul>
        <p class="note green" style="margin-top:12px"><b>${esc(E.PLANS[rec.plan].name)}:</b> ${esc(rec.why)}</p>
        <div class="plans" style="--n:${planIds.length};margin-top:16px">${planIds.map(id => `<button type="button" class="plan ${r.chosen === id ? 'on' : ''}" data-plan="${id}">${id === rec.plan ? '<span class="rec">Suggested</span>' : ''}<b>${E.PLANS[id].short}</b><strong>${inr(r.plans[id].total)}</strong><span>${lakh(r.plans[id].sumInsured)} cover</span></button>`).join('')}</div>
        <p class="s-sub" style="margin:8px 0 0;font-size:12.5px">${esc(E.PLANS[r.chosen].blurb)}</p>
        <div class="seg2" role="group" aria-label="Premium payment"><button type="button" data-pay="loan" aria-pressed="${S.payMode === 'loan'}">Add to loan</button><button type="button" data-pay="upfront" aria-pressed="${S.payMode === 'upfront'}">Pay upfront</button></div>
        <div style="margin-top:12px">
          <div class="sumrow"><span>Cover amount</span><b>${inr(p.sumInsured)}</b></div>
          <div class="sumrow"><span>Cover term</span><b>${S.loan.tenure} months · to age ${endAge}</b></div>
          <div class="sumrow"><span>Premium + 18% GST</span><b>${inr2(p.base)} + ${inr2(p.gst)}</b></div>
          <div class="sumrow big"><span>Single premium</span><b>${inr2(p.total)}</b></div>
        </div>
        <div class="emi"><div><span>EMI today</span><b>${inr(p.emiBefore)}</b></div><span class="arrow">→</span><div><span>EMI with cover</span><b>${inr(p.emiAfter)}</b><span class="delta">${p.emiDelta > 0 ? '+' + inr(p.emiDelta) + ' a month' : 'No change'}</span></div></div>
        ${S.payMode === 'loan' ? `<p class="note">The premium is added to the loan, so cover is set at ${inr(p.sumInsured)} to include it.</p>` : '<p class="note">The customer pays the premium before disbursal. The loan and EMI stay the same.</p>'}
        ${!r.affordability.ok ? `<p class="note red">${esc(r.affordability.note)}</p>` : ''}
        ${needsReason(r) ? `<label class="f ${S.errors.reason ? 'bad' : ''}" style="margin-top:14px"><span>${r.need.band === 'low' ? 'Low need: record why the customer still wants cover' : 'Different plan from the suggestion: record why'}</span><textarea data-k="reason" placeholder="In the customer's words">${esc(S.reason)}</textarea></label>` : ''}
      </div>
      <div class="powered">Protection options powered by <img src="./assets/symbo-logo.png" alt="Symbo"></div></div>
    <p class="note">Optional. Not a condition of the loan. The customer may use an existing policy instead.</p>`;
  }

  /* Step 5 · Agent waiting view */
  function stepWaiting() {
    const c = S.cust;
    const item = (ok, t) => `<li><i class="${ok ? 'ok' : 'wait'}">${ok ? '✓' : '·'}</i><span>${t}</span></li>`;
    return `${title(`Waiting for ${esc(firstName())}`, `Step 5 of 6 · Link sent ${time(S.sent.at)} to ${mask(S.applicant.mobile)}`)}
    <div class="card"><h3>Customer progress <span class="pill amber"><span class="dot"></span>Pending</span></h3>
      <ul class="checks" style="padding:0">${item(!!c.viewedAt, 'Opened the secure link')}${item(c.readTerms, 'Read what is and isn\'t covered')}${item(c.health, 'Confirmed health declaration')}${item(c.c1 && c.c2, 'Gave separate consents')}${item(!!c.verifiedAt, 'Verified with one-time code')}</ul></div>
    <div class="card"><h3>Price locked</h3>
      <div class="sumrow"><span>${E.PLANS[S.sent.price.plan].name}</span><b>${inr2(S.sent.price.total)}</b></div>
      <div class="sumrow"><span>Cover</span><b>${inr(S.sent.price.sumInsured)}</b></div>
      <div class="sumrow"><span>Payment</span><b>${S.payMode === 'loan' ? 'Added to loan' : 'Upfront'}</b></div></div>
    <p class="note">You can't consent for the customer. They review and accept on their own phone.</p>`;
  }

  /* Customer phone */
  function customerScreen() {
    const c = S.cust, p = S.sent.price, fin = S.payMode === 'loan';
    if (S.decision === 'accepted') {
      return `<div class="success"><div class="tick">✓</div><h2 class="s-title">You're covered, ${esc(firstName())}.</h2><p class="s-sub">Cover starts when your loan is disbursed. Certificate ${S.coi} is on its way by SMS and email.</p></div>`;
    }
    if (S.decision === 'declined') {
      return `<div class="success"><div class="tick gray">✓</div><h2 class="s-title">No problem, ${esc(firstName())}.</h2><p class="s-sub">Your loan continues without Credit Life. Nothing has been added to it.</p></div>`;
    }
    if (c.stage === 'otp') {
      return `${title('Confirm it\'s you', `We sent a 6-digit code to ${mask(S.applicant.mobile)}.`)}
      <div class="card"><div class="otp" role="group" aria-label="One-time code">${[0, 1, 2, 3, 4, 5].map(i => `<input inputmode="numeric" maxlength="1" data-otp="${i}" value="${esc(c.otp[i] || '')}" aria-label="Digit ${i + 1}">`).join('')}</div>
        <span class="democode">Demo code: ${c.code}</span>
        ${S.errors.otp ? `<p class="note red">${esc(S.errors.otp)}</p>` : ''}
        <p class="s-sub" style="margin:12px 0 0">By verifying, you agree to the cover and the consents you ticked. <button type="button" class="linkbtn" data-act="otp-back">Change my choices</button></p></div>`;
    }
    const hs = E.HEALTH_QUESTIONS.map((q, i) => `<div class="yn"><span>${i + 1}. ${esc(q.text)}</span><span class="pill ${S.health[q.id] === 'No' ? 'green' : 'red'}">${esc(S.health[q.id])}</span></div>`).join('');
    const sms = `<div class="sms"><small>LoanBee · Messages · ${time(S.sent.at)}</small>${esc(firstName())}, your ${esc(S.loan.type.toLowerCase())} ${S.ref} is approved. Review optional Credit Life cover before disbursal: lnbee.in/c/${S.ref.slice(-4)}</div>`;
    return `${sms}${title('Protect your family from this loan', 'Optional. Your loan is approved either way.')}
    <div class="block"><div class="block-head"><img class="pulse" src="./assets/pulse.gif" alt=""><div><b>Credit Life · ${E.PLANS[p.plan].short}</b><span>Clears the loan if ${p.plan === 'joint' ? 'either borrower dies' : 'you die'} during the term</span></div></div>
      <div class="block-body">
        <div class="sumrow"><span>Cover</span><b>${inr(p.sumInsured)}</b></div>
        <div class="sumrow"><span>Term</span><b>${S.loan.tenure} months</b></div>
        <div class="sumrow"><span>One-time premium</span><b>${inr2(p.total)}</b></div>
        <div class="sumrow"><span>How you pay</span><b>${fin ? 'Added to your loan' : 'Before disbursal'}</b></div>
        ${fin ? `<div class="emi"><div><span>EMI without cover</span><b>${inr(p.emiBefore)}</b></div><span class="arrow">→</span><div><span>EMI with cover</span><b>${inr(p.emiAfter)}</b><span class="delta">+${inr(p.emiDelta)} a month</span></div></div>` : ''}
        <details class="terms" data-terms ${c.readTerms ? 'open' : ''}><summary>What's covered and what isn't</summary><div class="tb">
          <h4>Covered</h4><ul><li>Death from any cause during the cover term.</li><li>${p.plan === 'reducing' ? 'The payout matches the loan balance on that date.' : p.plan === 'level' ? 'The lender is paid the balance. The rest of the cover goes to your nominee.' : 'Cover applies to both borrowers. It pays once, on the first death.'}</li></ul>
          <h4>Not covered</h4><ul><li>Suicide within 12 months of the cover start.</li><li>Health conditions not declared below.</li></ul>
          <h4>Good to know</h4><ul><li>Cover ends when the loan closes or at age 68, whichever is first.</li><li>Cancel within 30 days for a full refund (free look).</li><li>Your nominee claims through LoanBee or the insurer.</li></ul>
        </div></details>
      </div></div>
    <div class="card"><h3>Your health answers</h3>${hs}
      <label class="check"><input type="checkbox" data-c="health" ${c.health ? 'checked' : ''}><span>These are my answers and they are true. I understand that wrong answers can lead to a rejected claim.</span></label></div>
    <div class="card"><h3>Nominee</h3><div class="sumrow"><span>${esc(S.applicant.nomineeRelation)}</span><b>${esc(S.applicant.nominee)}</b></div>
      <label class="check"><input type="checkbox" data-c="nominee" ${c.nominee ? 'checked' : ''}><span>This is the nominee I want.</span></label></div>
    <div class="card"><h3>Your consent</h3>
      <label class="check"><input type="checkbox" data-c="c1" ${c.c1 ? 'checked' : ''}><span>I want Credit Life on these terms. I know it's optional and not a condition of my loan.</span></label>
      <label class="check"><input type="checkbox" data-c="c2" ${c.c2 ? 'checked' : ''}><span>${fin ? `Add ${inr2(p.total)} to my loan. My EMI becomes ${inr(p.emiAfter)}.` : `I'll pay ${inr2(p.total)} before disbursal.`}</span></label>
      ${!c.readTerms ? '<p class="note">Open "What\'s covered and what isn\'t" before accepting.</p>' : ''}</div>`;
  }

  /* Step 6 · Done */
  function stepDone() {
    if (S.decision === 'accepted') {
      const p = S.sent.price;
      return `<div class="success"><div class="tick">✓</div><h2 class="s-title">Cover starts at disbursal</h2><p class="s-sub">${esc(S.applicant.name)} verified at ${time(S.cust.verifiedAt)} · Certificate ${S.coi}</p></div>
      <div class="card"><div class="sumrow"><span>Loan sanctioned</span><b>${inr(S.loan.amount)}</b></div>
        <div class="sumrow"><span>Credit Life premium</span><b>${inr2(p.total)}</b></div>
        <div class="sumrow"><span>${S.payMode === 'loan' ? 'Loan to disburse' : 'Premium collected'}</span><b>${S.payMode === 'loan' ? inr2(p.financedAmount) : 'Before disbursal'}</b></div>
        <div class="sumrow"><span>EMI</span><b>${inr(S.payMode === 'loan' ? p.emiAfter : p.emiBefore)}</b></div>
        <div class="sumrow"><span>Cover</span><b>${inr(p.sumInsured)} · ${E.PLANS[p.plan].short}</b></div></div>
      <button type="button" class="doclink" data-doc="mef"><span class="ic">✎</span><span><b>Membership & health form</b><span>Pre-filled from this application</span></span><em>View</em></button>
      <button type="button" class="doclink" data-doc="coi"><span class="ic">◈</span><span><b>Certificate of insurance</b><span>${S.coi}</span></span><em>View</em></button>
      <button type="button" class="doclink" data-act="evidence"><span class="ic">⤓</span><span><b>Consent record</b><span>JSON for the loan system</span></span><em>Download</em></button>`;
    }
    const why = S.decision === 'declined' ? `${esc(firstName())} declined on their phone at ${time(S.declinedAt)}.` : S.decision === 'agent-declined' ? 'The customer told the agent they don\'t want cover.' : 'Credit Life was not available on these terms.';
    return `<div class="success"><div class="tick gray">✓</div><h2 class="s-title">Loan continues without cover</h2><p class="s-sub">${why}</p></div>
      <div class="card"><div class="sumrow"><span>Loan to disburse</span><b>${inr(S.loan.amount)}</b></div><div class="sumrow"><span>EMI</span><b>${inr(E.emi(S.loan.amount, S.loan.rate, S.loan.tenure))}</b></div><div class="sumrow"><span>Credit Life</span><b>None</b></div></div>
      <button type="button" class="doclink" data-act="evidence"><span class="ic">⤓</span><span><b>Decision record</b><span>Shows the offer and the outcome</span></span><em>Download</em></button>`;
  }

  function dock() {
    if (S.view === 'customer') {
      if (S.decision === 'declined' || S.decision === 'accepted') return `<button class="btn" data-act="to-agent">Back to agent app</button>`;
      if (S.cust.stage === 'otp') return `<button class="btn green" data-act="verify" ${S.cust.otp.length === 6 ? '' : 'disabled'}>Verify and accept</button>`;
      const c = S.cust, ready = c.readTerms && c.health && c.nominee && c.c1 && c.c2;
      return `<button class="btn green" data-act="accept" ${ready ? '' : 'disabled'}>Accept and get code</button><button class="btn ghost" data-act="cust-decline">No thanks, continue without cover</button>`;
    }
    switch (S.step) {
      case 1: return `<button class="btn" data-act="next">Continue to loan</button>`;
      case 2: return `<button class="btn" data-act="next">Continue to protection</button>`;
      case 3: return `<button class="btn green" data-act="check" ${E.HEALTH_QUESTIONS.every(q => S.health[q.id]) ? '' : 'disabled'}>Check suitability</button><p class="caption" style="margin:0">${E.HEALTH_QUESTIONS.every(q => S.health[q.id]) ? 'Need questions are optional. Unanswered ones never count towards a recommendation.' : 'Answer all four health questions to continue.'}</p>`;
      case 4: {
        const r = assess();
        if (!r.eligibility.eligible) {
          const fix = /(\d+) months/.exec(r.eligibility.suggestion || '');
          return `${fix ? `<button class="btn green" data-act="fix-tenure" data-months="${fix[1]}">Change tenure to ${fix[1]} months</button>` : ''}<button class="btn ${fix ? 'ghost' : ''}" data-act="no-cover">Continue without cover</button>`;
        }
        return `<button class="btn green" data-act="send">Send to ${esc(firstName())} for consent</button><button class="btn ghost" data-act="agent-decline">Customer doesn't want cover</button>`;
      }
      case 5: return `<button class="btn green" data-act="to-customer">Open ${esc(firstName())}'s phone</button>`;
      default: return `<button class="btn" data-act="restart">Start another borrower</button>`;
    }
  }

  function renderApp(keepScroll = true) {
    const sc = $('#app .scroll');
    const pos = keepScroll && sc && sc.dataset.key === S.view + S.step ? sc.scrollTop : 0;
    const customer = S.view === 'customer';
    const body = customer ? customerScreen() : S.step === 1 ? stepBorrower() : S.step === 2 ? stepLoan() : S.step === 3 ? stepNeeds() : S.step === 4 ? stepCover() : S.step === 5 ? stepWaiting() : stepDone();
    $('#app').innerHTML = `${appbar(customer)}<div class="scroll" data-key="${S.view + S.step}">${body}</div><div class="dock">${dock()}<div class="home-ind"></div></div>`;
    $('#app .scroll').scrollTop = pos;
    document.querySelectorAll('[data-view]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.view === S.view));
      if (b.dataset.view === 'customer') b.disabled = !S.sent;
    });
  }

  /* ── decision view ──────────────────────── */
  function renderDecision() {
    const r = assess();
    const last = S.events[S.events.length - 1];
    const ring = (score, band) => {
      const c = 2 * Math.PI * 26, col = band === 'high' ? '#00c98f' : band === 'medium' ? '#013a51' : '#fdd340';
      return `<div class="ring"><svg width="62" height="62"><circle cx="31" cy="31" r="26" fill="none" stroke="#eee" stroke-width="6"/><circle cx="31" cy="31" r="26" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}"/></svg><b>${score}</b></div>`;
    };
    const bandText = { high: 'High need · recommend', medium: 'Some need · offer as optional', low: 'Low need · offer only if asked' }[r.need.band];
    const p = r.price;
    const { age, coAge } = ages();
    const showPrice = S.step >= 4 && r.eligibility.eligible && p;
    const ratio = S.loan.tenure ? E.averageOutstandingRatio(S.loan.rate, S.loan.tenure) : 0;
    const c = S.cust;
    const reasonNeeded = S.step >= 4 && r.eligibility.eligible && needsReason(r);
    const guard = [
      ['Need assessed before any offer', S.assessedAt ? 'ok' : 'wait', S.assessedAt ? `At ${time(S.assessedAt)}` : 'Runs at step 3'],
      ['Cover not pre-selected', 'ok', 'Agent and customer each choose'],
      ['Reason recorded for low need or other plan', !reasonNeeded ? (S.step >= 4 ? 'ok' : 'wait') : S.reason.trim().length >= 10 ? 'ok' : 'no', !reasonNeeded ? 'Not needed for this offer' : S.reason.trim().length >= 10 ? 'Recorded' : 'Required before sending'],
      ['Optional, not a loan condition, shown to customer', c.viewedAt ? 'ok' : 'wait', c.viewedAt ? `Shown ${time(c.viewedAt)}` : 'On the customer\'s phone'],
      ['Customer opened cover terms', c.readTerms ? 'ok' : 'wait', ''],
      ['Customer confirmed health answers', c.health ? 'ok' : 'wait', ''],
      [S.payMode === 'loan' ? 'Separate consent to add premium to loan' : 'Separate consent to pay upfront', c.c2 ? 'ok' : 'wait', ''],
      ['Verified by one-time code', c.verifiedAt ? 'ok' : 'wait', c.verifiedAt ? `At ${time(c.verifiedAt)}` : '']
    ];
    const ico = s => `<i class="${s}">${s === 'ok' ? '✓' : s === 'no' ? '!' : '·'}</i>`;
    $('#decision').innerHTML = `
      <div class="dv-head"><p class="eyebrow">Symbo decision view</p><h2>Need, eligibility & consent</h2></div>
      <div class="sec latest"><p class="eyebrow">Latest change</p><b>${esc(last ? last.title : 'Pick a borrower to begin')}</b><span>${esc(last ? last.detail : '')}</span></div>
      <details class="sec" ${S.step <= 4 ? 'open' : ''}><summary><span><b>Suitability</b><span class="s">${r.need.answered}/${r.need.total} answered${S.step < 4 ? ' · live preview' : ''}</span></span></summary><div class="sb">
        <div class="meter">${ring(r.need.score, r.need.band)}<div><b style="font:600 15px var(--fd)">${bandText}</b><br><span class="s" style="font-size:12.5px;color:var(--g500)">Suggested: ${E.PLANS[r.recommendation.plan].name}</span></div></div>
        <ul class="reasons">${r.need.reasons.map(x => `<li><span>${esc(x.label)}</span><b class="${x.points >= 0 ? 'pos' : 'neg'}">${x.points > 0 ? '+' : ''}${x.points}</b></li>`).join('') || '<li><span>No answers yet. Nothing counts towards need.</span><b>0</b></li>'}</ul>
      </div></details>
      <details class="sec" ${S.step <= 4 ? 'open' : ''}><summary><span><b>Eligibility</b><span class="s">${r.eligibility.eligible ? 'All rules met' : r.eligibility.checks.filter(x => !x.ok).length + ' rule(s) not met'}</span></span>${r.eligibility.eligible ? '<span class="pill green">Eligible</span>' : '<span class="pill red">Not eligible</span>'}</summary><div class="sb">
        <ul class="checks">${r.eligibility.checks.map(x => `<li>${ico(x.ok ? 'ok' : (x.id === 'health' && !E.HEALTH_QUESTIONS.every(q => S.health[q.id])) ? 'wait' : 'no')}<span>${esc(x.label)}<small>${esc(x.detail)}</small></span></li>`).join('')}</ul>
      </div></details>
      <details class="sec" ${showPrice && S.step === 4 ? 'open' : ''}><summary><span><b>Price build-up</b><span class="s">${showPrice ? `${E.PLANS[r.chosen].name} · ${inr2(p.total)}` : 'After the suitability check'}</span></span></summary><div class="sb">
        ${showPrice ? `<div class="calc">Rate ₹${p.ratePerThousand} per ₹1,000 a year · age ${age}${r.chosen === 'joint' ? '/' + coAge : ''}<br>× cover <b>${inr(p.sumInsured)}</b> × ${S.loan.tenure / 12} yrs${r.chosen !== 'level' ? `<br>× average balance ${(ratio * 100).toFixed(1)}%` : ''}<br>= premium <b>${inr2(p.base)}</b><br>+ GST 18% <b>${inr2(p.gst)}</b><br>= single premium <b>${inr2(p.total)}</b></div>
          <ul class="reasons" style="margin-top:8px"><li><span>EMI before → after</span><b>${inr(p.emiBefore)} → ${inr(p.emiAfter)}</b></li><li><span>EMI share of income</span><b class="${r.affordability.ok ? 'pos' : 'neg'}">${r.affordability.emiShareBefore}% → ${r.affordability.emiShareAfter}%</b></li><li><span>Rate card</span><b>${E.RULES.version}</b></li></ul>` : '<p class="s-sub" style="margin:12px 0 0;font-size:12.5px;color:var(--g500)">Priced from age, cover, term and loan balance once the check runs.</p>'}
      </div></details>
      <details class="sec" ${S.step >= 4 ? 'open' : ''}><summary><span><b>Guardrails</b><span class="s">${guard.filter(g => g[1] === 'ok').length}/${guard.length} met</span></span></summary><div class="sb">
        <ul class="checks">${guard.map(g => `<li>${ico(g[1])}<span>${esc(g[0])}${g[2] ? `<small>${esc(g[2])}</small>` : ''}</span></li>`).join('')}</ul>
      </div></details>
      <details class="sec" open><summary><span><b>Live records</b><span class="s">${S.events.length} event${S.events.length === 1 ? '' : 's'}</span></span></summary><div class="sb">
        <ul class="log">${[...S.events].reverse().map(e => `<li><time>${time(e.at)}</time><b>${esc(e.title)}</b><span>${esc(e.detail)}</span></li>`).join('')}</ul>
        <button type="button" class="dlbtn" data-act="evidence">Download audit evidence</button>
      </div></details>
      <p class="dv-foot">Illustrative rate card and rules (${E.RULES.version}). Not an insurer's filed product. No real loan, SMS, OTP, payment or policy.</p>`;
  }

  function render(keep = true) { renderPersonas(); renderApp(keep); renderDecision(); }

  /* ── mini loader ────────────────────────── */
  async function mini(titleText, steps) {
    const m = $('#mini');
    $('#mini-title').textContent = titleText;
    $('#mini-steps').innerHTML = steps.map(s => `<li>${esc(s)}</li>`).join('');
    $('#mini-bar').style.width = '0';
    m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
    const lis = [...document.querySelectorAll('#mini-steps li')];
    const per = reduceMotion ? 60 : 520;
    await sleep(reduceMotion ? 0 : 350);
    for (let i = 0; i < lis.length; i++) {
      lis[i].classList.add('on');
      await sleep(per);
      lis[i].classList.remove('on'); lis[i].classList.add('ok');
      $('#mini-bar').style.width = ((i + 1) / lis.length * 100) + '%';
    }
    await sleep(reduceMotion ? 0 : 280);
    m.classList.remove('show');
  }

  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3200); }
  function showErrors(e) {
    S.errors = e;
    renderApp();
    const first = Object.values(e)[0];
    if (first) { toast(first); const bad = document.querySelector('#app .f.bad input, #app .f.bad select, #app .f.bad textarea'); bad?.focus(); }
  }

  /* ── actions ────────────────────────────── */
  const actions = {
    back() { if (S.step > 1 && S.step < 5) { S.step--; S.errors = {}; render(false); } },
    next() {
      const e = S.step === 1 ? validBorrower() : validLoan();
      if (Object.keys(e).length) return showErrors(e);
      S.errors = {};
      if (S.step === 1) log('Borrower details captured', `${S.applicant.name}, age ${ages().age}${S.applicant.coBorrower ? ` · co-borrower ${S.applicant.coBorrowerName}` : ''}`);
      if (S.step === 2) log('Loan terms confirmed', `${S.loan.type} ${inr(S.loan.amount)} · ${S.loan.tenure} months · ${S.loan.rate}%`);
      S.step++; render(false);
    },
    async check() {
      await mini('Checking suitability', ['Eligibility · age and tenure', 'Health declaration', 'Need score · ' + Object.keys(S.answers).length + ' answers', 'Pricing · rate card ' + E.RULES.version]);
      const r = assess();
      S.assessedAt = Date.now(); S.plan = null;
      log('Suitability assessed', r.eligibility.eligible ? `Need ${r.need.score}/100 (${r.need.band}) · suggests ${E.PLANS[r.recommendation.plan].name}` : `Not eligible: ${r.eligibility.checks.filter(c => !c.ok).map(c => c.label).join(', ')}`);
      S.step = 4; render(false);
    },
    'fix-tenure'(el) {
      const m = Number(el.dataset.months);
      log('Tenure changed to fit cover rules', `${S.loan.tenure} → ${m} months`);
      S.loan.tenure = m; S.plan = null; render();
      toast(`Tenure set to ${m} months. EMI and cover updated.`);
    },
    'no-cover'() { S.decision = 'ineligible'; log('Loan continues without cover', 'Credit Life not available on these terms'); S.step = 6; render(false); },
    'agent-decline'() { S.decision = 'agent-declined'; log('Customer declined at agent step', 'Recorded by agent AG-1042'); S.step = 6; render(false); },
    async send() {
      const r = assess();
      if (needsReason(r) && S.reason.trim().length < 10) return showErrors({ reason: 'Record the customer\'s reason (at least 10 characters) before sending.' });
      S.errors = {};
      await mini('Sending to customer', ['Locking price snapshot', 'Pre-filling membership form', 'Sending secure link by SMS']);
      S.sent = { at: Date.now(), price: r.price, plan: r.chosen, need: r.need, recommendation: r.recommendation, reason: S.reason.trim(), version: E.RULES.version };
      log('Offer sent to customer', `${E.PLANS[r.chosen].name} · ${inr2(r.price.total)} · ${S.payMode === 'loan' ? 'added to loan' : 'upfront'} · SMS to ${mask(S.applicant.mobile)}`);
      S.step = 5; S.view = 'customer'; markViewed(); render(false);
    },
    'to-customer'() { S.view = 'customer'; markViewed(); render(false); },
    'to-agent'() { S.view = 'agent'; render(false); },
    accept() {
      S.cust.stage = 'otp'; S.cust.otp = ''; S.cust.code = String(Math.floor(100000 + Math.random() * 900000)); S.cust.otpAt = Date.now(); S.errors = {};
      log('Customer accepted · code sent', `One-time code to ${mask(S.applicant.mobile)}`);
      render(false);
      setTimeout(() => document.querySelector('[data-otp="0"]')?.focus(), 30);
    },
    'otp-back'() { S.cust.stage = 'review'; S.errors = {}; render(false); },
    async verify() {
      if (S.cust.otp !== S.cust.code) { log('Incorrect code entered', ''); S.cust.otp = ''; return showErrors({ otp: "That code doesn't match. Try again." }); }
      S.errors = {};
      await mini('Recording consent', ['Verifying one-time code', 'Saving consent snapshot', 'Issuing certificate']);
      S.cust.verifiedAt = Date.now(); S.decision = 'accepted';
      S.coi = 'CL-LB-' + new Date().getFullYear() + '-' + String(Math.floor(1e6 + Math.random() * 9e6));
      log('Consent verified', `Code verified · certificate ${S.coi}`);
      S.step = 6; S.view = 'agent'; render(false);
    },
    'cust-decline'() {
      S.decision = 'declined'; S.declinedAt = Date.now();
      log('Customer declined on their phone', 'Loan continues without cover');
      S.step = 6; render(false);
    },
    restart() { load(S.persona === 'blank' ? 'blank' : S.persona); },
    evidence() { download(); }
  };
  function markViewed() { if (!S.cust.viewedAt) { S.cust.viewedAt = Date.now(); log('Customer opened the secure link', 'Optional and not a loan condition shown first'); } }

  /* ── evidence & documents ───────────────── */
  function evidence() {
    const r = assess(), { age, coAge } = ages();
    return {
      record: 'Symbo Credit Life decision record (demo)', reference: S.ref, generatedAt: new Date().toISOString(), rulesVersion: E.RULES.version,
      agent: 'AG-1042', lender: 'LoanBee Finance (fictional)',
      borrower: { name: S.applicant.name, age, gender: S.applicant.gender, mobile: mask(S.applicant.mobile), occupation: S.applicant.occupation, monthlyIncome: S.applicant.income, dependants: S.applicant.dependants, coBorrower: S.applicant.coBorrower ? { name: S.applicant.coBorrowerName, age: coAge } : null, nominee: { name: S.applicant.nominee, relationship: S.applicant.nomineeRelation } },
      loan: { ...S.loan, emi: Math.round(E.emi(S.loan.amount || 0, S.loan.rate || 0, S.loan.tenure || 1)) },
      needAnswers: S.answers, healthDeclaration: S.health,
      assessment: { assessedAt: S.assessedAt && new Date(S.assessedAt).toISOString(), eligible: r.eligibility.eligible, checks: r.eligibility.checks, need: r.need, suggestedPlan: r.recommendation },
      offer: S.sent ? { sentAt: new Date(S.sent.at).toISOString(), plan: S.sent.plan, price: S.sent.price, payment: S.payMode, agentReason: S.sent.reason || null } : null,
      outcome: S.decision || 'in progress',
      customerConsent: S.sent ? {
        linkOpenedAt: S.cust.viewedAt && new Date(S.cust.viewedAt).toISOString(), termsOpened: S.cust.readTerms, healthConfirmed: S.cust.health, nomineeConfirmed: S.cust.nominee,
        coverConsent: S.cust.c1, paymentConsent: S.cust.c2, verifiedAt: S.cust.verifiedAt && new Date(S.cust.verifiedAt).toISOString(), method: 'One-time code to registered mobile (simulated)'
      } : null,
      certificate: S.coi, events: S.events.map(e => ({ at: new Date(e.at).toISOString(), title: e.title, detail: e.detail }))
    };
  }
  function download() {
    const blob = new Blob([JSON.stringify(evidence(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `credit-life-${S.ref}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Decision record downloaded.');
  }
  function openDoc(kind) {
    const a = S.applicant, p = S.sent.price, { age, coAge } = ages();
    const start = new Date(S.cust.verifiedAt), end = new Date(start); end.setMonth(end.getMonth() + Number(S.loan.tenure));
    const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    const head = (t, sub) => `<div class="dhead"><div><img src="./assets/symbo-logo.png" alt="Symbo" style="height:20px;margin-bottom:10px"><h2>${t}</h2><div style="color:var(--g500);font-size:12px;margin-top:4px">${sub}</div></div><div class="stamp">PRE-FILLED BY SYMBO<br>${S.ref}</div></div>`;
    let html;
    if (kind === 'mef') {
      html = `${head('Membership enrolment form & declaration of good health', 'Group Credit Life · master policyholder LoanBee Finance (fictional) · illustrative')}
      <h3>Member</h3><table>${row('Name', esc(a.name))}${row('Date of birth · age', `${dateStr(a.dob)} · ${age}`)}${row('Gender', esc(a.gender))}${row('Mobile · email', `${mask(a.mobile)} · ${esc(a.email)}`)}${row('Occupation', esc(a.occupation))}${row('Monthly income', inr(a.income))}</table>
      ${a.coBorrower ? `<h3>Co-borrower</h3><table>${row('Name', esc(a.coBorrowerName))}${row('Date of birth · age', `${dateStr(a.coBorrowerDob)} · ${coAge}`)}${row('Covered', p.plan === 'joint' ? 'Yes, joint cover' : 'No')}</table>` : ''}
      <h3>Loan</h3><table>${row('Loan account', S.ref)}${row('Type', esc(S.loan.type))}${row('Sanctioned amount', inr(S.loan.amount))}${row('Tenure · interest', `${S.loan.tenure} months · ${S.loan.rate}% p.a.`)}</table>
      <h3>Cover</h3><table>${row('Plan', E.PLANS[p.plan].name)}${row('Sum insured', inr(p.sumInsured))}${row('Cover term', `${S.loan.tenure} months`)}${row('Premium · GST · total', `${inr2(p.base)} · ${inr2(p.gst)} · ${inr2(p.total)}`)}${row('Premium payment', S.payMode === 'loan' ? 'Added to loan' : 'Paid before disbursal')}</table>
      <h3>Nominee</h3><table>${row('Name', esc(a.nominee))}${row('Relationship', esc(a.nomineeRelation))}</table>
      <h3>Declaration of good health</h3><table>${E.HEALTH_QUESTIONS.map((q, i) => row(`${i + 1}. ${esc(q.text)}`, `<b>${esc(S.health[q.id])}</b>`)).join('')}</table>
      <h3>Declaration</h3><p>I declare that the answers above are true and complete. I understand the cover is optional, is not a condition of my loan, and that untrue answers may lead to a claim being declined. I consent to the premium being ${S.payMode === 'loan' ? 'added to my loan' : 'collected before disbursal'}.</p>
      <table>${row('Agent', 'AG-1042 · pre-filled from the loan application')}${row('Customer confirmation', `One-time code to ${mask(a.mobile)} verified ${new Date(S.cust.verifiedAt).toLocaleString('en-IN')}`)}</table>`;
    } else {
      html = `${head('Certificate of insurance', 'Group Credit Life · illustrative certificate, not an insurance contract')}
      <table>${row('Certificate number', `<b>${S.coi}</b>`)}${row('Member', esc(a.name) + (p.plan === 'joint' ? ' and ' + esc(a.coBorrowerName) : ''))}${row('Loan account', S.ref)}${row('Plan', E.PLANS[p.plan].name)}${row('Sum insured at start', inr(p.sumInsured))}${row('Cover period', `${dateStr(start)} to ${dateStr(end)} (from disbursal)`)}${row('Single premium (incl. GST)', inr2(p.total))}${row('Nominee', `${esc(a.nominee)} (${esc(a.nomineeRelation)})`)}${row('Beneficiary for loan balance', 'LoanBee Finance (fictional)')}</table>
      <h3>Benefit</h3><p>${E.PLANS[p.plan].blurb} Cover ends when the loan closes or at age 68, whichever is first. Suicide within 12 months of cover start is excluded. Free-look period: 30 days.</p>`;
    }
    const wrap = document.createElement('div');
    wrap.className = 'docwrap';
    wrap.innerHTML = `<div class="doc" role="dialog" aria-modal="true"><div class="docbar"><button type="button" data-close>Close</button><button type="button" class="primary" data-print>Print / save PDF</button></div>${html}<div class="dfoot">Generated ${new Date().toLocaleString('en-IN')} · Symbo suitability demo · rules ${E.RULES.version}. Fictional lender and illustrative rates.</div></div>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); if (e.target.closest('[data-print]')) print(); });
    wrap.querySelector('[data-close]').focus();
    log(kind === 'mef' ? 'Membership form opened' : 'Certificate opened', S.coi);
    renderDecision();
  }

  /* ── events ─────────────────────────────── */
  function load(id) {
    const p = PERSONAS.find(x => x.id === id);
    S = fresh(p);
    log(p.id === 'blank' ? 'New borrower started' : `${p.title} is the active borrower`, p.blurb);
    render(false);
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-persona],[data-act],[data-plan],[data-pay],[data-view],[data-doc]');
    if (!t) return;
    if (t.dataset.persona) return load(t.dataset.persona);
    if (t.dataset.view) {
      if (t.dataset.view === 'customer' && S.sent && S.step < 6) { S.view = 'customer'; markViewed(); }
      else S.view = t.dataset.view === 'customer' && S.sent ? 'customer' : 'agent';
      return render(false);
    }
    if (t.dataset.doc) return openDoc(t.dataset.doc);
    if (t.dataset.plan) { S.plan = t.dataset.plan; const r = assess(); log('Plan changed', `${E.PLANS[S.plan].name} · ${inr2(r.price.total)}`); return render(); }
    if (t.dataset.pay) { if (S.payMode !== t.dataset.pay) { S.payMode = t.dataset.pay; const r = assess(); log('Payment changed', `${S.payMode === 'loan' ? 'Added to loan' : 'Pay upfront'} · EMI ${inr(r.price.emiAfter)}`); } return render(); }
    const fn = actions[t.dataset.act];
    if (fn) fn(t);
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.k) {
      setPath(el.dataset.k, readInput(el));
      if (S.errors[el.dataset.k]) { delete S.errors[el.dataset.k]; el.closest('.f')?.classList.remove('bad'); }
      renderDecision();
      if (S.step === 2 && el.dataset.k.startsWith('loan.')) refreshLoanHero();
    }
    if (el.dataset.otp !== undefined) {
      const i = Number(el.dataset.otp);
      el.value = el.value.replace(/\D/g, '').slice(-1);
      const arr = S.cust.otp.padEnd(6, ' ').split('');
      arr[i] = el.value || ' ';
      S.cust.otp = arr.join('').replace(/\s+$/, '');
      if (el.value && i < 5) document.querySelector(`[data-otp="${i + 1}"]`)?.focus();
      const v = document.querySelector('[data-act="verify"]'); if (v) v.disabled = S.cust.otp.replace(/\s/g, '').length !== 6;
    }
  });
  document.addEventListener('keydown', e => {
    const el = e.target;
    if (el.dataset?.otp !== undefined && e.key === 'Backspace' && !el.value) document.querySelector(`[data-otp="${Number(el.dataset.otp) - 1}"]`)?.focus();
    if (el.dataset?.otp !== undefined && e.key === 'Enter' && S.cust.otp.length === 6) actions.verify();
  });
  document.addEventListener('paste', e => {
    if (e.target.dataset?.otp === undefined) return;
    const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (d.length === 6) { e.preventDefault(); S.cust.otp = d; renderApp(); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.k && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date')) {
      setPath(el.dataset.k, readInput(el));
      if (el.dataset.k === 'loan.tenure') S.loan.tenure = Number(el.value);
      delete S.errors[el.dataset.k];
      return render();
    }
    if (el.name && /^(answers|health)\./.test(el.name)) {
      setPath(el.name, el.value);
      const q = el.name.startsWith('answers') ? E.NEED_QUESTIONS.find(x => 'answers.' + x.id === el.name)?.title : 'Health question ' + el.name.slice(-1);
      log('Answer recorded', `${q}: ${el.value}`);
      return render();
    }
    if (el.dataset.c) {
      S.cust[el.dataset.c] = el.checked;
      const labels = { health: 'Health answers confirmed', nominee: 'Nominee confirmed', c1: 'Cover consent ticked', c2: S.payMode === 'loan' ? 'Consent to add premium to loan ticked' : 'Consent to pay upfront ticked' };
      log(el.checked ? labels[el.dataset.c] : labels[el.dataset.c].replace('ticked', 'removed').replace('confirmed', 'unconfirmed'), 'By the customer');
      return render();
    }
  });
  document.addEventListener('toggle', e => {
    if (e.target.matches?.('[data-terms]') && e.target.open && !S.cust.readTerms) {
      S.cust.readTerms = true; log('Customer opened cover terms', 'Covered, not covered, free look'); renderDecision();
      renderApp();
    }
  }, true);
  function refreshLoanHero() {
    const l = S.loan, emi = l.amount > 0 && l.tenure > 0 ? E.emi(l.amount, l.rate || 0, l.tenure) : 0;
    const amt = document.querySelector('.loan-hero .amt'); if (amt) amt.textContent = l.amount ? inr(l.amount) : '₹—';
    const kv = document.querySelectorAll('.kv b'); if (kv[1]) kv[1].textContent = emi ? inr(emi) : '—'; if (kv[2]) kv[2].textContent = (l.rate || '—') + '% p.a.';
  }

  function tickClock() { const d = new Date(); $('#clock').textContent = (d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0'); }
  tickClock(); setInterval(tickClock, 30000);

  load('ravi');
  window.SY_LOADER?.ready({ partners: 6, programs: 8 });
})();

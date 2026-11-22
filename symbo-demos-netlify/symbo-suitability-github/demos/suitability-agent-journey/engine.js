/* Symbo · Credit Life suitability engine (illustrative demo rules)
   Pure functions. Runs in the browser (window.CreditLifeEngine) and in Node (module.exports).
   Rates, limits and weights are demo configuration, not an insurer's filed rate card. */
(function (root) {
  'use strict';

  const RULES = {
    version: 'CL-2026.11-demo',
    minEntryAge: 18,
    maxEntryAge: 65,
    maxMaturityAge: 68,
    minTenure: 6,
    maxTenure: 84,
    maxNonMedicalSI: 5000000,
    gstRate: 0.18,
    minPremium: 250,
    jointFactor: 0.9,
    /* Annual premium per ₹1,000 of cover, by age last birthday. Illustrative. */
    rateCard: [
      [18, 25, 1.10], [26, 30, 1.25], [31, 35, 1.55], [36, 40, 2.05], [41, 45, 2.90],
      [46, 50, 4.10], [51, 55, 6.00], [56, 60, 8.80], [61, 65, 12.50]
    ]
  };

  const PLANS = {
    reducing: { id: 'reducing', name: 'Reducing cover', short: 'Reducing', blurb: 'Cover follows the loan balance. If the borrower dies, the outstanding loan is cleared.' },
    level: { id: 'level', name: 'Level cover', short: 'Level', blurb: 'Cover stays at the full amount. The lender is repaid first and the rest goes to the nominee.' },
    joint: { id: 'joint', name: 'Joint cover', short: 'Joint', blurb: 'Covers borrower and co-borrower. The loan is cleared on the first death.' }
  };

  const HEALTH_QUESTIONS = [
    { id: 'h1', text: 'In the last 3 years, have you been in hospital for more than 7 days in a row?' },
    { id: 'h2', text: 'Are you being treated for heart disease, cancer, stroke, kidney or liver disease, or HIV?' },
    { id: 'h3', text: 'Have you been away from work for more than 14 days because of illness in the last 6 months?' },
    { id: 'h4', text: 'Has any life insurance application of yours been declined, postponed or charged extra?' }
  ];

  const NEED_QUESTIONS = [
    { id: 'repay', title: 'If the borrower died, who would repay this loan?', options: ['Family would have to', 'Co-borrower would', 'Savings would cover it', 'Not sure'] },
    { id: 'cover', title: 'Existing life cover', options: ['None', 'Less than the loan', 'Covers the loan'] },
    { id: 'collateral', title: 'Is the loan secured on the home or business premises?', options: ['Yes', 'No'] },
    { id: 'household', title: 'Household income', options: ['Single income', 'Two or more incomes'] }
  ];

  const round2 = n => Math.round(n * 100) / 100;
  const rupees = n => Math.round(n);

  function emi(principal, annualRate, months) {
    const r = annualRate / 1200;
    if (!r) return principal / months;
    const f = Math.pow(1 + r, months);
    return principal * r * f / (f - 1);
  }

  /* Average outstanding principal over the term as a share of the original principal. */
  function averageOutstandingRatio(annualRate, months) {
    const r = annualRate / 1200;
    const pay = emi(1, annualRate, months);
    let bal = 1, sum = 0;
    for (let m = 0; m < months; m++) {
      sum += bal;
      bal = bal * (1 + r) - pay;
    }
    return sum / months;
  }

  function rateFor(age) {
    const row = RULES.rateCard.find(([lo, hi]) => age >= lo && age <= hi);
    return row ? row[2] : null;
  }

  /* Premium (before GST) for ₹1 of cover. */
  function unitPremium(plan, ages, loan) {
    const years = loan.tenure / 12;
    const rates = ages.map(rateFor);
    if (rates.some(r => r == null)) return null;
    let annual = plan === 'joint' ? (rates[0] + rates[1]) * RULES.jointFactor : rates[0];
    const ratio = plan === 'level' ? 1 : averageOutstandingRatio(loan.rate, loan.tenure);
    return annual / 1000 * years * ratio;
  }

  /* Price one plan. When financed, cover includes the premium itself (SI = loan + premium). */
  function price(plan, applicant, loan, financed) {
    const ages = plan === 'joint' ? [applicant.age, applicant.coBorrowerAge] : [applicant.age];
    const u = unitPremium(plan, ages, loan);
    if (u == null) return null;
    const k = u * (1 + RULES.gstRate);
    let sumInsured = financed ? loan.amount / (1 - k) : loan.amount;
    sumInsured = Math.ceil(sumInsured / 100) * 100;
    const base = Math.max(RULES.minPremium, sumInsured * u);
    const gst = base * RULES.gstRate;
    const total = base + gst;
    if (financed) sumInsured = Math.max(sumInsured, Math.ceil((loan.amount + total) / 100) * 100);
    const financedAmount = financed ? loan.amount + total : loan.amount;
    const emiBefore = emi(loan.amount, loan.rate, loan.tenure);
    const emiAfter = emi(financedAmount, loan.rate, loan.tenure);
    return {
      plan, sumInsured, base: round2(base), gst: round2(gst), total: round2(total),
      financed, financedAmount: round2(financedAmount),
      emiBefore: round2(emiBefore), emiAfter: round2(emiAfter), emiDelta: round2(emiAfter - emiBefore),
      perMonth: round2(total / loan.tenure),
      ratePerThousand: plan === 'joint' ? round2((rateFor(ages[0]) + rateFor(ages[1])) * RULES.jointFactor) : rateFor(ages[0])
    };
  }

  function eligibility(applicant, loan, health) {
    const checks = [];
    const add = (id, label, ok, detail) => checks.push({ id, label, ok, detail });
    const maturity = applicant.age + loan.tenure / 12;
    add('entry', 'Entry age 18 to 65', applicant.age >= RULES.minEntryAge && applicant.age <= RULES.maxEntryAge, `Borrower is ${applicant.age}`);
    add('maturity', 'Cover ends by age 68', maturity <= RULES.maxMaturityAge, `Age at end of loan: ${Math.ceil(maturity * 10) / 10}`);
    add('tenure', 'Loan tenure 6 to 84 months', loan.tenure >= RULES.minTenure && loan.tenure <= RULES.maxTenure, `${loan.tenure} months`);
    add('si', 'Cover within ₹50 lakh without medicals', loan.amount <= RULES.maxNonMedicalSI * 0.97, `Loan ₹${Math.round(loan.amount).toLocaleString('en-IN')}`);
    const answered = HEALTH_QUESTIONS.every(q => health[q.id] === 'No' || health[q.id] === 'Yes');
    const clean = HEALTH_QUESTIONS.every(q => health[q.id] === 'No');
    add('health', 'Good health declaration', answered && clean, !answered ? 'Answer all four questions' : clean ? 'All four answered No' : 'One or more answered Yes: refer to underwriting');
    if (applicant.coBorrower) {
      const cm = applicant.coBorrowerAge + loan.tenure / 12;
      add('coborrower', 'Co-borrower age 18 to 65, ends by 68', applicant.coBorrowerAge >= 18 && applicant.coBorrowerAge <= 65 && cm <= RULES.maxMaturityAge, `Co-borrower is ${applicant.coBorrowerAge}`);
    }
    const core = checks.filter(c => c.id !== 'coborrower');
    const eligible = core.every(c => c.ok);
    let suggestion = '';
    if (!checks.find(c => c.id === 'maturity').ok && applicant.age < RULES.maxMaturityAge) {
      const maxT = Math.floor((RULES.maxMaturityAge - applicant.age) * 12 / 6) * 6;
      if (maxT >= RULES.minTenure) suggestion = `A tenure of ${maxT} months or less keeps cover within age 68.`;
    }
    const referral = answered && !clean ? 'underwriting' : (!checks.find(c => c.id === 'si').ok ? 'medicals' : '');
    return { eligible, checks, suggestion, referral, jointEligible: !!applicant.coBorrower && !!checks.find(c => c.id === 'coborrower')?.ok };
  }

  function need(applicant, loan, answers) {
    const reasons = [];
    const add = (label, points) => reasons.push({ label, points });
    if (answers.repay === 'Family would have to') add('Family would have to repay the loan', 30);
    if (answers.repay === 'Not sure') add('No clear repayment plan if the borrower dies', 15);
    if (answers.repay === 'Co-borrower would') add('Co-borrower would carry the full EMI alone', 10);
    if (answers.repay === 'Savings would cover it') add('Savings would cover the balance', -15);
    if (applicant.dependants >= 1) add(`${applicant.dependants} dependant${applicant.dependants > 1 ? 's' : ''} on this income`, 20);
    if (applicant.dependants >= 3) add('Three or more dependants', 10);
    if (answers.household === 'Single income') add('Single-income household', 15);
    if (answers.collateral === 'Yes') add('Home or business premises pledged as security', 15);
    if (loan.tenure >= 24) add('Loan runs two years or more', 10);
    if (applicant.income > 0 && loan.amount >= applicant.income * 12) add('Loan is a year or more of income', 10);
    if (answers.cover === 'Covers the loan') add('Existing life cover already clears this loan', -30);
    if (answers.cover === 'Less than the loan') add('Existing cover is less than the loan', 5);
    if (applicant.dependants === 0 && answers.repay !== 'Family would have to') add('No one depends on this income', -10);
    const raw = reasons.reduce((n, r) => n + r.points, 0);
    const score = Math.max(0, Math.min(100, raw));
    const band = score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
    const answered = NEED_QUESTIONS.filter(q => answers[q.id]).length;
    return { score, band, reasons, answered, total: NEED_QUESTIONS.length };
  }

  function recommendPlan(applicant, answers, elig) {
    if (applicant.coBorrower && elig.jointEligible && (answers.household === 'Two or more incomes' || answers.repay === 'Co-borrower would')) {
      return { plan: 'joint', why: 'Both incomes pay the EMI, so either death would leave the other with the loan.' };
    }
    if (applicant.dependants >= 2 && answers.repay === 'Family would have to' && answers.cover !== 'Covers the loan') {
      return { plan: 'level', why: 'Clears the loan and leaves the remaining cover to a family with several dependants and no other life cover.' };
    }
    return { plan: 'reducing', why: 'Matches the outstanding balance at the lowest premium. Enough to stop the loan passing to the family.' };
  }

  function assess(input) {
    const applicant = {
      age: Number(input.applicant.age) || 0, income: Number(input.applicant.income) || 0,
      dependants: Number(input.applicant.dependants) || 0, coBorrower: !!input.applicant.coBorrower,
      coBorrowerAge: Number(input.applicant.coBorrowerAge) || 0
    };
    const loan = { amount: Number(input.loan.amount) || 0, tenure: Number(input.loan.tenure) || 0, rate: Number(input.loan.rate) || 0 };
    const answers = input.answers || {};
    const health = input.health || {};
    const financed = input.payMode !== 'upfront';
    const elig = eligibility(applicant, loan, health);
    const n = need(applicant, loan, answers);
    const rec = recommendPlan(applicant, answers, elig);
    const plans = {};
    for (const id of ['reducing', 'level', 'joint']) {
      if (id === 'joint' && !elig.jointEligible) continue;
      const p = price(id, applicant, loan, financed);
      if (p) plans[id] = p;
    }
    const chosen = plans[input.plan] ? input.plan : rec.plan in plans ? rec.plan : 'reducing';
    const p = plans[chosen];
    const emiShare = p && applicant.income ? p.emiAfter / applicant.income : 0;
    const affordability = p ? {
      emiShareBefore: applicant.income ? round2(p.emiBefore / applicant.income * 100) : 0,
      emiShareAfter: round2(emiShare * 100),
      ok: emiShare <= 0.5,
      note: emiShare > 0.5 ? 'EMI would be over half of monthly income. Discuss paying the premium upfront or a lower cover.' : 'EMI stays within half of monthly income.'
    } : null;
    return { version: RULES.version, eligibility: elig, need: n, recommendation: rec, plans, chosen, price: p, affordability, financed };
  }

  function ageFromDob(dob, on = new Date()) {
    const d = new Date(dob);
    if (isNaN(d)) return 0;
    let a = on.getFullYear() - d.getFullYear();
    const m = on.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && on.getDate() < d.getDate())) a--;
    return a;
  }

  const api = { RULES, PLANS, HEALTH_QUESTIONS, NEED_QUESTIONS, emi, averageOutstandingRatio, rateFor, price, eligibility, need, recommendPlan, assess, ageFromDob, rupees };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CreditLifeEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);

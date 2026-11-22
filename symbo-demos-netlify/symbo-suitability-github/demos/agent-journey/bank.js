/* KBI Bank channel: sanctioned loans, suitability questions, loan-protection products and their pitch scripts.
   Rates are illustrative (operator note, not shown to customers). Credit Life is listed but not enabled. */
import { inr, firstName } from './store.js';

const DAY = 864e5;
export const emiOf = (p, annualRate, months) => { const r = annualRate / 1200; return Math.round(p * r * (1 + r) ** months / ((1 + r) ** months - 1)); };
const lakh = n => n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(2)} L` : inr(n);
export const short = lakh;

/* ── loan book ─────────────────────────── */
const L = (id, name, product, amount, tenure, rate, age, occ, employer, income, city, days, mobile, existingEmi = 0) =>
  ({ id, name, product, amount, tenure, rate, age, occ, employer, income, city, existingEmi, mobile, email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com', sanctionedAt: Date.now() - days * DAY, emi: emiOf(amount, rate, tenure) });
export const LOANS = [
  L('KBI-HL-2611-00412', 'Ananya Kulkarni', 'Home loan', 20000000, 240, 8.6, 38, 'Salaried', 'Northwind Technologies', 425000, 'Pune', 1, '9000010412', 0),
  L('KBI-LAP-2611-00871', 'Suresh Menon', 'Loan against property', 8500000, 180, 9.4, 49, 'Self-employed', 'Menon Textiles', 380000, 'Kochi', 2, '9000010871', 22000),
  L('KBI-HL-2611-02210', 'Pooja Iyer', 'Home loan', 6200000, 240, 8.7, 33, 'Salaried', 'Bluewave Analytics', 185000, 'Bengaluru', 3, '9000012210', 0),
  L('KBI-BL-2611-01544', 'Farhan Qureshi', 'Business loan', 4000000, 60, 13.5, 44, 'Self-employed', 'Qureshi Auto Parts', 310000, 'Hyderabad', 1, '9000011544', 15000),
  L('KBI-EL-2611-05170', 'Arjun Nair', 'Education loan', 1800000, 84, 10.2, 24, 'Salaried', 'Student · co-borrower parent', 60000, 'Chennai', 4, '9000015170', 0),
  L('KBI-AL-2611-03318', 'Vikram Rathore', 'Car loan', 1250000, 60, 9.1, 36, 'Salaried', 'Crestline Logistics', 140000, 'Jaipur', 5, '9000013318', 0),
  L('KBI-PL-2611-04821', 'Neha Sharma', 'Personal loan', 600000, 36, 11.5, 32, 'Salaried', 'Silverleaf Healthcare', 95000, 'Mumbai', 0, '9000014821', 0),
  L('KBI-GL-2611-06233', 'Lakshmi Reddy', 'Gold loan', 240000, 12, 9.9, 51, 'Self-employed', 'Reddy Provisions', 55000, 'Vijayawada', 2, '9000016233', 0),
  L('KBI-PL-2611-07045', 'Ravi Kumar', 'Personal loan', 150000, 24, 12.5, 29, 'Salaried', 'Metro Retail Pvt Ltd', 42000, 'Delhi', 6, '9000017045', 3500),
  L('KBI-TW-2611-08190', 'Sameer Khan', 'Two-wheeler loan', 30000, 12, 14.0, 23, 'Salaried', 'QuickDrop Couriers', 24000, 'Lucknow', 0, '9000018190', 0)
];
export const DEFAULT_LOAN = 'KBI-PL-2611-04821';
export const findLoan = id => LOANS.find(l => l.id.toLowerCase() === String(id || '').trim().toLowerCase()) || null;

/* ── suitability questions (loan facts come from the loan file, not asked again) ── */
export const QUESTIONS = [
  { id: 'dependants', title: 'How many people depend on your income?', hint: 'Sizes accident and EMI protection.', options: ['None', '1–2', '3 or more'] },
  { id: 'lifeCover', title: 'Do you have life cover that would repay this loan if something happened to you?', hint: 'Checks whether the loan is already protected.', options: ['Yes, enough', 'Some, not enough', 'No'] },
  { id: 'health', title: 'What health insurance do you have today?', hint: 'Avoids overlap with hospital benefits.', options: ['Personal policy', 'Employer cover only', 'None'] },
  { id: 'hospitalEmi', title: 'If you were in hospital for a week, could you keep paying the EMI?', hint: 'Assesses EMI Protect and Hospital Cash.', options: ['Yes, comfortably', 'It would be difficult', 'Not sure'] },
  { id: 'jobSecurity', title: 'If your income stopped, how many months of EMI could your savings cover?', hint: 'Job-loss EMI cover applies to salaried customers.', options: ['6 months or more', '2 to 6 months', 'Less than 2 months'], salariedOnly: true },
  { id: 'travel', title: 'How do you usually travel for work?', hint: 'Accident exposure for Personal Accident cover.', options: ['Mostly office or home', 'Daily two-wheeler or long commute', 'Frequent intercity travel'] },
  { id: 'wellness', title: 'Would you use doctor teleconsultations and an annual health check-up?', hint: 'Value-added health plan.', options: ['Yes', 'No'] },
  { id: 'digital', title: 'Do you pay mostly by UPI or cards, and want protection against fraud?', hint: 'Value-added card and UPI protection.', options: ['Yes', 'No', 'Already covered'] }
];
export const relevantQuestions = loan => QUESTIONS.filter(q => !q.salariedOnly || loan.occ === 'Salaried');

/* ── products ─────────────────────────── */
export const PRODUCTS = [
  { id: 'pa', name: 'Personal Accident Shield', category: 'Accident cover', description: 'A lump sum if an accident causes death or permanent disability, sized to the loan.',
    terms: 'One-year cover. Accidental death and permanent total disability pay 100% of the sum insured; Plus adds permanent partial disability on a scale and a weekly benefit during temporary total disability (up to 52 weeks). Sum insured follows the loan amount between ₹5 lakh and ₹1 crore. Excludes self-injury, intoxication, hazardous sports and war. Policy wording governs claims.' },
  { id: 'emi', name: 'EMI Protect', category: 'Loan protection', description: 'Pays your EMIs to the bank if hospitalisation or job loss stops your income.',
    terms: 'One-year cover. Pays up to the chosen number of EMIs (up to ₹50,000 each) when hospitalised for more than three days; for salaried customers also on involuntary job loss after a 90-day waiting period. Resignation, termination for cause and probation are excluded. Benefits are paid directly to the loan account.' },
  { id: 'hospicash', name: 'Hospital Cash', category: 'Health benefit', description: 'A fixed daily amount for every day in hospital, on top of any health insurance.',
    terms: 'One-year cover, entry age up to 60. Pays the chosen daily amount from the second day of hospitalisation, up to 30 days a year; double in ICU. 30-day waiting period for illness, none for accidents. Pre-existing conditions are covered after two years. A fixed benefit, not a reimbursement of bills.' },
  { id: 'creditlife', name: 'Credit Life', category: 'Life cover for the loan', description: 'Repays the outstanding loan if the borrower dies.', terms: 'Not enabled for this channel.' },
  { id: 'wellness', name: 'Health & Wellness Plan', category: 'Value-added service', description: 'Unlimited doctor teleconsultations, an annual check-up and pharmacy discounts.',
    terms: 'One-year membership. Unlimited GP teleconsultations, one annual health check-up per member at partner labs, up to 20% off at partner pharmacies. Family covers two adults and two children. A service membership, not insurance.' },
  { id: 'cardsafe', name: 'Card & UPI Safe', category: 'Value-added service', description: 'Protection against card and UPI fraud, with one-call blocking.',
    terms: 'One-year protection. Covers unauthorised card and UPI transactions up to the chosen limit when reported within 10 days, plus one-call blocking of all cards and SIM. Excludes transactions authorised by the customer, including sharing an OTP.' }
];
export const ICONS = { pa: 'ph-person-simple-run', emi: 'ph-calendar-check', hospicash: 'ph-hospital', creditlife: 'ph-umbrella-simple', wellness: 'ph-heart', cardsafe: 'ph-credit-card' };

const gst = n => Math.round(n * 1.18);
const risky = ans => ['Daily two-wheeler or long commute', 'Frequent intercity travel'].includes(ans.travel);
export function signals(id, ans, loan) {
  const f = firstName(loan.name), s = [];
  if (id === 'pa') {
    if (ans.dependants && ans.dependants !== 'None') s.push(`${ans.dependants} people depend on ${f}'s income.`);
    if (risky(ans)) s.push(`${ans.travel} raises accident exposure.`);
    if (ans.lifeCover === 'No') s.push(`No life cover would repay the ${lakh(loan.amount)} loan.`);
    if (ans.lifeCover === 'Some, not enough') s.push(`Existing life cover would not fully repay the loan.`);
  }
  if (id === 'emi') {
    if (['It would be difficult', 'Not sure'].includes(ans.hospitalEmi)) s.push(`A week in hospital would put the ${inr(loan.emi)} EMI at risk.`);
    if (ans.jobSecurity === 'Less than 2 months') s.push(`Savings would cover less than two months of EMI.`);
    if (ans.jobSecurity === '2 to 6 months') s.push(`Savings cover only two to six months of EMI.`);
  }
  if (id === 'hospicash') {
    if (ans.health === 'None') s.push(`${f} has no health insurance today.`);
    if (ans.health === 'Employer cover only') s.push(`Only employer cover today, which ends with the job.`);
    if (ans.hospitalEmi === 'It would be difficult') s.push(`Daily costs in hospital would strain the budget.`);
  }
  if (id === 'wellness' && ans.wellness === 'Yes') s.push(`${f} would use teleconsultations and an annual check-up.`);
  if (id === 'cardsafe' && ans.digital === 'Yes') s.push(`${f} pays mostly by UPI or cards and wants fraud protection.`);
  return s;
}

/* Two- or three-word reasons for the recommendation card. */
export function tags(id, ans) {
  const t = [];
  if (id === 'pa') { if (ans.dependants && ans.dependants !== 'None') t.push(`${ans.dependants} dependants`); if (risky(ans)) t.push(ans.travel.startsWith('Daily') ? 'Daily two-wheeler' : 'Frequent travel'); if (ans.lifeCover === 'No') t.push('No life cover'); if (ans.lifeCover === 'Some, not enough') t.push('Life cover short'); }
  if (id === 'emi') { if (['It would be difficult', 'Not sure'].includes(ans.hospitalEmi)) t.push('EMI at risk in hospital'); if (ans.jobSecurity === 'Less than 2 months') t.push('Under 2 months savings'); if (ans.jobSecurity === '2 to 6 months') t.push('Thin savings'); }
  if (id === 'hospicash') { if (ans.health === 'None') t.push('No health cover'); if (ans.health === 'Employer cover only') t.push('Employer cover only'); }
  if (id === 'wellness' && ans.wellness === 'Yes') t.push('Wants teleconsults');
  if (id === 'cardsafe' && ans.digital === 'Yes') t.push('UPI and card user');
  return t;
}

export function assess(loan, ans) {
  const f = firstName(loan.name);
  const salaried = loan.occ === 'Salaried';
  const load = risky(ans) ? 1.25 : 1;
  return PRODUCTS.map(p => {
    let eligible = true, recommended = false, reason = '', variant = '', variants = [], disabled = false;
    if (p.id === 'pa') {
      const si = Math.min(1e7, Math.max(5e5, Math.round(loan.amount / 1e5) * 1e5));
      variants = [{ name: `Basic · ${lakh(si)}`, price: gst(si * 0.0006 * load) }, { name: `Plus · ${lakh(si)}`, price: gst(si * 0.001 * load) }];
      eligible = loan.age >= 18 && loan.age <= 65;
      recommended = eligible && signals('pa', ans, loan).length > 0;
      variant = (!salaried || risky(ans) || ans.dependants === '3 or more') ? variants[1].name : variants[0].name;
      reason = !eligible ? 'Entry age is 18 to 65.' : recommended ? 'Dependants, travel or missing life cover point to accident protection.' : `No dependants, low travel exposure and enough life cover reported.`;
    } else if (p.id === 'emi') {
      const covered = Math.min(loan.emi, 50000);
      variants = [{ name: '3 EMIs', price: gst(covered * 0.15) }, { name: '6 EMIs', price: gst(covered * 0.27) }];
      eligible = loan.tenure >= 12 && loan.age <= 60;
      recommended = eligible && signals('emi', ans, loan).length > 0;
      variant = (ans.jobSecurity === 'Less than 2 months' || ans.dependants === '3 or more') ? '6 EMIs' : '3 EMIs';
      reason = !eligible ? 'Needs a tenure of 12 months or more and entry age up to 60.' : recommended ? (salaried ? 'Hospitalisation or job loss would put EMIs at risk.' : 'Hospitalisation would put EMIs at risk. Job-loss cover applies to salaried customers only.') : `${f} could keep paying EMIs through a hospital stay.`;
    } else if (p.id === 'hospicash') {
      const old = loan.age > 45 ? 1.4 : 1;
      variants = [{ name: '₹1,000 a day', price: Math.round(749 * old) }, { name: '₹2,000 a day', price: Math.round(1399 * old) }];
      eligible = loan.age <= 60;
      recommended = eligible && ['Employer cover only', 'None'].includes(ans.health);
      variant = (loan.income >= 100000 || ans.dependants === '3 or more') ? variants[1].name : variants[0].name;
      reason = !eligible ? 'Entry age is up to 60.' : recommended ? 'No personal health policy, so a daily hospital benefit fills a real gap.' : ans.health === 'Personal policy' ? 'A personal health policy is already in place; avoid overlap.' : 'Health cover has not been discussed.';
    } else if (p.id === 'creditlife') {
      eligible = false; disabled = true; reason = 'Not enabled for this channel yet.';
    } else if (p.id === 'wellness') {
      variants = [{ name: 'Individual', price: 599 }, { name: 'Family', price: 999 }];
      recommended = ans.wellness === 'Yes';
      variant = ans.dependants && ans.dependants !== 'None' ? 'Family' : 'Individual';
      reason = recommended ? 'Would use teleconsultations and a yearly check-up.' : 'No interest in teleconsultations or check-ups.';
    } else if (p.id === 'cardsafe') {
      variants = [{ name: '₹50,000 limit', price: 399 }, { name: '₹1,00,000 limit', price: 699 }];
      recommended = ans.digital === 'Yes';
      variant = loan.income >= 150000 ? variants[1].name : variants[0].name;
      reason = recommended ? 'Pays mostly digitally and wants fraud protection.' : ans.digital === 'Already covered' ? 'Already has fraud protection.' : 'No fraud-protection need stated.';
    }
    const v = variants.find(x => x.name === variant);
    return { ...p, eligible, recommended, reason, variant, variants, disabled, price: v ? v.price : 0 };
  });
}

export function pitchFor(loan, ans, p) {
  const f = firstName(loan.name), why = signals(p.id, ans, loan), price = inr(p.price);
  switch (p.id) {
    case 'pa': return {
      headline: 'If an accident happens, the family is not left with the loan',
      why: [...why, `Sum insured follows the ${lakh(loan.amount)} loan.`],
      say: `"${f}, your family depends on your income and this loan runs for ${loan.tenure} months. Personal Accident Shield pays ${p.variant.split('· ')[1]} if an accident causes death or permanent disability${p.variant.startsWith('Plus') ? ', and a weekly amount if an injury keeps you off work' : ''}. It is ${price} for the year."`,
      points: ['Lump sum on accidental death or permanent disability', p.variant.startsWith('Plus') ? 'Weekly benefit while temporarily unable to work' : 'Upgrade to Plus adds a weekly benefit while off work', 'Claim paid to the nominee or the customer'],
      limits: 'Accidents only, not illness. Excludes self-injury, intoxication and hazardous sports.',
      objection: ['"I already have life insurance."', 'Life cover pays on death. This also pays if an accident leaves you disabled and unable to earn.']
    };
    case 'emi': return {
      headline: 'Your EMI keeps getting paid when your income stops',
      why,
      say: `"${f}, your EMI is ${inr(loan.emi)}. If you are in hospital for more than three days${loan.occ === 'Salaried' ? ' or lose your job' : ''}, EMI Protect pays up to ${p.variant} straight to the loan account, so it stays regular. It is ${price} for the year."`,
      points: [`Up to ${p.variant} of ${inr(Math.min(loan.emi, 50000))} each`, 'Paid straight to the loan account', loan.occ === 'Salaried' ? 'Covers hospitalisation and involuntary job loss' : 'Covers hospitalisation'],
      limits: `Job-loss cover starts after 90 days and excludes resignation or termination for cause.${loan.occ === 'Salaried' ? '' : ' Job-loss cover is for salaried customers only.'}`,
      objection: ['"I have savings."', 'This keeps savings intact for the household while the EMIs are handled.']
    };
    case 'hospicash': return {
      headline: 'A fixed amount for every day in hospital',
      why,
      say: `"${f}, a hospital stay brings costs that insurance does not pay: travel, food, lost days. Hospital Cash pays ${p.variant.replace(' a day', '')} for every day you are admitted, up to 30 days a year, for ${price}."`,
      points: [`${p.variant}, double in ICU`, 'Up to 30 days a year', 'Paid on top of any health insurance'],
      limits: 'Illness cover starts after 30 days. It is a fixed daily benefit, not reimbursement of bills.',
      objection: ['"My employer covers my hospital bills."', 'That pays the hospital. This pays you directly for the costs around the stay.']
    };
    case 'wellness': return {
      headline: 'A doctor on call, and a check-up every year',
      why,
      say: `"${f}, with the ${p.variant} plan you get unlimited doctor teleconsultations, an annual check-up${p.variant === 'Family' ? ' for the family' : ''} and pharmacy discounts. It is ${price} for the year."`,
      points: ['Unlimited GP teleconsultations', 'Annual health check-up at partner labs', 'Up to 20% off at partner pharmacies'],
      limits: 'A service membership, not insurance.',
      objection: ['"I rarely see a doctor."', 'The yearly check-up alone usually costs more than the plan.']
    };
    default: return {
      headline: 'Card and UPI fraud, covered',
      why,
      say: `"${f}, if someone misuses your card or UPI, Card & UPI Safe covers unauthorised transactions up to ${p.variant.replace(' limit', '')} and blocks every card with one call. It is ${price} for the year."`,
      points: [`Unauthorised transactions up to ${p.variant.replace(' limit', '')}`, 'One call blocks all cards and the SIM', 'Report within 10 days'],
      limits: 'Does not cover payments you authorised, including after sharing an OTP.',
      objection: ['"The bank refunds fraud anyway."', 'Refunds depend on when and how it is reported. This adds a guaranteed cover and blocking help.']
    };
  }
}

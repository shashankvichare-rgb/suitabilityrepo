/* Symbo suitability engine (demo build). One pipeline for every partner type:
   signals -> catalogue mapping -> eligibility -> need match -> overlap & affordability -> guardrails -> ranked mix + audit log.
   Catalogue comes from the Symbo Product Master; prices are the master's indicative rates. */
import { PRODUCTS, VAS, BUNDLES, SEGMENTS } from './catalogue.js';

export { PRODUCTS, VAS, BUNDLES, SEGMENTS };
export const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const short = n => n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(2)} L` : inr(n);
const emiOf = (p, rate, m) => { const r = rate / 1200; return m ? Math.round(p * r * (1 + r) ** m / ((1 + r) ** m - 1)) : 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ── customer profiles (one per partner type) ── */
const base = { gender: 'M', city: 'Tier 1', lang: 'English', marital: 'Married', dependants: 2, health: 'None declared', tobacco: 'No', savings: '2–5 months', bureau: '700–750', otherEmi: 0,
  life: 'None', healthCover: 'None', pa: 'No', assetCover: 'No', commute: 'Office / home', upi: 'High', claims: 'None', bounces: 0, channel: 'Digital', staff: 0, rate: 16,
  dataConsent: true, marketingConsent: true };
export const PERSONAS = [
  { ...base, key: 'ravi', name: 'Ravi Kumar', seg: 'NBFC', tag: 'Personal loan · self-employed', ctx: 'loan', txn: 'Personal loan', amount: 60000, tenure: 6, age: 31, occupation: 'Self-employed', income: 38000, savings: 'Under 2 months', upi: 'Low', commute: 'Two-wheeler daily', stage: 'Loan review & e-sign' },
  { ...base, key: 'ananya', name: 'Ananya Iyer', seg: 'BANK', tag: 'Home loan · salaried', ctx: 'loan', txn: 'Home loan', amount: 4500000, tenure: 240, rate: 8.7, age: 34, gender: 'F', occupation: 'Salaried', income: 165000, healthCover: 'Employer only', asset: 6200000, stage: 'Sanction letter' },
  { ...base, key: 'sunita', name: 'Sunita Patil', seg: 'MFI', tag: 'Group loan · rural', ctx: 'loan', txn: 'Group (JLG) loan', amount: 40000, tenure: 18, rate: 22, age: 38, gender: 'F', city: 'Rural', lang: 'Marathi', occupation: 'Self-employed', income: 14000, dependants: 3, savings: 'Under 2 months', bureau: 'New to credit', upi: 'Low', channel: 'Assisted', stage: 'Centre meeting disbursal' },
  { ...base, key: 'imran', name: 'Imran Shaikh', seg: 'MER', tag: 'Kirana · working capital', ctx: 'business', txn: 'Merchant loan', amount: 300000, tenure: 12, rate: 18, age: 42, occupation: 'Self-employed', income: 70000, dependants: 3, asset: 800000, staff: 2, commute: 'Two-wheeler daily', stage: 'Settlement-linked offer' },
  { ...base, key: 'kabir', name: 'Kabir Singh', seg: 'MOB', tag: 'Delivery rider · 2W loan', ctx: 'gig', txn: 'Two-wheeler loan', amount: 85000, tenure: 24, rate: 15, age: 26, marital: 'Single', dependants: 1, occupation: 'Gig worker', income: 26000, savings: 'Under 2 months', bureau: 'New to credit', commute: 'On the road all day', asset: 95000, stage: 'Partner onboarding' },
  { ...base, key: 'meera', name: 'Meera Nair', seg: 'TRV', tag: 'Family trip · Singapore', ctx: 'trip', txn: 'International flight + hotel', amount: 184000, tenure: 0, age: 36, gender: 'F', occupation: 'Salaried', income: 140000, healthCover: 'Personal policy', life: 'Adequate', days: 7, intl: true, hotel: 62000, stage: 'Booking checkout' },
  { ...base, key: 'arvind', name: 'Arvind Rao', seg: 'EDU', tag: 'Daughter\'s MS abroad', ctx: 'fee', txn: 'Education fee financing', amount: 1800000, tenure: 84, rate: 10.5, age: 49, occupation: 'Salaried', income: 150000, healthCover: 'Employer only', life: 'Partial', intl: true, asset: 85000, stage: 'Fee plan set-up' },
  { ...base, key: 'priya', name: 'Priya Menon', seg: 'RET', tag: 'Phone on EMI', ctx: 'purchase', txn: 'Smartphone on no-cost EMI', amount: 74999, tenure: 9, rate: 0, age: 27, gender: 'F', marital: 'Single', dependants: 0, occupation: 'Salaried', income: 62000, healthCover: 'Employer only', asset: 74999, device: 'Mobile', stage: 'Store checkout' }
];
export const OPTIONS = {
  occupation: ['Salaried', 'Self-employed', 'Gig worker', 'Homemaker', 'Retired'], dependants: [0, 1, 2, 3, 4], savings: ['Under 2 months', '2–5 months', '6+ months'],
  life: ['None', 'Partial', 'Adequate'], healthCover: ['None', 'Employer only', 'Personal policy'], pa: ['No', 'Yes'], commute: ['Office / home', 'Two-wheeler daily', 'On the road all day'],
  upi: ['Low', 'High'], channel: ['Digital', 'Assisted'], city: ['Tier 1', 'Tier 2', 'Tier 3', 'Rural']
};

/* ── derived features ── */
export function derive(p) {
  const emi = p.tenure ? emiOf(p.amount, p.rate || 0.01, p.tenure) : 0;
  const foir = p.income ? Math.round((emi + (p.otherEmi || 0)) / p.income * 100) : 0;
  const vulnerable = p.age >= 60 || p.channel === 'Assisted' || p.income < 18000 || p.bureau === 'New to credit';
  const ticket = p.ctx === 'trip' ? p.amount : p.ctx === 'purchase' ? p.amount : p.amount;
  const capPct = p.ctx === 'trip' ? 6 : p.ctx === 'purchase' ? 8 : ticket <= 100000 ? 4 : ticket <= 1000000 ? 2.5 : 1;
  const budget = Math.max(300, Math.round(ticket * capPct / 100));
  return { emi, foir, vulnerable, senior: p.age >= 60, ticket, capPct, budget, lowBuffer: p.savings === 'Under 2 months', road: p.commute !== 'Office / home' };
}
/* Every datapoint the engine reads, grouped. `edit` marks the ones exposed as controls. */
export function datapoints(p) {
  const d = derive(p);
  const G = (group, rows) => rows.map(([label, value, src]) => ({ group, label, value: String(value), src: src || 'partner' }));
  return [
    ...G('Customer', [['Age', p.age], ['Gender', p.gender], ['City tier', p.city], ['Occupation', p.occupation], ['Monthly income', inr(p.income)], ['Dependants', p.dependants], ['Marital status', p.marital], ['Health declaration', p.health], ['Tobacco', p.tobacco], ['Language', p.lang]]),
    ...G('Money', [['Savings buffer', p.savings], ['Bureau band', p.bureau, 'bureau'], ['Other EMIs', inr(p.otherEmi)], ['Missed EMIs (12m)', p.bounces, 'bureau'], ['FOIR', d.foir + '%', 'derived'], ['Premium budget', inr(d.budget), 'derived']]),
    ...G('Transaction', [['Product', p.txn], ['Ticket', short(p.amount)], ['Tenure', p.tenure ? p.tenure + ' months' : (p.days ? p.days + ' days' : '–')], ['EMI', d.emi ? inr(d.emi) : '–', 'derived'], ['Asset value', p.asset ? short(p.asset) : '–'], ['Interest rate', p.rate ? p.rate + '%' : '–'], ['Journey stage', p.stage], ['KYC', 'Verified', 'kyc']]),
    ...G('Cover held', [['Life cover', p.life], ['Health cover', p.healthCover], ['Accident cover', p.pa], ['Asset / device cover', p.assetCover], ['Past claims', p.claims]]),
    ...G('Behaviour', [['Travel exposure', p.commute], ['UPI / digital use', p.upi], ['Staff employed', p.staff], ['Channel', p.channel], ['Segment', SEGMENTS[p.seg]], ['Income pattern', ['Self-employed', 'Gig worker'].includes(p.occupation) ? 'Variable' : 'Steady', 'derived'], ['Earners in household', p.marital === 'Single' ? 1 : (p.occupation === 'Homemaker' ? 1 : '1–2')], ['Preferred contact', 'WhatsApp']]),
    ...G('Safeguards', [['Data consent (DPDP)', p.dataConsent ? 'Captured' : 'Missing', 'consent'], ['Marketing consent', p.marketingConsent ? 'Captured' : 'Missing', 'consent'], ['Vulnerable-customer flag', d.vulnerable ? 'Yes' : 'No', 'derived'], ['Senior citizen', d.senior ? 'Yes' : 'No', 'derived'], ['Premium cap', d.capPct + '% of ticket', 'policy'], ['Free-look window', '30 days', 'policy']])
  ];
}

/* ── need vector: 0..1 per protection need, each with the signals behind it ── */
function needs(p, d) {
  const N = {}, why = {};
  const add = (k, v, reason) => { if (v > 0) { N[k] = clamp((N[k] || 0) + v, 0, 1); (why[k] ||= []).push(reason); } };
  const loan = ['loan', 'business', 'gig', 'fee'].includes(p.ctx) && p.amount > 0;
  if (loan && p.dependants > 0 && p.life !== 'Adequate') { add('repay', p.life === 'None' ? .75 : .45, `${p.dependants} dependant${p.dependants > 1 ? 's' : ''}, ${p.life === 'None' ? 'no' : 'partial'} life cover`); if (p.tenure >= 60) add('repay', .2, `${Math.round(p.tenure / 12)}-year tenure`); }
  if (loan && d.lowBuffer) add('emi', .6, 'Savings cover under 2 months of EMI');
  if (loan && d.foir >= 30) add('emi', .3, `EMIs take ${d.foir}% of income`);
  if (loan && p.occupation === 'Salaried' && p.savings !== '6+ months') add('emi', .2, 'Single salary income');
  if (p.healthCover === 'None') { add('cash', .7, 'No health cover'); add('hosp', .65, 'No health cover'); }
  if (p.healthCover === 'Employer only') { add('cash', .4, 'Employer cover only'); add('topup', .6, 'Employer cover ends with the job'); }
  if (p.pa === 'No' && d.road) add('acc', .7, p.commute);
  if (p.pa === 'No' && p.dependants > 0) add('acc', .25, 'Family depends on this income');
  if (p.pa === 'No' && ['Self-employed', 'Gig worker'].includes(p.occupation)) add('acc', .25, 'No employer accident cover');
  if (p.upi === 'High') add('cyber', .55, 'Pays mostly by UPI');
  if (p.city === 'Rural' || p.city === 'Tier 3') add('vector', .5, `${p.city} · monsoon disease exposure`);
  if (p.gender === 'F' && p.age >= 30) add('women', .35, 'Woman, 30+');
  if (p.ctx === 'purchase') { add('device', .8, `${p.device || 'Device'} worth ${short(p.amount)}`); add('warranty', .55, 'Warranty ends after year one'); if (p.tenure) add('emi', .2, `${p.tenure} EMIs on the device`); }
  if (p.ctx === 'business') { add('shop', .8, `Stock and shop worth ${short(p.asset || 0)}`); add('cyber', .3, 'Accepts QR payments'); if (p.staff) add('staff', .5, `${p.staff} staff employed`); add('device', .3, 'Soundbox / POS in use'); }
  if (p.ctx === 'gig') { add('gigIncome', .8, 'Income stops when off the road'); add('gigHealth', .6, 'Daily earner, no employer cover'); add('vehicle', .6, 'Vehicle is the livelihood'); }
  if (p.ctx === 'trip') { add('tripCancel', .6, `${short(p.amount)} booked upfront`); add('tripDelay', .4, 'Connecting itinerary'); if (p.intl) { add('tripMedical', .9, 'Medical costs abroad'); add('visa', .45, 'Visa decision pending'); } if (p.dependants) add('tripCancel', .2, 'Travelling with family'); }
  if (p.ctx === 'fee') { add('fee', .85, 'Fees depend on one earner'); if (p.intl) { add('feeVisa', .6, 'Deposit at risk on visa refusal'); add('studentHealth', .5, 'Student health abroad'); } add('device', .25, 'Laptop for the course'); }
  if (p.txn.includes('Home')) add('home', .8, `Home worth ${short(p.asset || p.amount)}`);
  if (p.txn.includes('Two-wheeler') || p.txn.includes('Car')) add('vehicle', .5, 'Vehicle financed');
  return { N, why };
}

/* ── product rules: needs served, context required, overlap, price ── */
const lakh = (v, rate) => Math.round(v / 1e5 * rate);
const band = (v, steps) => steps.find(([max]) => v <= max)[1];
const R = {
  'FIN-01': { n: { acc: 1 }, ctx: 'any', ovl: 'pa', price: p => lakh(clamp(Math.max(p.amount, 500000), 5e5, 25e5), 50), unit: 'a year' },
  'FIN-02': { n: { repay: 1 }, ctx: 'loan+', ovl: 'life', age: [18, 65], price: p => lakh(p.amount, 700), unit: 'for the loan' },
  'FIN-03': { n: { emi: .8, repay: .5, cash: .3 }, ctx: 'loan+', max: 100000, price: p => lakh(p.amount, 1400), unit: 'for the loan' },
  'FIN-04': { n: { emi: 1 }, ctx: 'loan+', min: 100001, price: (p, d) => Math.round(d.emi / 1000 * 120), unit: 'a year' },
  'FIN-05': { n: { cash: 1 }, ctx: 'any', ovl: 'healthFull', price: p => band(p.income, [[25000, 350], [50000, 550], [100000, 750], [1e9, 950]]), unit: 'a year, with wellness' },
  'FIN-06': { n: { vector: 1 }, ctx: 'any', price: p => p.income < 30000 ? 215 : 275, unit: 'a year' },
  'FIN-07': { n: { cyber: 1 }, ctx: 'any', price: p => band(p.income, [[25000, 150], [60000, 299], [120000, 399], [1e9, 599]]), unit: 'a year' },
  'FIN-08': { n: { acc: .5 }, ctx: 'any' }, 'FIN-09': { n: { acc: .3 }, ctx: 'any' }, 'FIN-10': { n: { vector: .4 }, ctx: 'any' },
  'FIN-11': { n: { hosp: 1 }, ctx: 'any', ovl: 'health', price: p => Math.round(5242 * (1 + Math.max(0, p.age - 25) * .035) * (1 + Math.min(p.dependants, 3) * .45)), unit: 'a year' },
  'FIN-12': { n: { topup: 1 }, ctx: 'any', price: p => Math.round(1146 * (1 + Math.max(0, p.age - 25) * .04) * (p.dependants ? 1.6 : 1)), unit: 'a year' },
  'FIN-13': { n: { repay: .6 }, ctx: 'any', ovl: 'life' }, 'FIN-14': { n: { hosp: .4, topup: .3 }, ctx: 'any', minAge: 30 },
  'FIN-15': { n: { parents: 1 }, ctx: 'any' }, 'FIN-16': { n: { chronic: 1 }, ctx: 'any' }, 'FIN-17': { n: { women: 1 }, ctx: 'any', only: p => p.gender === 'F' || 'For women customers' },
  'FIN-18': { n: { cash: .3, hosp: .3 }, ctx: 'any' }, 'FIN-19': { n: { maternity: 1 }, ctx: 'any' }, 'FIN-20': { n: {}, feature: true }, 'FIN-21': { n: { cyber: .6 }, ctx: 'any' }, 'FIN-22': { n: { cyber: .7 }, ctx: 'account' },
  'FIN-23': { n: { acc: .9, gigIncome: .4 }, ctx: 'any', only: p => ['Self-employed', 'Gig worker'].includes(p.occupation) || 'For self-employed and gig customers' },
  'FIN-24': { n: {}, b2b: true }, 'FIN-25': { n: { fee: .4 }, ctx: 'any', only: p => p.dependants > 0 || 'Needs a dependent child' }, 'FIN-26': { n: { repay: .5 }, ctx: 'business|gig' },
  'MER-01': { n: { shop: 1 }, ctx: 'business' }, 'MER-02': { n: { home: 1, shop: .7 }, ctx: 'asset', price: () => 1062, unit: 'a year' }, 'MER-03': { n: { shop: .4 }, ctx: 'business' },
  'MER-04': { n: { gigIncome: .4, shop: .3 }, ctx: 'business|gig' }, 'MER-05': { n: { staff: 1 }, ctx: 'business' }, 'MER-06': { n: { staff: .8 }, ctx: 'business' },
  'MER-07': { n: { cyber: 1 }, ctx: 'business' }, 'MER-08': { n: { device: .9 }, ctx: 'business' },
  'MOT-01': { n: { vehicle: 1 }, ctx: 'vehicle' }, 'MOT-02': { n: { vehicle: .5 }, ctx: 'gig' }, 'MOT-03': { n: {}, feature: true }, 'MOT-04': { n: { vehicle: .3 }, ctx: 'ev' },
  'MOT-05': { n: { acc: .9, vehicle: .3 }, ctx: 'vehicle' }, 'MOT-06': { n: { vehicle: .3 }, ctx: 'car' }, 'MOT-07': { n: { acc: .3 }, ctx: 'car' },
  'MOB-01': { n: { gigHealth: 1 }, ctx: 'gig', price: () => 90, unit: 'a month (₹3 a day)' }, 'MOB-02': { n: { gigHealth: .9 }, ctx: 'gig', only: p => p.dependants >= 2 || 'Needs a family to cover', price: () => 180, unit: 'a month (₹6 a day)' },
  'MOB-03': { n: { gigIncome: 1 }, ctx: 'gig' }, 'MOB-04': { n: { gigIncome: .6, acc: .4 }, ctx: 'gig' }, 'MOB-05': { n: { acc: .7, gigHealth: .6 }, ctx: 'gig', price: () => 1700, unit: 'a year' },
  'MOB-06': { n: {}, ctx: 'ride' }, 'MOB-07': { n: {}, ctx: 'ride' }, 'MOB-08': { n: {}, ctx: 'ride' }, 'MOB-09': { n: {}, ctx: 'ride' }, 'MOB-10': { n: {}, ctx: 'ride' },
  'TRV-01': { n: { tripMedical: .5, tripDelay: .4 }, ctx: 'trip', only: p => !p.intl || 'Trip is international', price: p => Math.round(4.5 * (p.days || 3)), unit: 'for the trip' },
  'TRV-02': { n: {}, ctx: 'trip', only: () => 'Not a pilgrimage trip' },
  'TRV-03': { n: { tripMedical: 1 }, ctx: 'trip', only: p => p.intl || 'Trip is domestic', price: p => 99 * (p.days || 7) * (1 + Math.min(p.dependants, 3)), unit: 'for all travellers' },
  'TRV-04': { n: {}, ctx: 'trip', only: () => 'Inbound travellers only' }, 'TRV-05': { n: { tripMedical: .5 }, ctx: 'trip', only: () => 'Covered by the international plan' },
  'TRV-06': { n: { tripCancel: 1 }, ctx: 'trip', only: p => !p.intl || 'Domestic flights only', price: () => 1050, unit: 'per booking' },
  'TRV-07': { n: { tripCancel: .7 }, ctx: 'trip', price: () => 9, unit: 'per booking' }, 'TRV-08': { n: { tripCancel: .6, tripDelay: .4 }, ctx: 'trip', price: () => 1050, unit: 'per booking' },
  'TRV-09': { n: { tripCancel: .8 }, ctx: 'trip', only: p => !p.intl || 'Indian hotels only', price: p => Math.round((p.hotel || 0) * .0826), unit: 'of hotel fare' },
  'TRV-10': { n: { tripCancel: .5 }, ctx: 'trip', only: p => !p.intl || 'Indian hotels only', price: () => 29, unit: 'per booking' }, 'TRV-11': { n: { tripCancel: .4 }, ctx: 'trip', only: p => !p.intl || 'Indian hotels only' },
  'TRV-12': { n: { tripDelay: 1 }, ctx: 'trip' }, 'TRV-13': { n: { visa: 1 }, ctx: 'trip', only: p => p.intl || 'No visa needed' }, 'TRV-14': { n: { visa: .8, tripCancel: .3 }, ctx: 'trip', only: p => p.intl || 'No visa needed' },
  'TRV-15': { n: {}, ctx: 'trip', only: () => 'Dubai visa sponsors only' },
  'EDU-01': { n: { fee: 1 }, ctx: 'fee', ovl: 'lifeFull', price: p => Math.round(p.amount * .005), unit: 'a year' }, 'EDU-02': { n: { fee: .9, emi: .4 }, ctx: 'fee', price: p => Math.round(p.amount * .015), unit: 'a year' },
  'EDU-03': { n: { emi: .9, fee: .5 }, ctx: 'fee', price: (p, d) => Math.round(d.emi * .03 * 12), unit: 'a year' }, 'EDU-04': { n: { feeVisa: 1 }, ctx: 'fee', only: p => p.intl || 'Study is in India', price: p => Math.round(Math.min(p.amount, 500000) * .022), unit: 'one time' },
  'EDU-05': { n: { studentHealth: 1 }, ctx: 'fee', only: p => p.intl || 'Study is in India' }, 'EDU-06': { n: { device: .8 }, ctx: 'fee', price: p => Math.round((p.asset || 80000) * .1), unit: 'a year' },
  'EDU-07': { n: { fee: .5, acc: .3 }, ctx: 'fee' }, 'EDU-08': { n: {}, b2b: true }, 'EDU-09': { n: {}, b2b: true }, 'EDU-10': { n: {}, b2b: true }, 'EDU-11': { n: {}, b2b: true }, 'EDU-12': { n: { studentHealth: .3 }, ctx: 'fee' },
  'RET-01': { n: { device: 1 }, ctx: 'purchase', price: p => Math.round(p.amount * .02), unit: 'for one year' }, 'RET-02': { n: { warranty: 1 }, ctx: 'purchase', price: p => Math.round(p.amount * .02), unit: 'per extra year' },
  'RET-03': { n: {}, ctx: 'purchase', only: () => 'Wearables only' }, 'RET-04': { n: {}, ctx: 'purchase', only: () => 'Eyewear only' }, 'RET-05': { n: {}, ctx: 'purchase', only: () => 'Footwear only' },
  'RET-06': { n: {}, ctx: 'purchase', only: () => 'Bicycles only' }, 'RET-07': { n: {}, ctx: 'purchase', only: () => 'Sports bookings only' }, 'RET-08': { n: { device: .4 }, ctx: 'purchase', only: () => 'Online checkout only' },
  'RET-09': { n: {}, b2b: true }, 'RET-10': { n: { hosp: .3 }, ctx: 'any', minAge: 40 },
  'LOG-01': { n: {}, b2b: true }, 'LOG-02': { n: {}, b2b: true }, 'LOG-03': { n: {}, b2b: true }
};
const CTX_OK = {
  any: () => true, 'loan+': p => ['loan', 'business', 'gig', 'fee'].includes(p.ctx) && p.amount > 0 || 'No loan in this journey', account: () => 'Sold with a fee-based account',
  business: p => p.ctx === 'business' || 'For merchants and shop owners', 'business|gig': p => ['business', 'gig'].includes(p.ctx) || 'For merchants and gig workers', gig: p => p.ctx === 'gig' || 'For gig and delivery partners',
  asset: p => p.ctx === 'business' || p.txn.includes('Home') || 'No home or shop in this journey', vehicle: p => /Two-wheeler|Car/.test(p.txn) || 'No vehicle in this journey', car: p => p.txn.includes('Car') || 'Cars only',
  ev: () => 'Electric vehicles only', ride: () => 'Per-trip cover for ride passengers', trip: p => p.ctx === 'trip' || 'No trip in this journey', fee: p => p.ctx === 'fee' || 'No education fee in this journey', purchase: p => p.ctx === 'purchase' || 'No device purchase in this journey'
};
const NEED_LABEL = { repay: 'Loan repayment if the earner dies', emi: 'EMIs when income stops', cash: 'Daily costs in hospital', hosp: 'Hospital bills', topup: 'Bills above employer cover', acc: 'Accident and disability', cyber: 'Payment and UPI fraud',
  vector: 'Dengue and malaria', women: 'Women\'s health', device: 'Device damage', warranty: 'Repairs after warranty', shop: 'Shop and stock', staff: 'Staff injury liability', gigIncome: 'Income while off the road', gigHealth: 'Everyday health for a daily earner',
  vehicle: 'Vehicle damage and liability', tripCancel: 'Trip cancellation', tripDelay: 'Delays and missed connections', tripMedical: 'Medical emergency abroad', visa: 'Visa refusal', fee: 'Fees if the earner cannot pay', feeVisa: 'Deposit lost on visa refusal',
  studentHealth: 'Student health abroad', home: 'Home structure and contents', parents: 'Parents\' health', chronic: 'Chronic condition care', maternity: 'Maternity costs' };

/* ── compliance markers ── */
const MARKERS = {
  optin: ['Opt-in only', 'Never pre-selected. The customer adds it.', 'RBI sales-practice directions'],
  untied: ['Not tied to approval', 'Loan or booking goes ahead with or without it.', 'RBI Fair Practices Code'],
  kfs: ['Shown in KFS and APR', 'Premium collected with the loan is disclosed in the Key Facts Statement and counted in APR.', 'RBI KFS circular 2024 · Digital Lending Directions 2025'],
  price: ['Price shown separately', 'Premium, GST and any service fee are itemised before consent.', 'RBI sales-practice directions'],
  consent: ['Explicit consent', 'A specific, informed tap for this product. Stored with time and device.', 'RBI sales-practice directions · DPDP Act'],
  suit: ['Suitability recorded', 'The answers and reasons behind the recommendation are saved.', 'RBI sales-practice directions'],
  freelook: ['30-day free look', 'Cancel within 30 days for a refund.', 'IRDAI policyholder regulations 2024'],
  cis: ['Customer information sheet', 'Plain summary of cover, exclusions and claims is shown before purchase.', 'IRDAI policyholder regulations 2024'],
  assisted: ['Assisted disclosure', 'Vulnerable customer: terms are read out and confirmed in their language.', 'RBI sales-practice directions'],
  vas: ['Labelled as a service', 'Value-added services are shown as services, not insurance.', 'RBI sales-practice directions'],
  merchant: ['Strictly opt-in for merchants', 'Never linked to the loan decision.', 'Symbo product master']
};
export function markersFor(prod, p, d) {
  const loan = ['loan', 'business', 'gig', 'fee'].includes(p.ctx);
  const m = ['optin', 'untied', loan ? 'kfs' : 'price', 'consent', 'suit', 'freelook', 'cis'];
  if (d.vulnerable) m.push('assisted');
  if (prod.id === 'FIN-02' && p.ctx === 'business') m.push('merchant');
  return m.map(k => ({ key: k, title: MARKERS[k][0], text: MARKERS[k][1], ref: MARKERS[k][2] }));
}
export const marker = k => ({ key: k, title: MARKERS[k][0], text: MARKERS[k][1], ref: MARKERS[k][2] });

/* ── audit log (hash-chained so an entry cannot be changed without breaking the chain) ── */
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
export function makeLog(seed = '') {
  const entries = [];
  let prev = fnv('symbo' + seed);
  return { entries, add(step, text, data = '') { const at = Date.now() + entries.length; const hash = fnv(prev + step + text + data + at); entries.push({ n: entries.length + 1, at, step, text, data, prev, hash }); prev = hash; return entries[entries.length - 1]; } };
}

/* ── the pipeline ── */
export function run(p, log = makeLog(p.key)) {
  const d = derive(p), dp = datapoints(p), { N, why } = needs(p, d);
  const reqId = 'SUIT-' + fnv(JSON.stringify(p) + Date.now()).toUpperCase();
  log.add('Request', `Suitability request ${reqId}`, `${SEGMENTS[p.seg]} · ${p.txn} · ${p.stage}`);
  log.add('Signals', `${dp.length} datapoints read`, `${dp.filter(x => x.src === 'derived').length} derived · consent ${p.dataConsent ? 'on file' : 'missing'}`);

  const all = PRODUCTS.map(prod => ({ ...prod, state: 'catalogue', reason: '', score: 0, matched: [] }));
  const mapped = all.filter(x => x.segs.includes(p.seg));
  all.filter(x => !x.segs.includes(p.seg)).forEach(x => { x.state = 'unmapped'; x.reason = `Not mapped to ${SEGMENTS[p.seg]}`; });
  log.add('Catalogue', `${mapped.length} of ${all.length} products mapped to ${SEGMENTS[p.seg]}`);

  for (const x of mapped) {
    const r = R[x.id] || { n: {}, ctx: 'any' };
    let no = '';
    if (r.b2b) no = 'Institution or business policy, not sold to this customer';
    else if (r.feature) no = 'A feature on another policy, not a product';
    else { const c = (CTX_OK[r.ctx] || CTX_OK.any)(p); if (c !== true) no = c; }
    if (!no && r.only) { const o = r.only(p); if (o !== true) no = o; }
    if (!no && r.max && p.amount > r.max) no = `For loans up to ${short(r.max)}`;
    if (!no && r.min && p.amount < r.min) no = `Small loans use the combined pocket cover`;
    if (!no && r.age && (p.age < r.age[0] || p.age > r.age[1])) no = `Entry age ${r.age[0]}–${r.age[1]}`;
    if (!no && r.minAge && p.age < r.minAge) no = `Relevant from age ${r.minAge}`;
    if (no) { x.state = 'ineligible'; x.reason = no; continue; }
    x.state = 'eligible';
    const served = Object.entries(r.n).filter(([k]) => N[k]);
    x.score = served.length ? Math.round(100 * Math.max(...served.map(([k, w]) => w * N[k]))) : 0;
    x.matched = served.sort((a, b) => b[1] * N[b[0]] - a[1] * N[a[0]]).map(([k]) => ({ need: NEED_LABEL[k] || k, signals: why[k] || [] }));
    x.priceValue = r.price ? r.price(p, d) : null; x.unit = r.unit || '';
    x.ovl = r.ovl;
  }
  const eligible = mapped.filter(x => x.state === 'eligible');
  log.add('Eligibility', `${eligible.length} eligible · ${mapped.length - eligible.length} ruled out`, 'Context, age, ticket and channel rules');

  for (const x of eligible) {
    if ((x.ovl === 'life' && p.life === 'Adequate') || (x.ovl === 'lifeFull' && p.life === 'Adequate') || (x.ovl === 'pa' && p.pa === 'Yes') || (x.ovl === 'health' && p.healthCover !== 'None') || (x.ovl === 'healthFull' && p.healthCover === 'Personal policy')) { x.state = 'overlap'; x.reason = 'Already covered: would duplicate existing cover'; continue; }
    if (x.score < 30) { x.state = 'lowfit'; x.reason = x.score ? 'Need is weak for this profile' : 'No stated need points to it'; continue; }
    x.state = 'fit';
  }
  const fit = eligible.filter(x => x.state === 'fit').sort((a, b) => b.score - a.score || (b.priceValue ? 1 : 0) - (a.priceValue ? 1 : 0));
  log.add('Need match', `${fit.length} products fit`, fit.slice(0, 5).map(x => `${x.name} ${x.score}`).join(' · '));

  /* one product per primary need, then fill the premium budget */
  const picked = [], seenNeed = new Set();
  let spend = 0;
  for (const x of fit) {
    const need = x.matched[0]?.need;
    if (seenNeed.has(need)) { x.state = 'alt'; x.reason = `Same need as ${picked.find(k => k.matched[0]?.need === need)?.name}`; continue; }
    if (x.priceValue && spend + x.priceValue > d.budget && picked.length >= 1) { x.state = 'alt'; x.reason = `Over the ${d.capPct}% premium cap for this ticket`; continue; }
    if (picked.length >= 3) { x.state = 'alt'; x.reason = 'Outside the top three for this customer'; continue; }
    x.state = 'recommended'; picked.push(x); seenNeed.add(need); spend += x.priceValue || 0;
  }
  log.add('Affordability', `Mix of ${picked.length} within ${inr(d.budget)} cap`, `${inr(spend)} priced · ${d.capPct}% of ${short(d.ticket)}`);

  /* value-added services that pair with the picked covers */
  const groups = new Set(picked.map(x => x.group));
  const prefer = ['Doctor Consultations', 'Cyber & Fraud Protection', 'Travel Assistance', 'On the road', 'MSME & Business Tools', 'Health Tests & Screenings', 'Financial & Credit Wellness', 'Gadget & Appliance Protection', 'Education & Upskilling', 'Emergency Services', 'Home Assistance'];
  const first = ['Doctor on Call / Chat', '24x7 Cyber Helpline', '24x7 Travel & Medical Assistance', 'Roadside Assistance (Basic)', 'Udyam / MSME Registration Assistance', 'Annual Health Check-up', 'Credit Score Monitoring', 'Doorstep Technician Visit', 'Career Counselling Session', 'Ambulance Assistance', 'Home Assistance Helpline'];
  const pool = VAS.filter(v => v.segs.includes(p.seg) && v.pairs.some(g => groups.has(g)));
  const vas = []; const cats = new Set();
  for (const cat of prefer) { const inCat = pool.filter(x => x.cat === cat); const v = inCat.find(x => first.includes(x.name)) || inCat[0]; if (v && !cats.has(cat)) { vas.push(v); cats.add(cat); } if (vas.length >= 3) break; }
  const bundleFor = { MFI: 'B-26', MER: 'B-15', MOB: 'B-13', NBFC: 'B-28', BANK: p.dependants ? 'B-01' : 'B-28', TRV: null, EDU: null, RET: null }[p.seg];
  const bundle = BUNDLES.find(b => b.id === bundleFor) || null;
  const vasFee = vas.length ? 150 : 0;

  /* guardrails */
  const loan = ['loan', 'business', 'gig', 'fee'].includes(p.ctx);
  const ratio = d.ticket ? +(spend / d.ticket * 100).toFixed(2) : 0;
  const guards = [
    { ...marker('optin'), ok: true }, { ...marker('untied'), ok: true }, { ...marker(loan ? 'kfs' : 'price'), ok: true },
    { ...marker('consent'), ok: p.dataConsent, note: p.dataConsent ? '' : 'Data consent missing: engine will not profile' },
    { ...marker('suit'), ok: true }, { key: 'cap', title: `Premium ${ratio}% of ticket`, text: `Within the ${d.capPct}% cap set for this ticket size.`, ref: 'Partner policy', ok: ratio <= d.capPct },
    { key: 'overlap', title: 'No duplicate cover', text: `${all.filter(x => x.state === 'overlap').length} product(s) removed because the customer already has that cover.`, ref: 'RBI sales-practice directions', ok: true },
    { ...marker('freelook'), ok: true }, ...(d.vulnerable ? [{ ...marker('assisted'), ok: true, flag: true }] : [])
  ];
  log.add('Guardrails', `${guards.filter(g => g.ok).length}/${guards.length} checks passed`, d.vulnerable ? 'Vulnerable-customer flag: assisted disclosure required' : 'No vulnerability flag');
  log.add('Response', `${picked.length} cover${picked.length === 1 ? '' : 's'} + ${vas.length} service${vas.length === 1 ? '' : 's'} recommended`, picked.map(x => x.name).join(' · ') || 'Nothing suitable: no offer shown');

  const counts = { catalogue: all.length, mapped: mapped.length, eligible: eligible.length, fit: fit.length, recommended: picked.length };
  return { reqId, profile: p, derived: d, datapoints: dp, needs: Object.entries(N).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: NEED_LABEL[k] || k, level: v, signals: why[k] })),
    all, picked, alternatives: fit.filter(x => x.state === 'alt'), vas, vasFee, bundle, guards, counts, spend, total: spend + vasFee, ratio, log };
}
/* API-shaped view of a run, as a partner would receive it. */
export function apiView(res) {
  const p = res.profile;
  return {
    request: { partner: { segment: p.seg, journey: p.stage, channel: p.channel.toLowerCase() }, customer: { age: p.age, occupation: p.occupation, income: p.income, dependants: p.dependants, cover_held: { life: p.life, health: p.healthCover, accident: p.pa } }, transaction: { type: p.txn, amount: p.amount, tenure_months: p.tenure || null }, consent: { data: p.dataConsent, marketing: p.marketingConsent } },
    response: { request_id: res.reqId, evaluated: res.counts.catalogue, recommended: res.picked.map(x => ({ product_id: x.id, name: x.name, fit: x.score, premium: x.priceValue, why: x.matched[0]?.signals || [] })), services: res.vas.map(v => v.id), guardrails: res.guards.map(g => ({ check: g.title, passed: g.ok })), audit_ref: res.log.entries.at(-1)?.hash }
  };
}

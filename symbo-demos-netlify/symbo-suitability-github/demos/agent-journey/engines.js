/* One interface over both channels, so the portal and the buy page treat a store sale and a bank loan alike. */
import { ew, initialMasters, relevantQuestions as storeQuestions, assess as storeAssess } from './catalogue.js';
import { signals as storeSignals, pitchFor as storePitch, ICONS as STORE_ICONS } from './pitch.js';
import * as BANK from './bank.js';
import { CHANNELS, agentLabel, inr, firstName, newRef } from './store.js';

const DAY = 864e5;
const assetName = id => (ew.assets.find(a => a.id === id) || {}).name || 'Device';

/* Today's financed sales at Ajay Sales Electronics (loan by the store's finance partner). */
export const INVOICES = [
  { inv: 'INV-2611-4812', name: 'Amit Verma', age: 34, mobile: '9000024812', email: 'amit.verma@example.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400053', assetId: 'led-tv', brand: 'Sony', model: 'Bravia 55" 4K', assetCost: 64990, loanAmount: 52000, tenure: 12, at: '11:42' },
  { inv: 'INV-2611-4809', name: 'Kiran Desai', age: 29, mobile: '9000024809', email: 'kiran.desai@example.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400058', assetId: 'mobile-android', brand: 'Samsung', model: 'Galaxy S24', assetCost: 74999, loanAmount: 60000, tenure: 10, at: '11:15' },
  { inv: 'INV-2611-4805', name: 'Pooja Shah', age: 41, mobile: '9000024805', email: 'pooja.shah@example.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400061', assetId: 'air-conditioner', brand: 'LG', model: '1.5T Split AC', assetCost: 46990, loanAmount: 40000, tenure: 9, at: '10:52' },
  { inv: 'INV-2611-4801', name: 'Harish Pillai', age: 52, mobile: '9000024801', email: 'harish.pillai@example.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400047', assetId: 'refrigerator', brand: 'Whirlpool', model: '340L Frost Free', assetCost: 32990, loanAmount: 28000, tenure: 12, at: '10:20' },
  { inv: 'INV-2611-4796', name: 'Sneha Kulkarni', age: 27, mobile: '9000024796', email: 'sneha.kulkarni@example.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', assetId: 'washing-machine', brand: 'Bosch', model: '7kg Front Load', assetCost: 38990, loanAmount: 30000, tenure: 8, at: '09:58' }
];

const storeApp = sale => ({ ...sale.customer, warrantyYears: 1, purchaseDays: 0, usage: 'home', condition: 'new', answers: sale.answers });
const storeProducts = Object.fromEntries(initialMasters.products.map(p => [p.id, p]));
const bankProducts = Object.fromEntries(BANK.PRODUCTS.map(p => [p.id, p]));

export const ENGINES = {
  store: {
    icons: STORE_ICONS,
    info: id => storeProducts[id] || { name: id },
    start(inv) {
      const { inv: invoice, at, ...customer } = inv;
      return { ref: newRef('store'), channel: 'store', sourceId: invoice, createdAt: Date.now(), status: 'Draft', answers: {}, responses: {}, audit: [],
        subject: assetName(inv.assetId), subjectDetail: `${inv.brand} ${inv.model}`, customer: { ...customer }, quote: { items: [], total: 0, expiresAt: 0 } };
    },
    refresh(sale) { sale.subject = assetName(sale.customer.assetId); sale.subjectDetail = `${sale.customer.brand} ${sale.customer.model}`; },
    questions: sale => storeQuestions(storeApp(sale)),
    assess: sale => storeAssess(storeApp(sale), initialMasters).map(p => ({ ...p, disabled: false })),
    signals: (sale, id) => storeSignals(id, sale.answers, firstName(sale.customer.name)),
    pitch: (sale, p) => storePitch({ first: firstName(sale.customer.name), assetName: sale.subject, assetCost: sale.customer.assetCost, ans: sale.answers, p }),
    facts: () => [],
    priceNote: p => p.id === 'ew' ? 'one-time, GST included' : 'for one year'
  },
  bank: {
    icons: BANK.ICONS,
    info: id => bankProducts[id] || { name: id },
    start(loan) {
      return { ref: newRef('bank'), channel: 'bank', sourceId: loan.id, createdAt: Date.now(), status: 'Draft', answers: {}, responses: {}, audit: [],
        subject: loan.product, subjectDetail: `${loan.id} · ${BANK.short(loan.amount)}`, loan: { ...loan },
        customer: { name: loan.name, email: loan.email, mobile: loan.mobile, age: loan.age, city: loan.city }, quote: { items: [], total: 0, expiresAt: 0 } };
    },
    refresh() {},
    questions: sale => BANK.relevantQuestions(sale.loan),
    assess: sale => BANK.assess(sale.loan, sale.answers),
    signals: (sale, id) => BANK.signals(id, sale.answers, sale.loan),
    pitch: (sale, p) => BANK.pitchFor(sale.loan, sale.answers, p),
    facts: sale => {
      const l = sale.loan;
      return [['Age', `${l.age}`], ['Occupation', `${l.occ} · ${l.employer}`], ['Monthly income', inr(l.income)], ['Loan', `${l.product} · ${BANK.short(l.amount)}`], ['EMI', `${inr(l.emi)} × ${l.tenure} months`], ['Other EMIs', l.existingEmi ? inr(l.existingEmi) + ' a month' : 'None']];
    },
    priceNote: () => 'for one year, GST included'
  }
};

/* ── seeded history so each dashboard has records ── */
function seedSale(ch, base, items, status, ago, sourceId) {
  const createdAt = Date.now() - ago * DAY - 40 * 60e3;
  const label = agentLabel(ch);
  const info = ENGINES[ch].info;
  const quoteItems = items.map(([id, variant, price]) => ({ id, name: info(id).name, variant, price }));
  const total = quoteItems.reduce((n, x) => n + x.price, 0);
  const sale = { ...base, channel: ch, ref: base.ref, seed: true, createdAt, status, sourceId, answers: {}, responses: {},
    quote: { items: quoteItems, total, expiresAt: createdAt + 2 * DAY }, purchasedAt: status === 'Purchased' ? createdAt + 35 * 60e3 : null, audit: [] };
  const at = (m, actor, stage, text, detail = '') => sale.audit.push({ at: createdAt + m * 60e3, actor, stage, text, detail, id: `${sale.ref}-${m}` });
  const names = quoteItems.map(x => x.name).join(', ');
  at(0, label, 'Customer', `Opened ${sale.subject.toLowerCase()} for ${base.customer.name}`, sale.subjectDetail);
  at(6, label, 'Needs', 'Suitability questions completed');
  at(7, 'Symbo', 'Recommendation', `${quoteItems.length} product${quoteItems.length > 1 ? 's' : ''} recommended`, names);
  at(14, label, 'Pitch', 'Customer interested', names);
  at(15, label, 'Share', `Quote ${sale.ref} shared on WhatsApp`, inr(total));
  if (status !== 'Quote shared') at(22, 'Customer', 'Consent', 'Opened the quote link');
  if (status === 'Purchased') { at(33, 'Customer', 'Consent', `Read the terms and consented to ${quoteItems.length} product${quoteItems.length > 1 ? 's' : ''}; verified by OTP`); at(35, 'Customer', 'Purchase', `Paid ${inr(total)} and bought ${quoteItems.length} product${quoteItems.length > 1 ? 's' : ''}`); }
  if (status === 'Not taken') at(30, 'Customer', 'Consent', 'Did not buy before the quote expired');
  return sale;
}
export const SEEDS = {
  store: () => [
    ['Priya Nair', 'Refrigerator', 'Whirlpool 265L', 30990, [['ew', '2 years', 839], ['health', 'Silver', 750]], 'Purchased', 0.12],
    ['Imran Shaikh', 'Mobile - Android', 'Galaxy A55', 39999, [['adld', '', 1200], ['epicure', 'Prime', 1199]], 'Purchased', 0.2],
    ['Kavita Joshi', 'LED TV', 'Bravia 50"', 58990, [['ew', '3 years', 3275], ['galaxy', '', 999]], 'Quote shared', 0.3],
    ['Suresh Patil', 'Washing Machine', 'LG 8kg', 36490, [['epicure', 'Lite', 250]], 'Purchased', 1.1],
    ['Neha Gupta', 'Air Conditioner', 'Voltas 1.5T', 41990, [['ew', '2 years', 1554], ['epicure', 'Prime', 1199], ['health', 'Gold', 1300]], 'Purchased', 2.2],
    ['Arjun Rao', 'Mobile - Apple', 'iPhone 15', 69900, [['adld', '', 2097]], 'Viewed', 2.4],
    ['Farah Khan', 'LED TV', 'TCL 55"', 44990, [['galaxy', '', 999], ['health', 'Bronze', 350]], 'Purchased', 3.3],
    ['Deepak Yadav', 'Refrigerator', 'Godrej 260L', 27490, [['ew', '1 year', 479]], 'Purchased', 5.2],
    ['Meera Iyer', 'Washing Machine', 'Bosch 7kg', 38990, [['epicure', 'Prime', 1199], ['galaxy', '', 999]], 'Purchased', 8.4],
    ['Rahul Desai', 'Air Conditioner', 'Daikin 1T', 37990, [['ew', '3 years', 2117]], 'Not taken', 9.1]
  ].map(([name, subject, model, cost, items, status, ago], k) => seedSale('store',
    { ref: `AJ-S${String(k + 1).padStart(3, '0')}`, subject, subjectDetail: model, customer: { name, model, assetCost: cost } }, items, status, ago, `INV-26${String(1100 - k * 37).padStart(2, '0')}-${4700 - k * 31}`)),
  bank: () => {
    const sample = { 'KBI-HL-2611-02210': [{ dependants: '1–2', lifeCover: 'Some, not enough', health: 'Employer cover only', hospitalEmi: 'It would be difficult', jobSecurity: '2 to 6 months', travel: 'Mostly office or home', wellness: 'No', digital: 'No' }, ['pa', 'emi'], 'Purchased', 0.15],
      'KBI-AL-2611-03318': [{ dependants: '3 or more', lifeCover: 'No', health: 'None', hospitalEmi: 'Yes, comfortably', jobSecurity: '6 months or more', travel: 'Frequent intercity travel', wellness: 'No', digital: 'No' }, ['pa', 'hospicash'], 'Purchased', 1.2],
      'KBI-PL-2611-07045': [{ dependants: 'None', lifeCover: 'Yes, enough', health: 'Personal policy', hospitalEmi: 'Not sure', jobSecurity: 'Less than 2 months', travel: 'Mostly office or home', wellness: 'No', digital: 'Yes' }, ['emi', 'cardsafe'], 'Quote shared', 0.4],
      'KBI-GL-2611-06233': [{ dependants: '1–2', lifeCover: 'No', health: 'None', hospitalEmi: 'It would be difficult', travel: 'Mostly office or home', wellness: 'Yes', digital: 'No' }, ['hospicash', 'wellness'], 'Not taken', 2.3] };
    return Object.entries(sample).map(([loanId, [ans, ids, status, ago]], k) => {
      const loan = BANK.findLoan(loanId);
      const priced = BANK.assess(loan, ans);
      const items = ids.map(id => { const p = priced.find(x => x.id === id); return [id, p.variant, p.price]; });
      return seedSale('bank', { ref: `KB-S${String(k + 1).padStart(3, '0')}`, subject: loan.product, subjectDetail: `${loan.id} · ${BANK.short(loan.amount)}`, loan,
        customer: { name: loan.name, email: loan.email, mobile: loan.mobile, age: loan.age } }, items, status, ago, loan.id);
    });
  }
};
export { CHANNELS };

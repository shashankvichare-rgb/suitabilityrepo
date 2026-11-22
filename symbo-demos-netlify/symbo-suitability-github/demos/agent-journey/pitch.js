/* Agent Journey · pitch scripts.
   Every "why" line is built from the customer's own answers and the product's eligibility rule.
   Scripts state limits plainly and never invent statistics or pressure the customer. */
import { inr } from './store.js';

export const ICONS = { ew: 'ph-wrench', adld: 'ph-device-mobile', health: 'ph-first-aid-kit', epicure: 'ph-house-line', galaxy: 'ph-heartbeat', insta: 'ph-credit-card' };
const WALLET = { Bronze: 500, 'Bronze Plus': 750, Silver: 1000, Gold: 2500 };
const EPICURE = {
  Lite: ['Breakdown support for one appliance (single use)', 'SIM and card blocking help', 'Three months of Sun NXT / Aha'],
  Prime: ['Up to four appliances, unlimited breakdown support', 'UPI fraud protection up to ₹20,000', 'One AC service visit and an appliance health check'],
  Elite: ['Up to five appliances, unlimited breakdown support', 'UPI fraud protection up to ₹50,000', 'One year of entertainment benefits']
};

/* Needs the customer stated that point to this product. Used for ranking and the "why" list. */
export function signals(id, ans, first) {
  const s = [];
  if (id === 'ew' && ans.repair === 'Yes') s.push(`${first} wants repair costs covered once the manufacturer warranty ends.`);
  if (id === 'adld' && ans.accident === 'Yes') s.push(`${first} said drops or liquid damage are a real risk for this phone.`);
  if (id === 'health' && ['Consultations and tests', 'Preventive check-ups', 'Both'].includes(ans.health)) s.push(`${first} would use ${ans.health === 'Both' ? 'consultations, tests and preventive check-ups' : ans.health.toLowerCase()}.`);
  if (id === 'health' && ans.members) s.push(`${ans.members === 'Two' ? 'Two adults' : 'One adult'} would use the membership.`);
  if (id === 'epicure' && ['One', 'Two to four', 'Five or more'].includes(ans.appliances)) s.push(`${ans.appliances} appliance${ans.appliances === 'One' ? '' : 's'} at home would benefit from service support.`);
  if (id === 'epicure' && ans.upi === 'Yes') s.push(`${first} uses UPI and wants fraud protection.`);
  if (id === 'epicure' && ans.ott === 'Yes') s.push(`${first} would use an OTT subscription.`);
  if (id === 'galaxy' && ans.hospital === 'Yes') s.push(`${first} said a hospital stay would make EMIs hard to pay.`);
  if (id === 'galaxy' && ans.hospitalCover === 'No') s.push(`No existing hospital cash or EMI benefit, so nothing overlaps.`);
  if (id === 'insta' && ans.future === 'Yes') s.push(`${first} is interested in finance for future purchases.`);
  return s;
}

/* ctx = { first, assetName, assetCost, ans, p } where p is the assessed product with the chosen variant and price */
export function pitchFor(ctx) {
  const { first, assetName, assetCost, ans, p } = ctx;
  const why = signals(p.id, ans, first);
  const price = inr(p.price);
  switch (p.id) {
    case 'ew': return {
      headline: 'Keep repair bills away after year one',
      why: [...why, `Eligible today: new ${assetName} for home use, bought on the invoice date.`],
      say: `"${first}, your ${assetName} comes with one year of manufacturer warranty. After that, repairs are paid from your pocket. Extended Warranty starts the day that warranty ends and covers authorised repairs up to the invoice value of ${inr(assetCost)}. For ${p.variant || 'the extra cover'}, it is ${price} including GST."`,
      points: ['Starts when the manufacturer warranty ends', `Authorised repairs up to ${inr(assetCost)}`, 'One claim during the cover period'],
      limits: 'Excludes transit damage, accessories, consumables and data loss. Authorised repairs only.',
      objection: ['"Can I add it later?"', 'It can only be added on the invoice date, so today is the one chance for this product.']
    };
    case 'adld': return {
      headline: 'Drops and spills covered from day one',
      why: [...why, 'Eligible: a new mobile, mapped to this plan.'],
      say: `"${first}, phones mostly get damaged by a fall or water, and the manufacturer warranty does not cover that. This plan covers accidental and liquid damage for one year at authorised service centres, for ${price}."`,
      points: ['One year of accidental and liquid damage cover', 'Repairs at authorised service centres', '60-day assurance after a repair'],
      limits: 'One claim. A 5% invoice-value deductible and age-based depreciation apply at claim time.',
      objection: ['"I already use a phone case."', 'A case helps with small knocks. This pays for the repair when the screen or board is actually damaged.']
    };
    case 'health': return {
      headline: 'Doctor visits and tests, paid from a wallet',
      why: [...why, `${p.variant} is the variant sized to the services and members ${first} described.`],
      say: `"${first}, you mentioned ${ans.health === 'Both' ? 'consultations and check-ups' : String(ans.health || 'health services').toLowerCase()}. Wellness Access ${p.variant} gives a ${inr(WALLET[p.variant] || 0)} wallet for consultations, tests, dental and eye care for a year${ans.members === 'Two' ? ', shared by two adults' : ''}. It is ${price} for the year."`,
      points: [`OPD wallet of ${inr(WALLET[p.variant] || 0)}`, 'Consultations, diagnostics, dental and eye care', 'Pharmacy and preventive-check discounts'],
      limits: 'Service benefits, not a cash payout and not hospitalisation insurance.',
      objection: ['"I hardly go to the doctor."', 'The wallet also covers tests, dental and eye care, so it can be used across the year, not only for illness.']
    };
    case 'epicure': return {
      headline: 'Home appliances and UPI, both looked after',
      why: [...why, `${p.variant} is the variant that covers these needs.`],
      say: `"${first}, Home & Digital Assist ${p.variant} looks after ${ans.appliances && ans.appliances !== 'None' ? 'your appliances with breakdown support' : 'your digital side'}${ans.upi === 'Yes' ? ', protects UPI payments against fraud' : ''}${ans.ott === 'Yes' ? ' and includes an entertainment subscription' : ''}. One year for ${price}, GST included."`,
      points: EPICURE[p.variant] || EPICURE.Prime,
      limits: 'Provider service terms apply. UPI fraud must be reported within ten days.',
      objection: ['"My appliances already have warranty."', 'Warranty covers defects. This adds breakdown visits and service support, plus UPI and SIM protection.']
    };
    case 'galaxy': return {
      headline: 'If a hospital stay comes, EMIs are not the worry',
      why,
      say: `"${first}, you said a hospital stay would make the EMIs hard. This pays ₹2,000 towards EMIs if you are admitted for three days or more, ₹750 a day as hospital cash, and includes ₹2 lakh personal accident cover. It is ${price} for the year."`,
      points: ['₹2,000 EMI benefit per claim, up to three a year', '₹750 a day hospital cash, up to 30 days', '₹2 lakh personal accident cover'],
      limits: 'Fixed benefits, not reimbursement of hospital bills. Illness cover starts after seven days.',
      objection: ['"I have health insurance at work."', 'That pays the hospital. This pays you fixed amounts so the EMI and daily costs are handled.']
    };
    default: return {
      headline: 'Finance for the next purchase',
      why,
      say: `"${first}, this programme gives access to finance for future purchases, subject to the lender's credit checks. The fee is ${price}."`,
      points: ['Pre-approved access for future purchases', 'Separate credit decision for each loan'],
      limits: 'Needs completed EMIs and lender checks before it can be offered.',
      objection: ['"Is the loan approved now?"', 'No. Each future loan is a separate decision by the lender.']
    };
  }
}

export const RETAIL = [
  { name: 'Motor', sub: 'Car & two-wheeler', icon: 'ph-car-profile' },
  { name: 'Credit Life', sub: 'Loan protection', icon: 'ph-shield-check' },
  { name: 'Health', sub: 'Family floater', icon: 'ph-heartbeat' },
  { name: 'Term Life', sub: 'Pure protection', icon: 'ph-umbrella' },
  { name: 'Travel', sub: 'Trips in India & abroad', icon: 'ph-airplane-tilt' },
  { name: 'Home', sub: 'Structure & contents', icon: 'ph-house' }
];

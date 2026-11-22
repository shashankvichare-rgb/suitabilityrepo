/* Run from repo root: node --test tests/*.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../symbo-demos-netlify/symbo-suitability-github/demos/suitability-agent-journey/engine.js');
const clean = { h1: 'No', h2: 'No', h3: 'No', h4: 'No' };
const base = (o = {}) => ({ applicant: { age: 41, income: 85000, dependants: 3, ...o.applicant }, loan: { amount: 800000, tenure: 36, rate: 16, ...o.loan }, answers: o.answers ?? { repay: 'Family would have to', cover: 'None', collateral: 'Yes', household: 'Single income' }, health: o.health ?? clean, payMode: o.payMode ?? 'loan', plan: o.plan });

test('eligible borrower gets a priced, financed offer whose cover includes the premium', () => {
  const r = E.assess(base());
  assert.equal(r.eligibility.eligible, true);
  for (const p of Object.values(r.plans)) assert.ok(p.sumInsured >= 800000 + p.total, `${p.plan} cover covers loan + premium`);
  assert.ok(r.plans.level.total > r.plans.reducing.total, 'level costs more than reducing');
  assert.equal(r.plans.joint, undefined, 'no joint plan without a co-borrower');
});
test('upfront payment leaves loan and EMI unchanged', () => {
  const r = E.assess(base({ payMode: 'upfront' }));
  assert.equal(r.price.sumInsured, 800000);
  assert.equal(r.price.emiDelta, 0);
});
test('cover may not run past age 68 and suggests a tenure that fits', () => {
  const r = E.assess(base({ applicant: { age: 64 }, loan: { tenure: 60 } }));
  assert.equal(r.eligibility.eligible, false);
  assert.match(r.eligibility.suggestion, /48 months/);
  assert.equal(E.assess(base({ applicant: { age: 64 }, loan: { tenure: 48 } })).eligibility.eligible, true);
});
test('any Yes in the health declaration refers to underwriting', () => {
  const r = E.assess(base({ health: { ...clean, h2: 'Yes' } }));
  assert.equal(r.eligibility.eligible, false);
  assert.equal(r.eligibility.referral, 'underwriting');
});
test('unanswered need questions never create need', () => {
  const r = E.assess(base({ applicant: { dependants: 0 }, answers: {} }));
  assert.equal(r.need.answered, 0);
  assert.equal(r.need.band, 'low');
});
test('existing cover that clears the loan lowers need', () => {
  const hi = E.assess(base()).need.score;
  const lo = E.assess(base({ answers: { repay: 'Savings would cover it', cover: 'Covers the loan', collateral: 'No', household: 'Two or more incomes' } })).need.score;
  assert.ok(lo < hi && lo < 35);
});
test('two-income co-borrowers are steered to joint cover', () => {
  const r = E.assess(base({ applicant: { age: 47, coBorrower: true, coBorrowerAge: 50, dependants: 2 }, answers: { repay: 'Co-borrower would', household: 'Two or more incomes' } }));
  assert.equal(r.recommendation.plan, 'joint');
  assert.ok(r.plans.joint.total > r.plans.reducing.total);
});
test('EMI formula matches a known value', () => {
  assert.equal(Math.round(E.emi(800000, 16, 36)), 28126);
});

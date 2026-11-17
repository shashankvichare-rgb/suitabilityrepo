/* LoanBee checkout adapter for the existing Symbo suitability rules and rate cards.
   This is a browser demo. Prices are reference rate-card amounts, not live quotes. */
(function (root) {
  'use strict';
  const core = root.SymboEngine;
  const config = root.SymboConfig;
  const data = root.SymboSource;
  const productIds = { accident: 'pa', emi: 'emi', hospi: 'hospi', cyber: 'cyber', vector: 'vbd' };
  const productCopy = {
    accident: { icon: 'ph-first-aid', benefits: ['Lump sum on covered accidental death, subject to policy terms.'], exclusions: ['Exclusions and claim conditions in the insurer policy wording apply.'] },
    emi: { icon: 'ph-calendar-check', benefits: ['Eligible EMI payments during a qualifying hospitalisation, subject to policy limits.'], exclusions: ['This is not unemployment or job-loss cover.'] },
    hospi: { icon: 'ph-bed', benefits: ['Hospitalisation cash benefit at the selected cover amount, subject to policy terms.'], exclusions: ['Qualifying stay, waiting periods and exclusions depend on the insurer policy wording.'] },
    cyber: { icon: 'ph-lock-key', benefits: ['Eligible unauthorised UPI loss, subject to policy terms.'], exclusions: ['Reporting conditions and policy exclusions apply.'] },
    vector: { icon: 'ph-bug', benefits: ['Benefit for covered vector-borne illness, subject to policy terms.'], exclusions: ['Covered illnesses, diagnosis and waiting periods depend on the policy wording.'] }
  };
  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const money = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  const hash = value => {
    const s = JSON.stringify(value); let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36).toUpperCase();
  };
  function toCore(p) {
    return {
      name: p.name || 'Demo customer', age: p.age, gender: p.gender === 'Female' ? 'Woman' : p.gender === 'Male' ? 'Man' : 'Other',
      marital: p.children > 0 ? 'Married' : 'Single', dependants: p.dependants, children: p.children,
      livelihood: p.employment === 'Salaried' ? 'Salaried' : 'Self-employed', income: p.monthlyIncome,
      businessOwner: p.businessOwner ? 'Yes' : 'No', msme: 'No',
      incomeStability: p.incomePattern === 'Stable' ? 'Stable' : 'Variable', singleIncome: 'No',
      loanType: p.loanType === 'Business loan' ? 'Business loan' : 'Personal loan',
      loanAmount: p.loanAmount, tenure: p.tenure, emi: p.emi,
      city: p.city || 'Demo city', tier: p.cityTier, vector: p.vectorExposure,
      seasonal: p.incomePattern === 'Seasonal' ? 'Yes' : 'No', borrower: 'New',
      digital: p.digitalFirst ? 'Yes' : 'No', upi: p.upiUsage, transactions: p.onlineTxn,
      health: 'Low', healthIndicator: 'No'
    };
  }
  function conciseReason(r) {
    return r.reasons.slice(0, 2).join(' · ') || 'Profile and loan signals';
  }
  function tierOptions(tiers, chosen) {
    const byCover = new Map();
    for (const t of tiers) if (!byCover.has(t.cover) || t.premium < byCover.get(t.cover).premium) byCover.set(t.cover, t);
    const ordered = [...byCover.values()].sort((a, b) => a.cover - b.cover);
    const index = ordered.findIndex(t => t.id === chosen.id);
    const start = Math.max(0, Math.min(index - 1, ordered.length - 3));
    return ordered.slice(start, start + 3).map(t => ({ si: t.cover, premium: round2(t.premium), rateId: t.id, vasFee: Number.isFinite(t.netVas) ? round2(t.netVas) : null }));
  }
  function scoreWithDirectNeed(r, p) {
    if (r.id === 'hospi' && p.hospitalCashNeed === 'Yes') return r.score + 15;
    if (r.id === 'vector' && p.vectorExposure === 'High') return r.score + 20;
    return r.score;
  }
  function recommend(p) {
    const mapped = toCore(p);
    const evaluated = core.recommendationEngine(mapped);
    if (Object.keys(evaluated.errors).length) throw new Error('Invalid customer profile: ' + Object.values(evaluated.errors).join(' '));
    const ranked = evaluated.ranked.map(r => ({ ...r, checkoutScore: scoreWithDirectNeed(r, p) }))
      .sort((a, b) => b.checkoutScore - a.checkoutScore || a.order - b.order);
    const eligible = ranked.filter(r => r.checkoutScore >= 65 && r.coverage.recommended && !(r.id === 'hospi' && p.hospitalCashNeed === 'No'));
    const top = eligible.slice(0, 3);
    const products = top.map(r => {
      const tier = r.coverage.recommended, copy = productCopy[r.id];
      const reason = conciseReason(r) + (r.id === 'hospi' && p.hospitalCashNeed === 'Yes' ? ' · Customer requested hospital cash' : '')
        + (r.id === 'vector' && p.vectorExposure === 'High' ? ' · High reported vector exposure' : '');
      const out = { id: productIds[r.id], coreId: r.id, name: r.short, short: r.short, icon: copy.icon, desc: r.description,
        why: reason, reason, cover: tier.cover, coverShort: money(tier.cover) + ' cover', termMonths: tier.months,
        premium: round2(tier.premium), rateId: tier.id, vasFee: Number.isFinite(tier.netVas) ? round2(tier.netVas) : null,
        score: r.checkoutScore, benefits: copy.benefits, exclusions: copy.exclusions };
      if (r.id === 'accident') {
        out.suggestedSI = tier.cover;
        out.siOptions = tierOptions(r.coverage.tiers, tier);
      }
      return out;
    });
    const vasRanked = core.vasRanking(mapped, top.map(r => r.id));
    const vasIds = core.topVas(vasRanked);
    // Demo bundle pairing: EMI Protect includes Doctor on Call / Chat when the catalogue ranks it as relevant.
    if (products.some(x => x.id === 'emi')) {
      const doctor = vasRanked.find(x => /doctor on call/i.test(x.name));
      if (doctor) { const at = vasIds.indexOf(doctor.id); if (at >= 0) vasIds.splice(at, 1); vasIds.unshift(doctor.id); }
    }
    const shortLowNeed = p.tenure <= 6 && p.dependants <= 1 && !p.businessOwner && !p.digitalFirst && p.vectorExposure === 'Low';
    const limit = shortLowNeed ? 1 : Math.min(4, 1 + Number(p.tenure >= 12) + Number(p.dependants >= 2 || p.digitalFirst) + Number(p.businessOwner || p.vectorExposure === 'High'));
    const vas = products.length ? vasIds.slice(0, limit).map(id => {
      const v = vasRanked.find(x => x.id === id);
      return { id: 'vas-' + id, sourceId: id, name: v.name, icon: 'ph-sparkle', desc: 'Optional partner service, subject to provider terms.',
        validity: 'See service terms', why: v.contributions.slice(0, 2).map(x => x.label).join(' · '),
        reason: v.contributions.map(x => x.label).join(' · '), fee: null };
    }) : [];
    const notRecommended = ranked.filter(r => !top.some(t => t.id === r.id)).map(r => ({ id: productIds[r.id], name: r.short,
      reason: r.id === 'hospi' && p.hospitalCashNeed === 'No' ? 'Customer declined hospital cash need.' :
        !r.coverage.recommended ? 'No matching reference rate-card tier.' : r.checkoutScore < 65 ? 'Below the demo suitability threshold.' : 'Outside the three-product shortlist.' }));
    const signals = Object.entries(p).map(([key, value]) => ({ key, label: key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()), value,
      source: ['name', 'age', 'gender', 'city', 'cityTier'].includes(key) ? 'KYC / derived' : ['loanType', 'loanAmount', 'tenure', 'emi'].includes(key) ? 'Application' : 'Customer signal' }));
    const signature = { profile: p, tiers: products.map(x => x.rateId), vas: vas.map(x => x.id) };
    return { recommendationId: 'LB-' + hash(signature), ruleVersion: config.version + '+loanbee-1.0', generatedAt: new Date().toISOString(),
      products, vas, notRecommended, reasons: products.map(x => x.reason), signals,
      assumptions: ['Monthly income is entered in the presenter controls.', 'Consumer-durable and two-wheeler loans use the personal-loan suitability rule in this demo.',
        'Marital status is inferred only for rule validation; borrower status, MSME status, single-income status and health exposure use neutral demo defaults.',
        'Hospital-cash preference and high vector exposure add explicit checkout priority; up to three insurance products are shown.',
        'VAS suggestions come from the Symbo catalogue. The EMI Protect / Doctor on Call pairing is an illustrative demo rule. The source rate card supplies one bundle fee, not per-service prices.'],
      referenceOnly: true, engineResult: { scores: ranked.map(r => ({ id: r.id, baseScore: r.score, checkoutScore: r.checkoutScore, reasons: r.reasons })) } };
  }
  function bundleFee(result, added, paSI) {
    const primary = result?.products.find(p => added[p.id]);
    if (!primary) return null;
    const tier = primary.id === 'pa' ? (primary.siOptions || []).find(x => x.si === paSI) : null;
    const fee = tier ? tier.vasFee : primary.vasFee;
    return Number.isFinite(fee) ? fee : null;
  }
  function indicativeBundleFee(result) {
    if (!result?.products.length) return null;
    return bundleFee(result, { [result.products[0].id]: true }, result.products[0].suggestedSI);
  }
  root.SymboCheckoutEngine = { recommend, toCore, bundleFee, indicativeBundleFee, round2 };
})(typeof window !== 'undefined' ? window : globalThis);

/* Pure business logic shared by the browser mock and the Netlify functions.
   No DOM, no storage. All rates are MOCK values for the demo. */
(function (root, factory) {
  var cfg = (typeof module === 'object' && module.exports) ? require('./config.js') : root.PET_CONFIG;
  var eng = factory(cfg);
  if (typeof module === 'object' && module.exports) module.exports = eng; else root.PetEngine = eng;
})(typeof self !== 'undefined' ? self : this, function (CFG) {
  var BREEDS = {
    dog: ['Indie / Mixed', 'Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'Beagle', 'Shih Tzu', 'Pug', 'Rottweiler', 'Siberian Husky', 'Pomeranian', 'Other'],
    cat: ['Indie / Mixed', 'Persian', 'Siamese', 'Maine Coon', 'Bengal', 'British Shorthair', 'Other']
  };
  var BREED_RISK = { 'German Shepherd': 1.06, 'Rottweiler': 1.06, 'Siberian Husky': 1.04, 'Golden Retriever': 1.03, 'Pug': 1.05, 'Persian': 1.04, 'Maine Coon': 1.03, 'Indie / Mixed': 0.97 };
  var BASE = { dog: 10482, cat: 9980 }; /* 3-year net premium before discounts, GST */
  var PED = [
    { k: 'none', label: 'Not Applicable' },
    { k: 'diabetes', label: 'Diabetes (Fasting Blood Glucose)', unit: 'mg/dL', normal: [70, 140], refer: 300, load: 0.15 },
    { k: 'cholesterol', label: 'Cholesterol (Total Serum Cholesterol)', unit: 'mg/dL', normal: [110, 320], refer: 600, load: 0.08 },
    { k: 'obesity', label: 'Obesity (Body Condition Score - BCS)', unit: 'BCS 1–9', normal: [4, 6], refer: 9, load: 0.06 },
    { k: 'triglycerides', label: 'Triglycerides (Fasting Lipid Fraction)', unit: 'mg/dL', normal: [25, 150], refer: 500, load: 0.08 }
  ];
  var PINS = {
    '400': ['Mumbai', 'Maharashtra', 'A', true], '401': ['Thane', 'Maharashtra', 'A', true], '411': ['Pune', 'Maharashtra', 'A', true],
    '110': ['New Delhi', 'Delhi', 'A', true], '122': ['Gurugram', 'Haryana', 'A', true], '201': ['Noida', 'Uttar Pradesh', 'A', true],
    '560': ['Bengaluru', 'Karnataka', 'A', true], '500': ['Hyderabad', 'Telangana', 'A', true], '600': ['Chennai', 'Tamil Nadu', 'A', true],
    '700': ['Kolkata', 'West Bengal', 'A', false], '380': ['Ahmedabad', 'Gujarat', 'B', false], '302': ['Jaipur', 'Rajasthan', 'B', false],
    '226': ['Lucknow', 'Uttar Pradesh', 'B', false], '682': ['Kochi', 'Kerala', 'B', false], '160': ['Chandigarh', 'Chandigarh', 'B', false]
  };
  var RELATIONS = ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];
  var GENDERS = ['Male', 'Female'];

  var r0 = function (n) { return Math.round(n); };
  var inr = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };

  function pincode(pin) {
    if (!/^[1-9]\d{5}$/.test(String(pin || ''))) return null;
    var p = PINS[String(pin).slice(0, 3)];
    return p ? { city: p[0], state: p[1], zone: p[2], cashless: p[3], known: true } : { city: '', state: '', zone: 'B', cashless: false, known: false };
  }
  function ageFromDob(dob, now) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob || ''); if (!m) return null;
    var d = new Date(+m[3], +m[2] - 1, +m[1]); if (isNaN(d) || d.getDate() !== +m[1]) return null;
    now = now || new Date(); return (now - d) / (365.25 * 864e5);
  }
  function petAgeFactor(a) { return a < 1 ? 0.97 : a < 6 ? 1 : a < 9 ? 1.08 : a < 12 ? 1.16 : 1.25; }
  function ownerAgeFactor(a) { return a < 36 ? 1 : a < 46 ? 1.02 : a < 56 ? 1.05 : 1.09; }
  function pedInfo(k) { for (var i = 0; i < PED.length; i++) if (PED[i].k === k) return PED[i]; return PED[0]; }
  function pedAssess(k, value) {
    var p = pedInfo(k); if (p.k === 'none') return { load: 0, level: 'none' };
    var v = parseFloat(value);
    if (isNaN(v)) return { load: p.load, level: 'pending' };
    if (v >= p.refer) return { load: p.load * 1.5, level: 'refer', msg: 'This value needs a vet review by the insurer before the policy is issued.' };
    if (v < p.normal[0] || v > p.normal[1]) return { load: p.load * 1.25, level: 'high', msg: 'Outside the usual range. A small extra premium applies.' };
    return { load: p.load, level: 'normal' };
  }

  /* input: { ownerAge, pincode, pets:[{type, breed, ageYears, ped, pedValue}], pedWaiver, coupon } */
  function quote(input) {
    var pets = (input.pets && input.pets.length ? input.pets : [{ type: 'dog', breed: 'Labrador Retriever', ageYears: 3 }]).slice(0, CFG.maxPets);
    var zone = (pincode(input.pincode) || { zone: 'A' }).zone;
    var zf = zone === 'A' ? 1 : 0.96, of = ownerAgeFactor(input.ownerAge || 32);
    var lines = [], refer = false, perPet = [];
    pets.forEach(function (p, i) {
      var base = BASE[p.type] || BASE.dog;
      var net = base * petAgeFactor(p.ageYears || 0) * of * zf * (BREED_RISK[p.breed] || 1);
      var ped = pedAssess(p.ped, p.pedValue); if (ped.level === 'refer') refer = true;
      var pedLoad = net * ped.load;
      var waiver = input.pedWaiver ? net * 0.12 : 0;
      var multi = i > 0 ? -(net + pedLoad + waiver) * CFG.multiPetDiscount : 0;
      perPet.push({ net: r0(net), pedLoad: r0(pedLoad), waiver: r0(waiver), multi: r0(multi), ped: ped });
    });
    var sum = function (k) { return perPet.reduce(function (t, x) { return t + x[k]; }, 0); };
    var baseTotal = sum('net'), pedTotal = sum('pedLoad'), waiverTotal = sum('waiver'), multiTotal = sum('multi');
    var gross = baseTotal + pedTotal + waiverTotal + multiTotal;
    var lt = -r0(gross * CFG.plan.longTermDiscount);
    var afterLt = gross + lt;
    var c = applyCoupon(input.coupon, afterLt);
    var taxable = afterLt - c.amount;
    var gst = r0(taxable * CFG.plan.gst);
    var total = r0(taxable + gst);
    lines.push({ k: 'base', label: pets.length > 1 ? 'Base premium · ' + pets.length + ' pets · 3 years' : 'Base premium · 3 years', amount: baseTotal });
    lines.push({ k: 'consumables', label: 'Consumables Plus', amount: 0, note: 'Included' });
    lines.push({ k: 'tpl', label: 'Pet third-party liability', amount: 0, note: 'Included' });
    if (pedTotal) lines.push({ k: 'ped', label: 'Existing-condition loading', amount: pedTotal });
    if (waiverTotal) lines.push({ k: 'waiver', label: '12-month existing-condition cover', amount: waiverTotal });
    if (multiTotal) lines.push({ k: 'multi', label: 'Multi-pet discount (10%)', amount: multiTotal });
    lines.push({ k: 'lt', label: 'Long-term discount (8%)', amount: lt });
    if (c.amount) lines.push({ k: 'coupon', label: 'Offer ' + c.code, amount: -c.amount });
    lines.push({ k: 'gst', label: 'GST (18%)', amount: gst });
    return {
      status: refer ? 'refer' : 'ok', sumInsured: CFG.plan.sumInsured, termYears: CFG.plan.termYears,
      lines: lines, total: total, perYear: r0(total / 3), coupon: c, perPet: perPet,
      waiverPrice: r0(perPet.reduce(function (t, x) { return t + x.net; }, 0) * 0.12 * (1 - CFG.plan.longTermDiscount) * (1 + CFG.plan.gst)),
      totalLabel: inr(total)
    };
  }
  function applyCoupon(code, amount) {
    code = String(code || '').trim().toUpperCase(); if (!code) return { code: '', amount: 0, valid: null };
    var c = CFG.coupons[code]; if (!c) return { code: code, amount: 0, valid: false, error: 'This code is not valid.' };
    var a = c.type === 'pct' ? Math.min(amount * c.value, c.max || Infinity) : c.value;
    return { code: code, amount: r0(a), valid: true, label: c.label };
  }

  var V = {
    name: function (v) { return /^[A-Za-z][A-Za-z .'-]{1,49}$/.test((v || '').trim()) ? '' : 'Enter a valid name'; },
    mobile: function (v) { return /^[6-9]\d{9}$/.test(v || '') ? '' : 'Enter a valid 10-digit mobile number'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || '') ? '' : 'Enter a valid email'; },
    pincode: function (v) { return /^[1-9]\d{5}$/.test(v || '') ? '' : 'Enter a 6-digit pincode'; },
    required: function (v) { return String(v || '').trim() ? '' : 'Required'; },
    ownerDob: function (v) { var a = ageFromDob(v); return a == null ? 'Use DD/MM/YYYY' : a < 18 ? 'You must be 18 or older' : a > 80 ? 'Proposer must be 80 or younger' : ''; },
    petDob: function (v) { var a = ageFromDob(v); return a == null ? 'Use DD/MM/YYYY' : a < 0 ? 'Date is in the future' : a < 0.25 ? 'Pets can join from 3 months old' : a > 25 ? 'Check the date of birth' : ''; },
    aadhaar: function (v) { return /^[2-9]\d{11}$/.test((v || '').replace(/\s/g, '')) ? '' : 'Enter a valid 12-digit Aadhaar number'; },
    otp: function (v) { return /^\d{6}$/.test(v || '') ? '' : 'Enter the 6-digit OTP'; }
  };

  function policyNumber(seed) { var n = String(Math.abs(seed || Date.now()) % 1e7).padStart(7, '0'); return 'OG-' + String(new Date().getFullYear()).slice(2) + '-1901-8466-' + n; }
  function policyPeriod(from) {
    var s = new Date(from || Date.now()); s.setDate(s.getDate() + 1);
    var e = new Date(s); e.setFullYear(e.getFullYear() + CFG.plan.termYears); e.setDate(e.getDate() - 1);
    var f = function (d) { return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
    return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10), label: f(s) + ' – ' + f(e) };
  }

  return { BREEDS: BREEDS, PED: PED, RELATIONS: RELATIONS, GENDERS: GENDERS, pincode: pincode, ageFromDob: ageFromDob, pedInfo: pedInfo, pedAssess: pedAssess, quote: quote, applyCoupon: applyCoupon, V: V, policyNumber: policyNumber, policyPeriod: policyPeriod, inr: inr };
});

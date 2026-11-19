/* Browser API client. Same contract as netlify/functions/api.js.
   mode 'server' → POST /api/<route>; 'local' → in-browser mock (localStorage); 'auto' → try server once, fall back to local. */
(function (root) {
  var CFG = root.PET_CONFIG, E = root.PetEngine;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var uid = function (p) { return p + '_' + Math.random().toString(36).slice(2, 10); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem('petins:' + k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('petins:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var otpReq = {};

  var local = {
    'lead/create': function (b) { var id = uid('q'); var rec = { id: id, createdAt: Date.now(), lead: b, step: 'verify', resumeToken: uid('r') }; store.set('quote:' + id, rec); store.set('token:' + rec.resumeToken, id); return { id: id, resumeToken: rec.resumeToken }; },
    'quote/get': function (b) { var id = b.id || store.get('token:' + b.resumeToken); var r = id && store.get('quote:' + id); if (!r) throw { status: 404, message: 'Quote not found' }; return r; },
    'quote/save': function (b) { var r = store.get('quote:' + b.id) || { id: b.id }; for (var k in b.patch) r[k] = b.patch[k]; r.updatedAt = Date.now(); store.set('quote:' + b.id, r); return { ok: true, updatedAt: r.updatedAt }; },
    'premium': function (b) { return E.quote(b); },
    'pincode': function (b) { return E.pincode(b.pincode) || { error: 'invalid' }; },
    'otp/send': function (b) { if (E.V.mobile(b.mobile)) throw { status: 400, message: 'Invalid mobile' }; var id = uid('otp'); otpReq[id] = { tries: 0 }; return { requestId: id, expiresIn: 300, resendIn: 30, demoCode: CFG.demo.otp }; },
    'otp/verify': function (b) { var r = otpReq[b.requestId] || { tries: 0 }; r.tries++; if (r.tries > 5) throw { status: 429, message: 'Too many attempts. Request a new OTP.' }; if (b.code !== CFG.demo.otp) throw { status: 400, message: 'Incorrect OTP. ' + (5 - r.tries) + ' attempts left.' }; return { verified: true, token: uid('sess') }; },
    'kyc/send': function (b) { if (E.V.aadhaar(b.aadhaar)) throw { status: 400, message: 'Invalid Aadhaar' }; return { requestId: uid('kyc'), resendIn: 30, demoCode: CFG.demo.otp }; },
    'kyc/verify': function (b) { var a = (b.aadhaar || '').replace(/\s/g, ''); if (a.slice(-4) === CFG.demo.kycFailSuffix) return { verified: false, reason: 'AADHAAR_OTP_FAILED' }; if (b.code !== CFG.demo.otp) throw { status: 400, message: 'Incorrect OTP' }; return { verified: true, method: 'aadhaar_otp', ref: uid('ckyc') }; },
    'kyc/upload': function (b) { if (!b.fileName) throw { status: 400, message: 'No file' }; return { verified: true, method: 'document', ref: uid('ckyc') }; },
    'payment/create': function (b) { var q = E.quote(b.quoteInput || {}); if (b.amount && Math.abs(b.amount - q.total) > 1) throw { status: 409, message: 'Price changed. Please review your quote.' }; return { orderId: uid('order') + '.' + q.total, amount: q.total, currency: 'INR', gateway: 'mock' }; },
    'payment/confirm': function (b) {
      var amt = +String(b.orderId || '').split('.').pop() || b.amount;
      if (b.simulate === 'fail') return { status: 'failed', reference: '11-8466-' + String(Date.now()).slice(-10) + '-00', amount: amt };
      return { status: 'paid', paymentId: uid('pay'), policy: { number: E.policyNumber(Date.now()), period: E.policyPeriod(), amount: amt, issuedAt: Date.now() } };
    }
  };

  /* Only these routes go to the server; quote storage / KYC stay browser-local in the demo. */
  var SERVER_ROUTES = { 'premium': 1, 'otp/send': 1, 'otp/verify': 1, 'payment/create': 1, 'payment/confirm': 1 };
  var mode = CFG.api.mode, probed = null;
  function serverCall(route, body) {
    return fetch(CFG.api.base + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { if ((r.headers.get('content-type') || '').indexOf('json') < 0) throw { status: r.status, message: 'API unavailable' }; return r.json().then(function (j) { if (!r.ok) throw { status: r.status, message: j.message || 'Request failed' }; return j; }); });
  }
  function call(route, body, latency) {
    var useServer = SERVER_ROUTES[route] && (mode === 'server' || (mode === 'auto' && probed === true));
    if (SERVER_ROUTES[route] && mode === 'auto' && probed === null && location.protocol.indexOf('http') === 0) {
      return serverCall('health', {}).then(function () { probed = true; return call(route, body, latency); }, function () { probed = false; return call(route, body, latency); });
    }
    if (useServer) return serverCall(route, body);
    return wait(latency == null ? 450 : latency).then(function () { return local[route](body || {}); });
  }

  root.PetAPI = {
    call: call, store: store,
    createLead: function (lead) { return call('lead/create', lead, 300); },
    getQuote: function (q) { return call('quote/get', q, 150); },
    saveQuote: function (id, patch) { return call('quote/save', { id: id, patch: patch }, 0); },
    premium: function (input) { return call('premium', input, 120); },
    sendOtp: function (mobile) { return call('otp/send', { mobile: mobile }); },
    verifyOtp: function (requestId, code) { return call('otp/verify', { requestId: requestId, code: code }); },
    kycSend: function (aadhaar) { return call('kyc/send', { aadhaar: aadhaar }); },
    kycVerify: function (aadhaar, code) { return call('kyc/verify', { aadhaar: aadhaar, code: code }, 900); },
    kycUpload: function (fileName) { return call('kyc/upload', { fileName: fileName }, 1400); },
    createPayment: function (quoteId, amount, quoteInput) { return call('payment/create', { quoteId: quoteId, amount: amount, quoteInput: quoteInput }); },
    confirmPayment: function (quoteId, orderId, simulate) {
      return call('payment/confirm', { quoteId: quoteId, orderId: orderId, simulate: simulate }, 1600).then(function (r) {
        if (r.status === 'paid') { var rec = store.get('quote:' + quoteId) || {}; rec.policy = r.policy; rec.step = 'success'; store.set('quote:' + quoteId, rec); }
        return r;
      });
    },
    resumeUrl: function (token, page) { var u = new URL(page || location.href, location.href); u.search = '?resume=' + token + '&partner=' + CFG.partner.id; return u.toString(); },
    track: function (event, props) { var q = store.get('events') || []; q.push({ e: event, p: props || {}, t: Date.now() }); store.set('events', q.slice(-200)); }
  };
})(typeof self !== 'undefined' ? self : this);

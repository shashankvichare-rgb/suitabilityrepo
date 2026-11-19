/* White-label config. One file controls partner name, logo, colours, font, offers and API mode.
   Pick a partner with ?partner=<id>, or set DEFAULT_PARTNER. Works in the browser and in Node (Netlify functions). */
(function (root, factory) {
  var cfg = factory();
  if (typeof module === 'object' && module.exports) module.exports = cfg;
  else { root.PET_CONFIG = cfg; cfg.boot(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var PARTNERS = {
    pawsindia: {
      id: 'pawsindia', name: 'PawsIndia', product: 'Pet Health Insurance', logo: (typeof self !== 'undefined' && self.PET_LOGO_DATA) || 'assets/logo.png',
      support: { phone: '+91 00000 00000', email: 'support@pawsindia.com', whatsapp: '910000000000' },
      theme: { brand: '#D3434F', brandDark: '#B8333F', brandInk: '#C23C48', tint: '#FDF0EF', tint2: '#F9E3E0', ink: '#2A2629', muted: '#5E575B', line: '#EFE5DF', bg: '#FBF6F2', card: '#FFFFFF', ok: '#23885C', okTint: '#E9F6EF', font: "'Nunito', system-ui, sans-serif" },
      sso: { label: 'PawsIndia account' }
    },
    cleartrip: {
      id: 'cleartrip', name: 'Cleartrip', product: 'Pet Health Insurance', logo: null,
      support: { phone: '+91 00000 00000', email: 'pets@partner.example', whatsapp: '910000000000' },
      theme: { brand: '#FF4403', brandDark: '#B83000', brandInk: '#B83000', tint: '#FFF3EE', tint2: '#FFD9C7', ink: '#172B4D', muted: '#667085', line: '#D1D6E3', bg: '#F7F8FA', card: '#FFFFFF', ok: '#17A34A', okTint: '#E8F8F0', font: "'Inter', system-ui, sans-serif" },
      sso: { label: 'Cleartrip login' }
    }
  };
  var cfg = {
    DEFAULT_PARTNER: 'pawsindia',
    PARTNERS: PARTNERS,
    insurer: { name: 'Bajaj General Insurance Limited', irdai: '113', product: 'My Family Complete', uin: 'BAJHLIP27081V012627', claimsEmail: 'petcare@bajajgeneral.com', claimsPhone: '1800 209 5858' },
    broker: { name: 'Symbo Insurance', reg: '[XXXX]' },
    plan: { sumInsured: 500000, termYears: 3, gst: 0.18, longTermDiscount: 0.08 },
    coupons: {
      PAWS10: { type: 'pct', value: 0.05, max: 600, label: '5% off, up to ₹600' },
      FIRSTPET: { type: 'flat', value: 500, label: '₹500 off' }
    },
    multiPetDiscount: 0.10,
    maxPets: 2,
    api: { mode: 'auto', base: '/api' }, /* 'local' = in-browser mock, 'server' = Netlify functions, 'auto' = server if reachable */
    demo: { otp: '123456', kycFailSuffix: '0000', showHints: true },
    partner: null,
    setPartner: function (id) {
      if (!PARTNERS[id]) return;
      cfg.partner = PARTNERS[id];
      try { localStorage.setItem('petins:partner', id); } catch (e) {}
      cfg.applyTheme();
    },
    applyTheme: function () {
      if (typeof document === 'undefined' || !cfg.partner) return;
      var t = cfg.partner.theme, s = document.documentElement.style;
      var map = { brand: '--brand', brandDark: '--brand-dark', brandInk: '--brand-ink', tint: '--tint', tint2: '--tint2', ink: '--ink', muted: '--muted', line: '--line', bg: '--bg', card: '--card', ok: '--ok', okTint: '--ok-tint', font: '--font' };
      for (var k in map) s.setProperty(map[k], t[k]);
      document.title = cfg.partner.name + ' · ' + cfg.partner.product;
    },
    boot: function () {
      var id = cfg.DEFAULT_PARTNER;
      try {
        var q = new URLSearchParams(location.search).get('partner');
        id = (q && PARTNERS[q]) ? q : (localStorage.getItem('petins:partner') || id);
      } catch (e) {}
      cfg.setPartner(PARTNERS[id] ? id : cfg.DEFAULT_PARTNER);
    }
  };
  return cfg;
});

/* Builds the printable policy schedule (demo). Real build: the insurer's issued PDF URL replaces this. */
(function (root) {
  root.PetPolicyDoc = function (s) {
    var P = root.PET_CONFIG, pol = (s.result || {}).policy || {}, f = s.form;
    var pets = s.pets.map(function (p) { return (p.name || 'Pet') + ' · ' + p.breed + ' · ' + (p.gender || '') + ' · DOB ' + (p.dob || '—'); }).join('<br>');
    var html = '<!doctype html><meta charset="utf-8"><title>Policy ' + pol.number + '</title><style>body{font:14px/1.5 system-ui;margin:40px;color:#222}h1{font-size:22px;margin:0}table{border-collapse:collapse;width:100%;margin:16px 0}td{border:1px solid #ddd;padding:8px 10px;vertical-align:top}td:first-child{width:34%;color:#555;font-weight:600}.m{color:#666;font-size:12px}</style>' +
      '<h1>Policy Schedule · ' + P.partner.product + '</h1><div class="m">' + P.insurer.name + ' · ' + P.insurer.product + ' · UIN ' + P.insurer.uin + ' · Distributed by ' + P.partner.name + ', powered by ' + P.broker.name + '</div><table>' +
      '<tr><td>Policy number</td><td>' + pol.number + '</td></tr><tr><td>Policy period</td><td>' + (pol.period ? pol.period.label : '') + '</td></tr>' +
      '<tr><td>Proposer</td><td>' + f.first + ' ' + f.last + '<br>' + f.line1 + ', ' + (f.line2 || '') + '<br>' + f.city + ', ' + f.state + ' ' + f.pin + '<br>+91 ' + f.mobile + ' · ' + f.email + '</td></tr>' +
      '<tr><td>Insured pet(s)</td><td>' + pets + '</td></tr><tr><td>Sum insured</td><td>₹5,00,000 per policy year</td></tr>' +
      '<tr><td>Add-ons</td><td>Consumables Plus · Pet Third Party Liability (₹5 lakh)' + (s.pedWaiver ? ' · 12-month PED waiting period' : '') + '</td></tr>' +
      '<tr><td>Nominee</td><td>' + f.nomName + ' (' + f.nomRel + ')</td></tr><tr><td>Premium paid</td><td>₹' + (pol.amount || 0).toLocaleString('en-IN') + ' incl. GST</td></tr></table>' +
      '<p class="m">DEMO DOCUMENT — not a valid insurance policy. Insurance is the subject matter of solicitation.</p><scr' + 'ipt>print()</scr' + 'ipt>';
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    var w = window.open(url, '_blank');
    if (!w) { var a = document.createElement('a'); a.href = url; a.download = pol.number + '.html'; a.click(); }
  };
})(typeof self !== 'undefined' ? self : this);

/* symbo.si only: not part of the landing page source (pet.css / pet.js stay as designed).
   1. On a.html and b.html, a slim bar at the very top of the page switches between Variation 1 and 2.
      It sits in the page flow above the sticky header, so it scrolls away with the page.
   2. On small screens the pages have their own bottom bar (Buy now bar, tab bar, the details sheet's button),
      so the site's corner menu is asked to sit just above it (<body data-symbo-menu-bottom>).
   Load it as the first thing inside <body>. */
(function () {
  var variant = document.body.getAttribute('data-variant');

  if (variant === 'a' || variant === 'b') {
    var css = '.vsw{background:#2A2629;color:#fff;font-family:Nunito,system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;padding:7px 12px}' +
      '.vsw__seg{display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,.12);max-width:100%}' +
      '.vsw__seg a{display:flex;align-items:baseline;gap:7px;padding:7px 18px;border-radius:999px;color:rgba(255,255,255,.82);font-size:13.5px;font-weight:800;line-height:1.2;white-space:nowrap;text-decoration:none;transition:background .15s,color .15s}' +
      '.vsw__seg a small{font-size:12px;font-weight:700;opacity:.75}' +
      '.vsw__seg a:hover{color:#fff;background:rgba(255,255,255,.1)}' +
      '.vsw__seg a[aria-current]{background:#fff;color:#2A2629}' +
      '.vsw__seg a:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
      '@media (max-width:519px){.vsw__seg{width:100%}.vsw__seg a{flex:1;justify-content:center;padding:8px 10px}.vsw__seg a small{display:none}}' +
      '@media print{.vsw{display:none}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var q = location.search || '';
    var link = function (v, n, sub) {
      return '<a href="' + v + '.html' + q + '"' + (v === variant ? ' aria-current="page"' : '') + '>Variation ' + n + '<small>' + sub + '</small></a>';
    };
    var bar = document.createElement('nav');
    bar.className = 'vsw';
    bar.setAttribute('aria-label', 'Page variation');
    bar.innerHTML = '<div class="vsw__seg">' + link('a', 1, 'Reasons first') + link('b', 2, 'Cashless first') + '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function lift() {
    var tops = [], els = document.querySelectorAll('.buybar, .tabbar, .sheet-bg.on .sheet__foot');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (r.width && r.left < 120 && r.top < innerHeight && r.bottom > innerHeight - 4) tops.push(r.top);
    }
    var v = tops.length ? String(Math.round(innerHeight - Math.min.apply(null, tops) + 8)) : '';
    if (document.body.dataset.symboMenuBottom !== v) document.body.dataset.symboMenuBottom = v;
  }
  document.addEventListener('DOMContentLoaded', lift);
  addEventListener('resize', lift);
  setInterval(lift, 600);
})();

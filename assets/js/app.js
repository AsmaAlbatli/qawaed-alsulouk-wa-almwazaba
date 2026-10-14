/* ==========================================================================
   منصة قواعد السلوك والمواظبة — منطق الواجهة
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var IS_FILE = location.protocol === 'file:';

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ══════════════ 1) بطاقة ملف الدليل ══════════════ */
  (function docCard() {
    $('#docTitle').textContent = DOC.title;
    $('#docMeta').textContent = DOC.edition + ' · ' + DOC.year + ' · ' + DOC.issuer + ' · ' + DOC.size;
    $('#heroLead').textContent =
      'مرجع رقمي تفاعلي لدليل «' + DOC.title + '»: التعريفات والأهداف والأدوار ودرجات تقييم السلوك، ' +
      'مع إمكانية عرض ملف الدليل وتنزيله من داخل المنصة.';

    ['#btnDownload', '#btnOpenTab', '#mDownload'].forEach(function (sel) {
      var a = $(sel);
      a.href = DOC.file;
      a.setAttribute('download', DOC.fileName);
    });
    $('#modalName').textContent = DOC.title;

    /* في وضع الفتح المباشر يتجاهل المتصفح خاصية التنزيل،
       ونحوّل الزر إلى «فتح في تبويب» حتى لا يبدو معطلًا. */
    if (IS_FILE) {
      var d = $('#btnDownload');
      d.removeAttribute('download');
      d.innerHTML = '↗️ فتح الملف';
      d.title = 'في وضع الفتح المباشر يفتح المتصفح الملف في تبويب جديد';
    }
  })();

  /* ══════════════ 2) الأهداف ══════════════ */
  $('#goalGeneral').textContent = GOALS.general;
  (function () {
    var ul = $('#goalList');
    GOALS.points.forEach(function (p) { ul.appendChild(el('li', null, p)); });
  })();

  /* ══════════════ 3) بطاقات الأدوار ══════════════ */
  var ROLES = [window.ROLE_MANAGER, window.ROLE_TEACHER, window.ROLE_PARENT,
                window.ROLE_COUNSELOR, window.ROLE_COMMITTEE, window.ROLE_STUDENT, window.ROLE_DEPT];

  function roleCard(role, limit) {
    var d = el('details', 'role');
    if (limit) d.open = true;
    var s = el('summary');
    s.innerHTML =
      '<span class="ico">' + role.icon + '</span>' +
      '<span class="ttl">' + role.name + '<small>' + role.sub + ' — ' + role.page + '</small></span>' +
      '<span class="chev">▼</span>';
    var body = el('div', 'body');
    var ul = el('ul', 'points');
    role.points.slice(0, limit || role.points.length).forEach(function (p) {
      ul.appendChild(el('li', null, p));
    });
    body.appendChild(ul);
    if (!limit && role.points.length > 6) {
      var more = el('p', null,
        '<a href="roles.html">عرض كل النقاط (' + role.points.length + ' نقطة) ←</a>');
      more.style.fontSize = '.88rem';
      more.style.marginTop = '10px';
      body.appendChild(more);
    }
    d.appendChild(s);
    d.appendChild(body);
    return d;
  }

  (function () {
    var g = $('#roleGrid');
    ROLES.forEach(function (r) {
      var w = el('div');
      w.appendChild(roleCard(r, 6));
      g.appendChild(w);
    });
  })();

  /* ══════════════ 4) التعريفات ══════════════ */
  (function () {
    var g = $('#defGrid');
    (window.DEFS_A || []).concat(window.DEFS_B || []).forEach(function (d) {
      var c = el('div', 'item');
      c.innerHTML = '<h4><span class="num">' + d.n + '</span>' + d.t + '</h4><p>' + d.d + '</p>';
      g.appendChild(c);
    });
  })();

  /* ══════════════ 5) تقييم السلوك ══════════════ */
  $('#behLead').textContent = BEHAVIOR.lead;
  (function () {
    var r = $('#degRow');
    BEHAVIOR.degrees.forEach(function (d) {
      var x = el('span', 'd d' + d.n);
      x.textContent = d.n + ' — ' + d.t.replace('مشكلات ', '') + ' (' + d.v + ')';
      r.appendChild(x);
    });
  })();
  (function () {
    var c = $('#behLevels');
    BEHAVIOR.levels.forEach(function (l) {
      c.appendChild(el('div', 'item',
        '<h4>' + l.t + '</h4><p>' + l.d + '</p>')).style.marginBottom = '10px';
    });
  })();
  (function () {
    var g = $('#behDomains');
    BEHAVIOR.domains.forEach(function (x) {
      g.appendChild(el('div', 'item', '<h4>' + x.t + '</h4><p>' + x.d + '</p>'));
    });
  })();
  (function () {
    var g = $('#behDist');
    BEHAVIOR.distinguished.forEach(function (x) {
      g.appendChild(el('div', 'item', '<p>' + x + '</p>'));
    });
  })();

  /* ══════════════ 6) النماذج ══════════════ */
  (function () {
    var g = $('#formGrid');
    FORMS.forEach(function (f, i) {
      g.appendChild(el('div', 'item',
        '<h4><span class="num">' + (i + 1) + '</span>' + f + '</h4>'));
    });
  })();

  /* ══════════════ 7) البحث ══════════════ */
  (function () {
    var UNITS = 'main .item, main .role, main tbody tr, main .deg .d, main .points li, main .pdfcard';
    var q = $('#q'), out = $('#count'), timer;

    function run() {
      var v = q.value.trim().toLowerCase(), n = 0;
      $$(UNITS).forEach(function (node) {
        var txt = node.tagName === 'DETAILS'
          ? node.querySelector('summary').textContent
          : (node.textContent || '');
        var hit = !v || txt.toLowerCase().indexOf(v) > -1;
        node.classList.toggle('hide', !hit);
        if (hit) n++;
      });
      out.textContent = v ? (n ? n + ' عنصر مطابق' : 'لا نتائج — جرّب كلمة أخرى') : '';
      $$('main .card').forEach(function (card) {
        var inner = $$(UNITS, card);
        var hit = inner.length
          ? inner.some(function (x) { return !x.classList.contains('hide'); })
          : (!v || (card.textContent || '').toLowerCase().indexOf(v) > -1);
        card.classList.toggle('hide', !!v && !hit);
      });
      $$('main section').forEach(function (s) {
        var vis = $$(UNITS + ', .card', s).some(function (x) { return !x.classList.contains('hide'); });
        s.classList.toggle('hide', !!v && !vis);
      });
    }

    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 180); });
  })();

  /* ══════════════ 8) عارض PDF ══════════════ */
  var modal = $('#pdfModal'), canvas = $('#pdfCanvas'), ctx = canvas.getContext('2d');
  var doc = null, page = 1, zoom = 1.1, task = null, rendering = false;

  function status(t) { $('#pdfStatus').textContent = t; }

  async function render() {
    if (!doc || rendering) return;
    rendering = true;
    if (task) { try { task.cancel(); } catch (e) {} }
    try {
      var p = await doc.getPage(page);
      var vp = p.getViewport({ scale: zoom * (window.devicePixelRatio || 1) });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = Math.floor(vp.width / (window.devicePixelRatio || 1)) + 'px';
      task = p.render({ canvasContext: ctx, viewport: vp });
      await task.promise;
      $('#mPageLbl').textContent = 'صفحة ' + page + ' / ' + doc.numPages;
      status('تم تحميل الملف بنجاح — استخدم أزرار التنقل لعرض الصفحات.');
    } catch (e) {
      if (e && e.name === 'RenderingCancelledException') { rendering = false; return; }
      status('تعذّر عرض الصفحة: ' + (e && e.message ? e.message : e));
    }
    rendering = false;
  }

  async function open() {
    /* عارض pdf.js يحتاج تحميل مكتبة العمل عبر الشبكة — ممنوع في file:// */
    if (IS_FILE) {
      window.open(DOC.file, '_blank');
      return;
    }
    modal.classList.add('open');
    if (doc) { page = 1; render(); return; }
    status('جارٍ تحميل الملف…');
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdf.worker.min.js';
      doc = await pdfjsLib.getDocument({ url: DOC.file }).promise;
      status('تم تحميل الملف بنجاح.');
      await render();
    } catch (e) {
      status('تعذّر تحميل الملف داخل المتصفح. استخدم زر «تنزيل الملف» لفتحه على جهازك. (' +
             (e && e.message ? e.message : e) + ')');
    }
  }

  function close() { modal.classList.remove('open'); }

  $('#btnView').addEventListener('click', open);
  $('#mClose').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft' && doc && page < doc.numPages) { page++; render(); }
    if (e.key === 'ArrowRight' && doc && page > 1) { page--; render(); }
  });
  $('#mNext').addEventListener('click', function () {
    if (doc && page < doc.numPages) { page++; render(); }
  });
  $('#mPrev').addEventListener('click', function () {
    if (doc && page > 1) { page--; render(); }
  });
  $('#mZoomIn').addEventListener('click', function () { zoom = Math.min(3, zoom + 0.2); render(); });
  $('#mZoomOut').addEventListener('click', function () { zoom = Math.max(0.4, zoom - 0.2); render(); });

  window.addEventListener('resize', function () {
    if (modal.classList.contains('open')) render();
  });
})();
/* ==========================================================================
   صفحة الأدوار وإجراءات الغياب — منطق الواجهة
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function points(arr, cls) {
    var ul = el('ul', cls || 'points');
    arr.forEach(function (p) { ul.appendChild(el('li', null, p)); });
    return ul;
  }

  /* ══════════ رابط ملف الدليل ══════════ */
  $('#navPdf').href = DOC.file;
  $('#navPdf').setAttribute('download', DOC.fileName);
  if (location.protocol === 'file:') {
    $('#navPdf').removeAttribute('download');
    $('#navPdf').textContent = 'فتح ملف الدليل';
  }
  window.openPdf = function () { window.location.href = DOC.file; };

  /* ══════════ بطاقات الأدوار ══════════ */
  var ORDER = [
    window.ROLE_TEACHER, window.ROLE_MANAGER, window.ROLE_PARENT,
    window.ROLE_COUNSELOR, window.ROLE_COMMITTEE, window.ROLE_STUDENT, window.ROLE_DEPT
  ];

  ORDER.forEach(function (role) {
    var d = el('details', 'role');
    d.id = 'role-' + role.id;
    d.innerHTML =
      '<summary><span class="ico">' + role.icon + '</span>' +
      '<span class="ttl">' + esc(role.name) + '<small>' + esc(role.sub) + ' — ' + esc(role.page) +
      ' · ' + role.points.length + ' نقطة</small></span><span class="chev">▼</span></summary>';
    var body = el('div', 'body');
    body.appendChild(points(role.points));
    d.appendChild(body);
    $('#roleGrid').appendChild(d);
  });

  $('#expandAll').addEventListener('click', function () {
    $$('#roleGrid .role').forEach(function (r) { r.open = true; });
  });
  $('#collapseAll').addEventListener('click', function () {
    $$('#roleGrid .role').forEach(function (r) { r.open = false; });
  });

  /* ══════════ المادة (31): تقييم المواظبة ══════════ */
  $('#tAssess').textContent = ATT_ASSESS.art + ' — ' + ATT_ASSESS.title;
  $('#lAssess').textContent = ATT_ASSESS.lead;
  $('#pAssess').appendChild.apply($('#pAssess'), ATT_ASSESS.points.map(function (p) { return el('li', null, p); }));
  ATT_ASSESS.rules.forEach(function (p) { $('#rAssess').appendChild(el('li', null, p)); });

  /* ══════════ المادة (32): حالات العذر ══════════ */
  $('#tExc').textContent = ATT_EXCUSES.art + ' — ' + ATT_EXCUSES.title;
  $('#lExc').textContent = ATT_EXCUSES.lead;
  ATT_EXCUSES.rows.forEach(function (r) {
    var tr = el('tr');
    tr.innerHTML = '<td>' + r.n + '</td><td>' + esc(r.c) + '</td><td>' + esc(r.e || '—') + '</td>';
    tr.setAttribute('data-search', (r.n + ' ' + r.c + ' ' + r.e).toLowerCase());
    $('#tbExc').appendChild(tr);
  });

  /* ══════════ المادة (33): الغياب بعذر ══════════ */
  $('#tExcused').textContent = ATT_EXCUSED.art + ' — ' + ATT_EXCUSED.title;
  $('#lExcused').textContent = ATT_EXCUSED.lead;
  $('#nExcused').textContent = '📌 ' + ATT_EXCUSED.note;
  ATT_EXCUSED.rows.forEach(function (r) {
    var tr = el('tr');
    tr.innerHTML = '<td class="days">' + esc(r.days) + '</td><td>' +
      r.points.map(function (p) { return '• ' + esc(p); }).join('<br>') + '</td>';
    tr.setAttribute('data-search', (r.days + ' ' + r.points.join(' ')).toLowerCase());
    $('#tbExcused').appendChild(tr);
  });

  /* ══════════ المادة (34): الغياب بدون عذر ══════════ */
  $('#tUn').textContent = ATT_UNEXCUSED.art + ' — ' + ATT_UNEXCUSED.title;
  $('#lUn').textContent = ATT_UNEXCUSED.lead;
  $('#nUn').textContent = '📌 ' + ATT_UNEXCUSED.note;
  $('#fUn').textContent = '⚖️ ' + ATT_UNEXCUSED.footer;

  ATT_UNEXCUSED.degrees.forEach(function (d) {
    var tr = el('tr');
    tr.innerHTML = '<td class="days">' + esc(d.days) + '</td><td>' + esc(d.deg) + '</td>';
    tr.setAttribute('data-search', (d.days + ' ' + d.deg).toLowerCase());
    $('#tbDeg').appendChild(tr);
  });
  ATT_UNEXCUSED.rows.forEach(function (r) {
    var tr = el('tr');
    tr.innerHTML = '<td class="days">' + esc(r.days) + '</td><td>' +
      r.points.map(function (p) { return '• ' + esc(p); }).join('<br>') + '</td>';
    tr.setAttribute('data-search', (r.days + ' ' + r.points.join(' ')).toLowerCase());
    $('#tbUn').appendChild(tr);
  });

  /* ══════════ المادة (35): أيام المواظبة العامة ══════════ */
  $('#tGen').textContent = ATT_GENERAL.art + ' — ' + ATT_GENERAL.title;
  ATT_GENERAL.points.forEach(function (p) { $('#pGen').appendChild(el('li', null, p)); });

  /* ══════════ حاسبة إجراءات الغياب ══════════ */
  function bucket(d) { return d >= 10 ? 10 : (d >= 5 ? 5 : 3); }

  function calc() {
    var d = Math.max(0, parseInt($('#cDays').value, 10) || 0);
    var type = $('#cType').value;
    var src = (type === 'excused') ? ATT_EXCUSED : ATT_UNEXCUSED;
    var row = src.rows.filter(function (r) { return bucket(parseInt(r.days, 10)) === bucket(d); })[0];
    var out = $('#cOut');
    out.innerHTML = '';

    if (!row) {
      out.appendChild(el('p', null, 'لا توجد إجراءات محددة لهذا العدد — يُطبَّق المكتبات من المادة (35) وأيام المواظبة العامة.'));
      return;
    }

    var head = el('div', 'card');
    head.style.background = (type === 'excused') ? '#EAF7F1' : '#FFF1EF';
    head.style.borderColor = (type === 'excused') ? '#9BD5BC' : '#E7A49F';
    head.style.boxShadow = 'none';
    head.innerHTML = '<strong>المادة (' + (type === 'excused' ? '33' : '34') + ') — التصرف عند ' +
      esc(row.days) + ' أيام غياب ' + (type === 'excused' ? 'بعذر' : 'بدون عذر') + ':</strong>';
    out.appendChild(head);
    out.appendChild(points(row.points));

    if (type === 'unexcused') {
      var deg = ATT_UNEXCUSED.degrees.filter(function (x) {
        return bucket(parseInt(x.days, 10)) === bucket(d);
      })[0];
      if (deg) {
        out.appendChild(el('p', null, '<strong style="color:var(--d5)">درجات المواظبة:</strong> ' + esc(deg.deg)));
      }
      out.appendChild(el('p', null, '<em>' + esc(ATT_UNEXCUSED.note) + '</em>'));
    } else {
      out.appendChild(el('p', null, '<em>📌 ' + esc(ATT_EXCUSED.note) + '</em>'));
    }
  }

  $('#cDays').addEventListener('input', calc);
  $('#cType').addEventListener('change', calc);
  calc();

  /* ══════════ البحث ══════════ */
  (function () {
    var UNITS = 'main .role, main tbody tr, main .points li';
    var q = $('#q'), out = $('#count'), timer;

    function run() {
      var v = q.value.trim().toLowerCase(), n = 0;
      $$(UNITS).forEach(function (node) {
        var txt = node.getAttribute('data-search');
        if (txt == null) {
          txt = node.tagName === 'DETAILS'
            ? node.querySelector('summary').textContent
            : (node.textContent || '');
        }
        var hit = !v || txt.toLowerCase().indexOf(v) > -1;
        node.classList.toggle('hide', !hit);
        if (hit) n++;
      });
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
      out.textContent = v ? (n ? n + ' عنصر مطابق' : 'لا نتائج — جرّب كلمة أخرى') : '';
    }

    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 180); });
  })();
})();
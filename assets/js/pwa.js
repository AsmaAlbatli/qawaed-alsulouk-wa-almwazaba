/* =============================================================================
   PWA — تسجيل Service Worker، زر التثبيت، إشعار التحديث، حالة الاتصال
   يعمل على كل المتصفحات، ويت graceful على التي لا تدعم التثبيت.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var IS_FILE = location.protocol === 'file:';

  /* ─────────────── 1) تسجيل Service Worker ─────────────── */
  if ('serviceWorker' in navigator && !IS_FILE) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js')
        .then(function (reg) { watch(reg); })
        .catch(function (e) { console.warn('[pwa] تعذّر التسجيل:', e); });
    });
  }

  /* ─────────────── 2) التحديث عند وجود نسخة جديدة ─────────────── */
  function watch(reg) {
    reg.addEventListener('updatefound', function () {
      var sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', function () {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBar(reg);
        }
      });
    });
  }

  function showUpdateBar(reg) {
    if ($('#updateBar')) return;
    var bar = document.createElement('div');
    bar.id = 'updateBar';
    bar.className = 'pwa-bar';
    bar.innerHTML =
      '<span>يتوفر تحديث جديد للمنصة</span>' +
      '<button type="button" id="doUpdate" class="pwa-bar-btn">تحديث الآن</button>' +
      '<button type="button" id="noUpdate" class="pwa-bar-x" aria-label="إغلاق">✕</button>';
    document.body.appendChild(bar);

    $('#doUpdate').addEventListener('click', function () {
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      setTimeout(function () { location.reload(); }, 300);
    });
    $('#noUpdate').addEventListener('click', function () { bar.remove(); });
    bar.classList.add('show');
  }

  /* ─────────────── 3) زر التثبيت ─────────────── */
  var deferred = null;
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   window.navigator.standalone === true;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    showInstall();
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    var b = $('#installBtn');
    if (b) { b.classList.add('gone'); }
    toast('تم تثبيت التطبيق على جهازك ✅');
  });

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function showInstall() {
    var btn = $('#installBtn');
    if (!btn || standalone) return;
    btn.classList.remove('gone');
    btn.onclick = function () {
      if (deferred) {
        btn.classList.add('gone');
        deferred.prompt();
        deferred.userChoice.then(function (r) {
          if (r.outcome === 'dismissed') btn.classList.remove('gone');
          deferred = null;
        });
      } else {
        showIOSGuide();
      }
    };
  }

  function showIOSGuide() {
    var g = $('#iosGuide');
    if (!g) return;
    g.classList.add('show');
    setTimeout(function () { g.classList.remove('show'); }, 9000);
  }

  /* ─────────────── 4) حالة الاتصال ─────────────── */
  var net = $('#netState');
  function syncNet() {
    if (!net) return;
    var on = navigator.onLine;
    net.className = 'net-state ' + (on ? 'on' : 'off');
    net.innerHTML = on
      ? '<span class="dot"></span> متصل'
      : '<span class="dot"></span> دون اتصال — يعمل من الذاكرة';
  }
  window.addEventListener('online', syncNet);
  window.addEventListener('offline', syncNet);
  document.addEventListener('DOMContentLoaded', syncNet);
  if (document.readyState !== 'loading') syncNet();

  /* ─────────────── 5) تنبيه سريع ─────────────── */
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'pwa-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 30);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 400);
    }, 3200);
  }
  window.pwaToast = toast;

  /* ─────────────── 6) حارس تحميل ملفات البيانات ───────────────
     لو فشل تحميل أي ملف بيانات (انقطاع شبكة / خطأ مؤقت من الخادم)
     تظهر رسالة واضحة بدل أن تُعرض المنصة ناقصة بصمت. */
  window.addEventListener('load', function () {
    var isRoles = !!document.querySelector('#roleGrid') &&
                  !!document.querySelector('#tbExc');
    var need = ['DOC',
      'ROLE_MANAGER', 'ROLE_TEACHER', 'ROLE_PARENT',
      'ROLE_COUNSELOR', 'ROLE_COMMITTEE'];
    if (isRoles) {
      need = need.concat(['ATT_ASSESS', 'ATT_EXCUSES', 'ATT_EXCUSED',
                          'ATT_UNEXCUSED', 'ATT_GENERAL']);
    } else {
      need = need.concat(['GOALS', 'DEFS_A', 'DEFS_B', 'ROLE_STUDENT',
                          'ROLE_DEPT', 'BEHAVIOR', 'FORMS']);
    }

    var missing = need.filter(function (k) { return typeof window[k] === 'undefined'; });
    if (!missing.length) return;

    var b = document.createElement('div');
    b.className = 'loaderr-bar';
    b.innerHTML =
      '<b>⚠️ تعذّر تحميل جزء من المحتوى</b>' +
      '<span>لم يُحمَّل: ' + missing.join('، ') + '</span>' +
      '<button type="button" id="loadRetry">إعادة المحاولة</button>';
    document.body.appendChild(b);
    document.body.classList.add('has-loaderr');
    document.getElementById('loadRetry').addEventListener('click', function () {
      location.reload();
    });
  });

  /* ─────────────── 7) إظهار زر التثبيت عند الحاجة ─────────────── */
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (standalone) return;
      if (deferred) { showInstall(); return; }
      // متصفح iOS لا يدعم beforeinstallprompt → نعرض زر الإرشاد
      var btn = $('#installBtn');
      if (btn && isIOS()) btn.classList.remove('gone');
    }, 1200);
  });
})();
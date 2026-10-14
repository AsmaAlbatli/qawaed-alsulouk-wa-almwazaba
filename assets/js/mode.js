/* =============================================================================
   كشف وضع التشغيل — يُحمَّل أولًا في كل صفحة
   file://  : المتصفح يمنع Service Worker و fetch و Worker — أي أن
              التثبيت(PWA) وعرض PDF داخل الصفحة لن يعملا.
   http(s)  : كل شيء يعمل.
   ========================================================================== */
(function () {
  'use strict';

  var IS_FILE = location.protocol === 'file:';
  window.FILE_MODE = IS_FILE;

  /* ── لافتة تشرح الوضع عند الفتح المباشر ────────────────────────── */
  function banner() {
    if (!IS_FILE) return;
    var b = document.createElement('div');
    b.id = 'fileModeBar';
    b.className = 'filemode-bar';
    b.innerHTML =
      '<div class="fm-head">⚠️ المنصة تعمل الآن في وضع محدود</div>' +
      '<p>فتحتَ الملف مباشرة (<code>file://</code>)، ولهذا المتصفح منع:</p>' +
      '<ul>' +
      '<li><b>تثبيت التطبيق (PWA)</b> — لا يعمل إلا عبر سيرفر أو رابط إنترنت</li>' +
      '<li><b>عارض PDF داخل الصفحة</b> — المتصفح يمنع تحميل مكتبة القارئ</li>' +
      '<li><b>زر التنزيل</b> — يُفتح الملف في تبويب بدل تنزيله</li>' +
      '</ul>' +
      '<p class="fm-fix"><b>الحل:</b> شغّل سيرفرًا محليًا في هذا المجلد:</p>' +
      '<pre class="fm-cmd">python -m http.server 8791</pre>' +
      '<p>ثم افتح: <b>http://127.0.0.1:8791/index.html</b></p>' +
      '<p class="fm-note">أو انشر المجلد على GitHub Pages واحصل على رابط مباشر ' +
      '(يوفّر لك التثبيت والعمل بدون إنترنت).</p>' +
      '<button type="button" id="fmClose" class="fm-x" aria-label="إغلاق">✕</button>';
    document.body.appendChild(b);
    document.body.classList.add('filemode');
    document.getElementById('fmClose').addEventListener('click', function () {
      b.remove();
    });
    // زر محاولات: ينقل المستخدم إلى وضع السيرفر
    var go = document.createElement('button');
    go.className = 'fm-go';
    go.textContent = 'فتح عبر السيرفر المحلي';
    go.onclick = function () {
      location.href = location.href.replace(/^file:\/\//, 'http://127.0.0.1:8791/');
    };
    b.appendChild(go);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', banner);
  } else {
    banner();
  }
})();
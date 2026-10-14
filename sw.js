/* =============================================================================
   Service Worker — منصة قواعد السلوك والمواظبة
   يعمل بالكامل دون اتصال بالإنترنت.
   ملاحظة: كل المسارات نسبية ليعمل التطبيق من أي مجلد على أي استضافة.
   ========================================================================== */
'use strict';

const VERSION = 'v1.0.4';
const SHELL_CACHE = 'brp-shell-' + VERSION;
const BIG_CACHE   = 'brp-large-' + VERSION;

/* هيكل التطبيق — يُخزَّن مسبقًا */
const SHELL = [
  './',
  './index.html',
  './roles.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/mode.js',
  './assets/js/pwa.js',
  './assets/js/app.js',
  './assets/js/roles.js',
  './assets/js/data-01-doc.js',
  './assets/js/data-02-defs-a.js',
  './assets/js/data-03-defs-b.js',
  './assets/js/data-04-role-manager.js',
  './assets/js/data-05-role-teacher.js',
  './assets/js/data-06-role-parent.js',
  './assets/js/data-07-role-counselor.js',
  './assets/js/data-08-role-committee.js',
  './assets/js/data-09-att-assess.js',
  './assets/js/data-10-att-excuses.js',
  './assets/js/data-11-att-excused.js',
  './assets/js/data-12-att-unexcused.js',
  './assets/js/data-13-att-general.js',
  './assets/js/data-14-behavior.js',
  './assets/vendor/pdf.min.js',
  './assets/vendor/pdf.worker.min.js',
  './assets/img/logo-moe-white.png','./assets/img/logo-moe-green.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-maskable-192.png',
  './assets/img/icon-maskable-512.png',
  './assets/img/apple-touch-icon.png',
  './assets/img/favicon.ico',
  './assets/img/favicon-32.png',
  './assets/img/favicon-16.png'
];

/* ملف الدليل (١٫٨ ميجابايت) — يُخزَّن عند أول عرض فقط */
const BIG = [
  './assets/files/moe-rules-1447.pdf'
];

/* ── التثبيت: تخزين هيكل التطبيق مسبقًا ───────────────────────────── */
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);

    // نضيف كل ملف على حدة حتى لا يفشل التثبيت كله بسبب ملف واحد،
    // ونعيد المحاولة مرة ثانية لأن أعذار التحميل قد تكون مؤقتة.
    const fetchOne = async (url) => {
      try {
        const r = await fetch(new Request(url, { cache: 'reload' }));
        if (r && r.ok) { await cache.put(url, r); return true; }
        return false;
      } catch (e) { return false; }
    };

    for (const url of SHELL) {
      if (url === './') continue;
      if (!(await fetchOne(url))) {
        await fetchOne(url);          // محاولة ثانية
      }
    }
    await fetchOne('./');
  })());
});

/* ── التفعيل: حذف النسخ القديمة ────────────────────────────────────── */
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k !== SHELL_CACHE && k !== BIG_CACHE) return caches.delete(k);
      return null;
    }));
    await self.clients.claim();
  })());
});

/* ── طلب التحديث من الصفحة ────────────────────────────────────────── */
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ── الجلب ────────────────────────────────────────────────────────── */

/* البحث محصور في نسخة إصدارنا فقط — لا نستخدم caches.match العامة
   لأنها تبحث في كل النسخ القديمة وقد تعيد محتوى قديمًا أو تالفًا. */
const inShell = (req) => caches.open(SHELL_CACHE).then((c) => c.match(req));
const inAnyPdf = (req) => caches.open(BIG_CACHE).then((c) => c.match(req))
  .then((hit) => hit || inShell(req));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // لا نتدخل في موارد خارجية

  /* 1) التنقل بين الصفحات: الشبكة أولًا (للتحديث) ثم الذاكرة */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // لا نخزّن استجابات الخطأ (404 / 500 / 502) حتى لا نسمّم الذاكرة
        if (fresh && fresh.ok) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        }
      } catch (err) { /* انقطاع الشبكة — نكمل من الذاكرة */ }
      return (await inShell(req)) ||
             (await inShell('./index.html')) ||
             (await inShell('./roles.html')) ||
             new Response('تعذّر تحميل الصفحة — تحقق من الاتصال.', { status: 503 });
    })());
    return;
  }

  /* 2) ملف الدليل الكبير: الذاكرة أولًا ثم الشبكة */
  if (/\.pdf$/i.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await inAnyPdf(req);
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(BIG_CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  /* 3) بقية الملفات: الذاكرة أولًا مع تحديث في الخلفية */
  e.respondWith((async () => {
    const hit = await inShell(req);
    if (hit) {
      fetch(req).then((r) => {
        if (r && r.ok) caches.open(SHELL_CACHE).then((c) => c.put(req, r));
      }).catch(() => {});
      return hit;
    }
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
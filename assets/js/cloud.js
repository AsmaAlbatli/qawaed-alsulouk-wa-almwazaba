/* =============================================================================
   cloud.js — الحساب والملاحظات السحابية عبر Supabase
   -----------------------------------------------------------------------------
   • تسجيل دخول / إنشاء حساب / استعادة كلمة المرور / تغييرها / خروج.
   • جلب الملاحظات وإضافتها وتعديلها وحذفها وتثبيتها.
   • كل الوصول محمي بسياسات RLS في قاعدة البيانات: لا يرى أحد ملاحظات غيره.
   • يعمل الملف بأمان دون إعدادات: تعرض الواجهة رسالة توضيحية بدل أن تتعطل.

   لا يحتوي هذا الملف أي مفتاح سري. الإعدادات العامة في supabase-config.js.
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var TABLE   = 'brp_notes';
  var PROFILE = 'brp_profiles';
  var MAX_TITLE = 120;
  var MAX_BODY  = 5000;

  var CFG = window.BRP_SUPABASE || {};
  var URL_ = String(CFG.url || '').trim().replace(/\/+$/, '');
  var KEY  = String(CFG.anonKey || '').trim();
  var IS_FILE = location.protocol === 'file:';

  var sb = null;
  var user = null;
  var lastUserId = null;
  var profileName = '';
  var notes = [];
  var loading = false;
  var saving = false;
  var editingId = null;
  var mode = 'login';
  var recovery = false;
  var built = false;
  var booted = false;

  /* ══════════════════════ أدوات مساعدة ══════════════════════ */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function val(sel) {
    var n = $(sel);
    return n ? String(n.value || '').trim() : '';
  }

  function toast(text, kind) {
    if (typeof window.pwaToast === 'function') { window.pwaToast(text); return; }
    var t = el('div', 'pwa-toast' + (kind === 'err' ? ' err' : ''), text);
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 20);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 350);
    }, 3400);
  }

  function msg(node, text, kind) {
    if (!node) return;
    node.className = 'auth-msg' + (text ? ' show ' + (kind || 'info') : '');
    node.textContent = text || '';
  }

  function clearMsg(node) {
    if (!node) return;
    node.className = 'auth-msg';
    node.textContent = '';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    try {
      return d.toLocaleString('ar-SA-u-ca-gregory', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return d.toLocaleString('ar');
    }
  }

  function isSecretKey(k) {
    if (!k) return false;
    if (/^sb_secret_/i.test(k)) return true;
    if (/service_role/i.test(k)) return true;
    var parts = k.split('.');
    if (parts.length === 3) {
      try {
        var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload && payload.role === 'service_role') return true;
      } catch (e) { /* ليس JWT — لا بأس */ }
    }
    return false;
  }

  /* رسالة توضّح سبب تعطّل السحابة، أو '' إذا كانت الإعدادات سليمة */
  function configError() {
    if (IS_FILE) {
      return 'الملاحظات السحابية تحتاج تشغيل المنصة عبر رابط http(s) وليس بالفتح المباشر للملف. ' +
             'ارفعيها على GitHub Pages أو شغّلي سيرفرًا محليًا.';
    }
    if (!URL_ || !KEY) {
      return 'لم تُضبط إعدادات Supabase بعد. افتحي assets/js/supabase-config.js ' +
             'وأضيفي Project URL و anon key من لوحة Supabase.';
    }
    if (!/^https?:\/\/[^\s]+$/i.test(URL_)) {
      return 'Project URL غير صالح. يجب أن يبدأ بـ https:// وينتهي بـ .supabase.co';
    }
    if (isSecretKey(KEY)) {
      return '⚠️ المفتاح الموضوع في الإعدادات مفتاح سري (service_role). ' +
             'أزيليه فورًا واستخدمي anon / publishable key فقط.';
    }
    return '';
  }

  function errText(e) {
    var raw = (e && (e.message || e.error_description || e.msg || e.hint)) || String(e || '');
    if (/relation .*does not exist|could not find the table|PGRST205|42P01|schema cache/i.test(raw)) {
      return 'جداول Supabase غير موجودة بعد. نفّذي ملف supabase/schema.sql في SQL Editor أولًا.';
    }
    if (/Invalid login credentials/i.test(raw)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    if (/Email not confirmed/i.test(raw)) return 'لم يتم تأكيد البريد بعد. افتحي رابط التأكيد المرسل إلى بريدك.';
    if (/User already registered|already been registered/i.test(raw)) return 'هذا البريد مسجّل مسبقًا. سجّلي الدخول.';
    if (/Password should be at least|password.*at least.*characters/i.test(raw)) return 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.';
    if (/For security purposes|rate limit|too many requests/i.test(raw)) return 'محاولات كثيرة خلال وقت قصير. انتظري قليلًا ثم أعيدي المحاولة.';
    if (/JWT expired|invalid JWT|token.*expired/i.test(raw)) return 'انتهت صلاحية الجلسة. سجّلي الدخول من جديد.';
    if (/row-level security|42501|permission denied/i.test(raw)) return 'ليس لديك صلاحية لهذا الإجراء. تأكدي من تسجيل الدخول.';
    if (/Failed to fetch|NetworkError|Load failed|fetch failed|ERR_NETWORK/i.test(raw)) return 'تعذّر الاتصال بالإنترنت أو بخادم Supabase.';
    if (/Invalid API key|No API key|apikey/i.test(raw)) return 'إعدادات Supabase غير صحيحة. تحققي من Project URL و anon key.';
    return raw || 'حدث خطأ غير متوقع.';
  }

  function waitForLib(ms) {
    return new Promise(function (resolve) {
      if (window.supabase && typeof window.supabase.createClient === 'function') return resolve(true);
      var start = Date.now();
      var injected = false;
      var iv = setInterval(function () {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          clearInterval(iv); resolve(true); return;
        }
        var t = Date.now() - start;
        /* إذا لم تصل المكتبة عبر وسم CDN في الصفحة، نحقنها من مصدر بديل */
        if (!injected && t > 1600) {
          injected = true;
          var s = document.createElement('script');
          s.src = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js';
          s.async = true;
          s.onerror = function () { /* سنكتفي بمهلة الانتظار */ };
          document.head.appendChild(s);
        }
        if (t > (ms || 9000)) { clearInterval(iv); resolve(false); }
      }, 130);
    });
  }

  /* ══════════════════════ نافذة الحساب ══════════════════════ */

  function buildAuthModal() {
    if (built) return;
    var wrap = document.createElement('div');
    wrap.className = 'modal authm';
    wrap.id = 'authModal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'authTitle');
    wrap.innerHTML = [
      '<div class="modal-box auth-box">',
        '<div class="modal-bar">',
          '<span class="name" id="authTitle">الحساب والملاحظات</span>',
          '<button type="button" id="authClose" aria-label="إغلاق">✕ إغلاق</button>',
        '</div>',

        '<div class="auth-body" id="authBody">',
          '<div class="auth-tabs" id="authTabs">',
            '<button type="button" data-tab="login" class="on">تسجيل الدخول</button>',
            '<button type="button" data-tab="signup">حساب جديد</button>',
          '</div>',
          '<form id="authForm" autocomplete="on" novalidate>',
            '<div class="fld" id="fldName" hidden>',
              '<label for="authName">الاسم <span>(اختياري)</span></label>',
              '<input id="authName" type="text" maxlength="120" autocomplete="name" placeholder="الاسم الكامل">',
            '</div>',
            '<div class="fld" id="fldEmail">',
              '<label for="authEmail">البريد الإلكتروني</label>',
              '<input id="authEmail" type="email" required autocomplete="email" dir="ltr" placeholder="name@example.com">',
            '</div>',
            '<div class="fld" id="fldPass">',
              '<label for="authPass">كلمة المرور</label>',
              '<input id="authPass" type="password" required minlength="6" autocomplete="current-password" dir="ltr" placeholder="٦ أحرف على الأقل">',
            '</div>',
            '<div class="fld" id="fldPass2" hidden>',
              '<label for="authPass2">تأكيد كلمة المرور</label>',
              '<input id="authPass2" type="password" minlength="6" autocomplete="new-password" dir="ltr">',
            '</div>',
            '<div class="auth-msg" id="authMsg" role="status" aria-live="polite"></div>',
            '<button class="btn btn-primary auth-sub" type="submit" id="authSubmit">دخول</button>',
          '</form>',
          '<div class="auth-links">',
            '<button type="button" id="authForgot">نسيتِ كلمة المرور؟</button>',
            '<button type="button" id="authToNotes">الذهاب إلى ملاحظاتي ←</button>',
          '</div>',
          '<p class="auth-sec">',
            '🔒 تُحفظ ملاحظاتك في قاعدة بيانات Supabase، ولا يراها إلا حسابك. ',
            'يُستخدم في المتصفح مفتاح anon العام فقط، والحماية مطبَّقة بسياسات RLS.',
          '</p>',
        '</div>',

        '<div class="auth-account" id="authAccount" hidden>',
          '<div class="acct-head">',
            '<div class="acct-avatar" id="acctAvatar">👤</div>',
            '<div class="acct-id">',
              '<b id="acctName">—</b>',
              '<div class="acct-mail" id="acctMail" dir="ltr"></div>',
            '</div>',
          '</div>',
          '<div class="acct-stats" id="acctStats"></div>',
          '<form id="passForm" autocomplete="off" hidden>',
            '<div class="fld"><label for="newPass">كلمة المرور الجديدة</label><input id="newPass" type="password" minlength="6" dir="ltr" autocomplete="new-password"></div>',
            '<div class="fld"><label for="newPass2">تأكيد كلمة المرور</label><input id="newPass2" type="password" minlength="6" dir="ltr" autocomplete="new-password"></div>',
            '<div class="auth-msg" id="passMsg" role="status" aria-live="polite"></div>',
            '<div class="acct-btns">',
              '<button class="btn btn-primary" type="submit" id="passSave">حفظ كلمة المرور</button>',
              '<button class="btn btn-ghost" type="button" id="passCancel">إلغاء</button>',
            '</div>',
          '</form>',
          '<div class="acct-btns" id="acctBtns">',
            '<button class="btn btn-primary" type="button" id="acctNotes">🗒️ ملاحظاتي</button>',
            '<button class="btn btn-ghost" type="button" id="acctPass">🔑 تغيير كلمة المرور</button>',
            '<button class="btn btn-ghost" type="button" id="acctRefresh">🔄 مزامنة</button>',
            '<button class="btn btn-red" type="button" id="acctOut">تسجيل الخروج</button>',
          '</div>',
          '<div class="auth-msg" id="acctMsg" role="status" aria-live="polite"></div>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    built = true;
    bindAuth();
  }

  function bindAuth() {
    var modal = $('#authModal');

    $('#authClose').addEventListener('click', closeAuth);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeAuth(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeAuth();
    });

    $$('#authTabs [data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        recovery = false;
        setMode(b.getAttribute('data-tab'));
      });
    });

    $('#authForm').addEventListener('submit', onAuthSubmit);
    $('#authForgot').addEventListener('click', function () {
      recovery = false;
      setMode('forgot');
    });
    $('#authToNotes').addEventListener('click', function () {
      closeAuth();
      var s = $('#notes');
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#acctOut').addEventListener('click', signOut);
    $('#acctPass').addEventListener('click', function () {
      $('#passForm').hidden = false;
      $('#acctBtns').hidden = true;
      clearMsg($('#passMsg'));
      var p = $('#newPass'); if (p) p.focus();
    });
    $('#passCancel').addEventListener('click', function () {
      $('#passForm').hidden = true;
      $('#acctBtns').hidden = false;
      $('#passForm').reset();
      clearMsg($('#passMsg'));
    });
    $('#passForm').addEventListener('submit', onChangePassword);
    $('#acctRefresh').addEventListener('click', function () {
      msg($('#acctMsg'), 'جارٍ المزامنة…', 'info');
      loadNotes(true).then(function () {
        msg($('#acctMsg'), '✓ تمت مزامنة الملاحظات.', 'ok');
      });
    });
    $('#acctNotes').addEventListener('click', function () {
      closeAuth();
      var s = $('#notes');
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function setMode(m) {
    mode = m;
    var isLogin = m === 'login';
    var isSignup = m === 'signup';
    var isForgot = m === 'forgot';
    var isRecovery = m === 'recovery';

    var tabs = $('#authTabs');
    if (tabs) tabs.hidden = isForgot || isRecovery;

    $$('#authTabs [data-tab]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === m);
    });

    $('#fldName').hidden = !isSignup;
    $('#fldEmail').hidden = isRecovery;
    $('#fldPass').hidden = isForgot;
    $('#fldPass2').hidden = !(isSignup || isRecovery);
    $('#authForgot').hidden = !isLogin;

    var sub = $('#authSubmit');
    sub.textContent = isLogin ? 'دخول'
                    : isSignup ? 'إنشاء الحساب'
                    : isForgot ? 'إرسال رابط الاستعادة'
                    : 'حفظ كلمة المرور';

    var pass = $('#authPass');
    pass.setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');

    var title = $('#authTitle');
    if (title) {
      title.textContent = isRecovery ? 'تعيين كلمة مرور جديدة'
                        : isForgot ? 'استعادة كلمة المرور'
                        : 'الحساب والملاحظات';
    }

    clearMsg($('#authMsg'));
    var focus = isSignup ? $('#authName') : (isRecovery ? $('#authPass') : $('#authEmail'));
    if (focus) setTimeout(function () { focus.focus(); }, 60);
  }

  function openAuth(m) {
    buildAuthModal();
    var modal = $('#authModal');
    if (!modal) return;
    modal.classList.add('open');
    document.body.classList.add('modal-open');

    if (user) {
      paintAccount();
      $('#authBody').hidden = true;
      $('#authAccount').hidden = false;
      $('#authTitle').textContent = 'حسابي';
    } else {
      $('#authBody').hidden = false;
      $('#authAccount').hidden = true;
      setMode(m || (recovery ? 'recovery' : 'login'));
    }
  }

  function closeAuth() {
    var modal = $('#authModal');
    if (modal) modal.classList.remove('open');
    document.body.classList.remove('modal-open');
    recovery = false;
    clearMsg($('#authMsg'));
  }

  /* ══════════════════════ المصادقة ══════════════════════ */

  async function onAuthSubmit(e) {
    e.preventDefault();
    var msgEl = $('#authMsg');
    clearMsg(msgEl);

    if (!sb) {
      msg($('#authMsg'), configError() || 'مكتبة Supabase لم تُحمَّل بعد. تحققي من الاتصال ثم أعيدي المحاولة.', 'err');
      return;
    }

    var email = val('#authEmail');
    var pass  = val('#authPass');
    var pass2 = val('#authPass2');
    var name  = val('#authName');
    var btn   = $('#authSubmit');
    var original = btn.textContent;

    if (mode === 'recovery') {
      if (pass.length < 6) return msg(msgEl, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.', 'warn');
      if (pass !== pass2) return msg(msgEl, 'كلمتا المرور غير متطابقتين.', 'warn');
      btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
      var rr = await sb.auth.updateUser({ password: pass });
      btn.disabled = false; btn.textContent = original;
      if (rr.error) return msg(msgEl, errText(rr.error), 'err');
      msg(msgEl, '✓ تم تعيين كلمة المرور. يمكنك الآن استخدام حسابك.', 'ok');
      recovery = false;
      setTimeout(function () { if (user) { paintAccount(); $('#authBody').hidden = true; $('#authAccount').hidden = false; } else setMode('login'); }, 900);
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return msg(msgEl, 'اكتبي بريدًا إلكترونيًا صحيحًا.', 'warn');
    }

    if (mode === 'forgot') {
      btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
      var fr = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
      });
      btn.disabled = false; btn.textContent = original;
      if (fr.error) return msg(msgEl, errText(fr.error), 'err');
      return msg(msgEl, '✓ أرسلنا رابط الاستعادة إلى بريدك. افتحي الرابط لتعيين كلمة مرور جديدة.', 'ok');
    }

    if (pass.length < 6) return msg(msgEl, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.', 'warn');

    if (mode === 'signup') {
      if (pass !== pass2) return msg(msgEl, 'كلمتا المرور غير متطابقتين.', 'warn');
      btn.disabled = true; btn.textContent = 'جارٍ إنشاء الحساب…';
      var ur = await sb.auth.signUp({
        email: email,
        password: pass,
        options: { data: name ? { full_name: name } : {} }
      });
      btn.disabled = false; btn.textContent = original;
      if (ur.error) return msg(msgEl, errText(ur.error), 'err');
      if (ur.data && ur.data.session) {
        toast('تم إنشاء الحساب وتسجيل الدخول ✓');
        closeAuth();
        return;
      }
      setMode('login');
      return msg($('#authMsg'), '✓ تم إنشاء الحساب. افتحي رابط التأكيد المرسل إلى بريدك ثم سجّلي الدخول.', 'ok');
    }

    btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
    var sr = await sb.auth.signInWithPassword({ email: email, password: pass });
    btn.disabled = false; btn.textContent = original;
    if (sr.error) return msg(msgEl, errText(sr.error), 'err');
    toast('مرحبًا بك ✓');
    closeAuth();
  }

  async function onChangePassword(e) {
    e.preventDefault();
    if (!sb || !user) return;
    var p1 = val('#newPass'), p2 = val('#newPass2');
    var m = $('#passMsg');
    clearMsg(m);
    if (p1.length < 6) return msg(m, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.', 'warn');
    if (p1 !== p2) return msg(m, 'كلمتا المرور غير متطابقتين.', 'warn');
    var b = $('#passSave');
    b.disabled = true; b.textContent = 'جارٍ الحفظ…';
    var r = await sb.auth.updateUser({ password: p1 });
    b.disabled = false; b.textContent = 'حفظ كلمة المرور';
    if (r.error) return msg(m, errText(r.error), 'err');
    msg(m, '✓ تم تغيير كلمة المرور بنجاح.', 'ok');
    $('#passForm').reset();
    setTimeout(function () {
      $('#passForm').hidden = true;
      $('#acctBtns').hidden = false;
      clearMsg($('#passMsg'));
    }, 1200);
  }

  async function signOut() {
    if (!sb) return;
    var r = await sb.auth.signOut();
    if (r && r.error) { toast('تعذّر تسجيل الخروج: ' + errText(r.error)); return; }
    toast('تم تسجيل الخروج');
    closeAuth();
    notes = []; profileName = ''; lastUserId = null;
    paintAll();
  }

  /* ══════════════════════ الملاحظات ══════════════════════ */

  function setNotesBusy(b) {
    saving = b;
    ['#noteSave', '#noteNew', '#noteRefresh', '#noteCancel'].forEach(function (s) {
      var n = $(s); if (n) n.disabled = b;
    });
  }

  async function loadNotes(silent) {
    if (!sb || !user) return;
    if (!navigator.onLine) {
      if (!silent) msg($('#noteMsg'), 'أنتِ غير متصلة بالإنترنت. الملاحظات السحابية تحتاج اتصالًا.', 'warn');
      return;
    }
    loading = true;
    renderNotes();
    var r = await sb.from(TABLE)
      .select('id,title,body,pinned,created_at,updated_at')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    loading = false;

    if (r.error) {
      notes = [];
      renderNotes();
      msg($('#noteMsg'), errText(r.error), 'err');
      return;
    }
    notes = Array.isArray(r.data) ? r.data : [];
    renderNotes();
    if (!silent) {
      msg($('#noteMsg'), notes.length ? '' : '', 'info');
    }
  }

  function renderNotes() {
    var list = $('#noteList');
    if (!list) return;

    var count = $('#notesCount');
    if (count) count.textContent = String(notes.length);

    var q = val('#noteSearch').toLowerCase();
    var arr = notes.filter(function (n) {
      if (!q) return true;
      return ((n.title || '') + ' ' + (n.body || '')).toLowerCase().indexOf(q) > -1;
    });

    list.innerHTML = '';

    if (loading) {
      list.appendChild(el('div', 'notes-empty', 'جارٍ تحميل الملاحظات…'));
      return;
    }
    if (!notes.length) {
      list.appendChild(el('div', 'notes-empty', 'لا توجد ملاحظات بعد — ابدئي بإضافة أول ملاحظة.'));
      return;
    }
    if (!arr.length) {
      list.appendChild(el('div', 'notes-empty', 'لا نتائج مطابقة لبحثك.'));
      return;
    }
    arr.forEach(function (n) { list.appendChild(noteCard(n)); });
  }

  function noteCard(n) {
    var card = el('article', 'note-card' + (n.pinned ? ' pinned' : ''));

    var h = el('h4');
    if (n.pinned) h.appendChild(el('span', 'pin', '📌'));
    h.appendChild(document.createTextNode(n.title || 'ملاحظة'));
    card.appendChild(h);

    var body = el('p', 'note-body');
    body.textContent = n.body || '';
    card.appendChild(body);

    if ((n.body || '').length > 240) {
      var more = el('button', 'note-more', 'عرض المزيد');
      more.type = 'button';
      more.addEventListener('click', function () {
        body.classList.toggle('open');
        more.textContent = body.classList.contains('open') ? 'عرض أقل' : 'عرض المزيد';
      });
      card.appendChild(more);
    }

    card.appendChild(el('div', 'note-meta', 'آخر تحديث: ' + fmtDate(n.updated_at)));
    if (n.pinned) card.appendChild(el('div', 'note-meta', 'مثبّتة في الأعلى'));

    var acts = el('div', 'note-acts');
    acts.appendChild(actBtn(n.pinned ? '📌 إلغاء التثبيت' : '📌 تثبيت', function () { togglePin(n); }));
    acts.appendChild(actBtn('✏️ تعديل', function () { startEdit(n); }));
    acts.appendChild(actBtn('🗑️ حذف', function () { removeNote(n); }, 'del'));
    card.appendChild(acts);

    return card;
  }

  function actBtn(label, fn, kind) {
    var b = el('button', 'note-act' + (kind ? ' ' + kind : ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  function showForm(show) {
    var f = $('#noteForm');
    if (!f) return;
    f.hidden = !show;
    if (show) {
      var box = $('#notes');
      if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () { var t = $('#noteTitle'); if (t) t.focus(); }, 250);
    }
  }

  function resetForm() {
    editingId = null;
    var f = $('#noteForm');
    if (f) f.reset();
    var save = $('#noteSave');
    if (save) save.textContent = 'حفظ الملاحظة';
    var cancel = $('#noteCancel');
    if (cancel) cancel.hidden = true;
    var chars = $('#noteChars');
    if (chars) chars.textContent = '0 / ' + MAX_BODY;
    showForm(false);
    clearMsg($('#noteMsg'));
  }

  function startEdit(n) {
    editingId = n.id;
    $('#noteTitle').value = n.title || '';
    $('#noteBody').value = n.body || '';
    $('#noteId').value = n.id;
    var save = $('#noteSave');
    if (save) save.textContent = 'تحديث الملاحظة';
    var cancel = $('#noteCancel');
    if (cancel) cancel.hidden = false;
    var chars = $('#noteChars');
    if (chars) chars.textContent = (n.body || '').length + ' / ' + MAX_BODY;
    showForm(true);
  }

  async function saveNote(e) {
    if (e) e.preventDefault();
    if (!sb || !user) { openAuth('login'); return; }
    if (saving) return;

    var title = val('#noteTitle') || 'ملاحظة';
    var body  = val('#noteBody');

    if (!body) {
      msg($('#noteMsg'), 'اكتبي نص الملاحظة أولًا.', 'warn');
      var b = $('#noteBody'); if (b) b.focus();
      return;
    }
    if (body.length > MAX_BODY) {
      msg($('#noteMsg'), 'النص أطول من الحد المسموح (' + MAX_BODY + ' حرف).', 'warn');
      return;
    }

    var wasEdit = !!editingId;
    var id = editingId;

    setNotesBusy(true);
    msg($('#noteMsg'), wasEdit ? 'جارٍ تحديث الملاحظة…' : 'جارٍ حفظ الملاحظة…', 'info');

    var r;
    if (wasEdit) {
      r = await sb.from(TABLE)
        .update({ title: title.slice(0, MAX_TITLE), body: body })
        .eq('id', id)
        .select('id');
    } else {
      r = await sb.from(TABLE)
        .insert({ title: title.slice(0, MAX_TITLE), body: body })
        .select('id');
    }

    setNotesBusy(false);

    if (r.error) return msg($('#noteMsg'), errText(r.error), 'err');

    if (!r.data || !r.data.length) {
      if (wasEdit) {
        return msg($('#noteMsg'), 'لم يتم تحديث الملاحظة. تأكدي أنها ما زالت موجودة وأنك مسجّلة الدخول.', 'err');
      }
      return msg($('#noteMsg'), 'لم تُحفظ الملاحظة — تحققي من سياسات RLS أو من تسجيل الدخول.', 'err');
    }

    resetForm();
    await loadNotes(true);
    msg($('#noteMsg'), wasEdit ? '✓ تم تحديث الملاحظة.' : '✓ تم حفظ الملاحظة في حسابك.', 'ok');
  }

  async function removeNote(n) {
    if (!sb || !user) return;
    if (!confirm('حذف الملاحظة «' + (n.title || 'ملاحظة') + '» نهائيًا؟')) return;
    setNotesBusy(true);
    msg($('#noteMsg'), 'جارٍ حذف الملاحظة…', 'info');
    var r = await sb.from(TABLE).delete().eq('id', n.id);
    setNotesBusy(false);
    if (r.error) return msg($('#noteMsg'), errText(r.error), 'err');
    if (editingId === n.id) resetForm();
    await loadNotes(true);
    msg($('#noteMsg'), '✓ حُذفت الملاحظة.', 'ok');
  }

  async function togglePin(n) {
    if (!sb || !user) return;
    var next = !n.pinned;
    setNotesBusy(true);
    var r = await sb.from(TABLE).update({ pinned: next }).eq('id', n.id).select('id');
    setNotesBusy(false);
    if (r.error) return msg($('#noteMsg'), errText(r.error), 'err');
    await loadNotes(true);
    msg($('#noteMsg'), next ? '✓ ثُبّتت الملاحظة في الأعلى.' : '✓ أُلغي تثبيت الملاحظة.', 'ok');
  }

  /* ══════════════════════ الرسم والحالة ══════════════════════ */

  function displayName() {
    if (!user) return '';
    return profileName ||
           (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
           (user.email ? user.email.split('@')[0] : 'حسابي');
  }

  function paintHeader() {
    var b = $('#authBtn');
    if (!b) return;
    if (configError()) { b.hidden = true; return; }
    b.hidden = false;
    b.classList.toggle('on', !!user);
    var who = b.querySelector('.who');
    if (who) who.textContent = user ? displayName() : 'دخول';
    b.title = user ? (user.email || 'حسابي') : 'تسجيل الدخول / إنشاء حساب';
  }

  function paintAccount() {
    if (!user) return;
    var n = $('#acctName'), m = $('#acctMail'), a = $('#acctAvatar'), s = $('#acctStats');
    if (n) n.textContent = displayName();
    if (m) m.textContent = user.email || '';
    if (a) a.textContent = (displayName() || '👤').trim().charAt(0).toUpperCase() || '👤';
    if (s) {
      s.innerHTML = '';
      s.appendChild(el('span', 'acct-chip', '🗒️ ' + notes.length + ' ملاحظة'));
      if (user.created_at) s.appendChild(el('span', 'acct-chip', '📅 ' + fmtDate(user.created_at)));
    }
  }

  function paintNotes() {
    var cfg = configError();

    /* رابط «ملاحظاتي» يظهر فقط عند تفعيل الميزة — في الصفحتين */
    var navLink = $('#navNotes');
    if (navLink) navLink.hidden = !!cfg;

    var gate = $('#notesGate'), app = $('#notesApp');
    if (!gate || !app) return;

    var title = $('#notesGateTitle');
    var text = $('#notesGateText');
    var btn = $('#notesGateBtn');
    var hint = $('#notesGateHint');

    if (cfg) {
      /* لا نعرض ميزة معطّلة للزوار — تظهر تلقائيًا بعد ضبط الإعدادات */
      var sec = $('#notes');
      if (sec) sec.hidden = true;
      gate.hidden = false;
      app.hidden = true;
      if (btn) btn.hidden = true;
      if (hint) hint.hidden = true;
      return;
    }

    var section = $('#notes');
    if (section) section.hidden = false;
    if (hint) hint.hidden = false;
    if (btn) btn.hidden = false;

    if (!user) {
      gate.hidden = false;
      app.hidden = true;
      if (title) title.textContent = 'سجّلي الدخول لحفظ ملاحظاتك';
      if (text) text.textContent = 'ملاحظاتك تُحفظ في حسابك الخاص على قاعدة بيانات Supabase، وتظهر لك على أي جهاز. لا يراها أي مستخدم آخر.';
      if (btn) btn.textContent = '👤 تسجيل الدخول / إنشاء حساب';
      if (hint) hint.textContent = 'المنصة تعمل كاملة دون حساب — الحساب مطلوب فقط لحفظ الملاحظات ومزامنتها.';
      return;
    }

    gate.hidden = true;
    app.hidden = false;
    renderNotes();
  }

  function paintAll() {
    buildAuthModal();
    paintHeader();
    paintAccount();
    paintNotes();
  }

  /* ══════════════════════ الإقلاع ══════════════════════ */

  function bindNotesUI() {
    var form = $('#noteForm');
    if (!form) return;

    form.addEventListener('submit', saveNote);

    $('#noteNew').addEventListener('click', function () {
      resetForm();
      showForm(true);
    });
    $('#noteCancel').addEventListener('click', resetForm);
    $('#noteRefresh').addEventListener('click', function () { loadNotes(); });
    $('#noteSearch').addEventListener('input', renderNotes);
    $('#noteBody').addEventListener('input', function () {
      var c = $('#noteChars');
      if (c) c.textContent = ($('#noteBody').value || '').length + ' / ' + MAX_BODY;
    });

    var gateBtn = $('#notesGateBtn');
    if (gateBtn) gateBtn.addEventListener('click', function () { openAuth('login'); });

    window.addEventListener('online', function () {
      if (sb && user) { msg($('#noteMsg'), 'عاد الاتصال — جارٍ المزامنة…', 'info'); loadNotes(true); }
    });
    window.addEventListener('offline', function () {
      if (user) msg($('#noteMsg'), 'أنتِ غير متصلة بالإنترنت. الملاحظات السحابية تحتاج اتصالًا.', 'warn');
    });
  }

  async function loadProfile() {
    if (!sb || !user) return;
    try {
      var r = await sb.from(PROFILE).select('full_name').eq('id', user.id).maybeSingle();
      if (r && r.data && r.data.full_name) {
        profileName = r.data.full_name;
      } else {
        var nm = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
        if (nm) {
          profileName = nm;
          await sb.from(PROFILE).upsert({ id: user.id, full_name: nm }, { onConflict: 'id' });
        }
      }
    } catch (e) { /* الملف الشخصي اختياري — لا نعطّل الملاحظات بسببه */ }
    paintHeader();
    paintAccount();
  }

  function onAuthEvent(ev, session) {
    if (ev === 'PASSWORD_RECOVERY') {
      recovery = true;
      openAuth('recovery');
      return;
    }

    var u = (session && session.user) ? session.user : null;
    var changed = (u ? u.id : null) !== lastUserId;
    user = u;
    lastUserId = u ? u.id : null;

    if (!u) {
      notes = [];
      profileName = '';
      editingId = null;
      resetForm();
    }

    paintAll();

    if (u && changed) {
      loadProfile();
      loadNotes();
    }
  }

  async function boot() {
    if (booted) return;
    booted = true;

    buildAuthModal();
    bindNotesUI();
    paintAll();

    var authBtn = $('#authBtn');
    if (authBtn) {
      authBtn.addEventListener('click', function () { openAuth(); });
    }

    var cfg = configError();
    if (cfg) {
      if (cfg.indexOf('service_role') > -1) console.error('[cloud] ' + cfg);
      return;
    }

    var ok = await waitForLib(9000);
    if (!ok) {
      var t = $('#notesGateTitle'), x = $('#notesGateText'), b = $('#notesGateBtn');
      if (t) t.textContent = 'تعذّر تحميل خدمة الملاحظات';
      if (x) {
        x.textContent = 'تحتاج الملاحظات السحابية اتصالًا بالإنترنت لتحميل مكتبة Supabase. ' +
                        'يمكنك متابعة استخدام المنصة كاملة، ثم إعادة المحاولة بعد عودة الاتصال.';
      }
      if (b) b.hidden = true;
      return;
    }

    try {
      sb = window.supabase.createClient(URL_, KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (e) {
      msg($('#noteMsg'), 'تعذّر تهيئة Supabase: ' + errText(e), 'err');
      return;
    }

    var cur = await sb.auth.getSession();
    if (cur && cur.data && cur.data.session) {
      user = cur.data.session.user;
      lastUserId = user.id;
    }
    paintAll();
    if (user) { loadProfile(); loadNotes(); }

    sb.auth.onAuthStateChange(function (ev, session) {
      setTimeout(function () { onAuthEvent(ev, session); }, 0);
    });
  }

  /* واجهة برمجية بسيطة للاستخدام من الصفحة أو للتشخيص */
  window.BRPCloud = {
    openAuth: function () { openAuth(); },
    closeAuth: closeAuth,
    signOut: signOut,
    refresh: function () { return loadNotes(); },
    get user() { return user; },
    get notes() { return notes.slice(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

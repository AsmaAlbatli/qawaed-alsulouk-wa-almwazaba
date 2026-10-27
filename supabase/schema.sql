-- ============================================================================
-- منصة قواعد السلوك والمواظبة — مخطط Supabase الكامل
-- ----------------------------------------------------------------------------
-- طريقة التنفيذ:
--   1) افتحي مشروعك في https://supabase.com/dashboard
--   2) من القائمة الجانبية: SQL Editor ← New query
--   3) الصقي هذا الملف كاملًا ثم اضغطي Run
--
-- ملاحظات أمنية:
--   • المتصفح يستخدم anon / publishable key فقط.
--   • لا تضعي service_role أو sb_secret_... في أي ملف يُرفع للموقع.
--   • الحماية الفعلية لهذه البيانات تأتي من سياسات RLS أدناه:
--     كل مستخدم يرى ويعدّل صفوفه فقط، ولا يستطيع قراءة ملاحظات غيره.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1) جدول الملفات الشخصية (اسم المستخدم المعروض)
-- ============================================================================
create table if not exists public.brp_profiles (
  id          uuid primary key
              references auth.users(id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint brp_profiles_name_len
    check (full_name is null or char_length(full_name) <= 120)
);

comment on table public.brp_profiles is
  'الاسم المعروض لكل مستخدم. صف واحد لكل مستخدم، ومحمي بـ RLS.';

-- ============================================================================
-- 2) جدول الملاحظات — ملاحظات شخصية لكل مستخدم
-- ============================================================================
create table if not exists public.brp_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users(id) on delete cascade,
  title       text not null default 'ملاحظة',
  body        text not null,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint brp_notes_title_len
    check (char_length(title) between 0 and 120),
  constraint brp_notes_body_len
    check (char_length(body) between 1 and 5000)
);

comment on table public.brp_notes is
  'ملاحظات المستخدم الشخصية على المنصة. كل صف مرتبط بمستخدم واحد.';
comment on column public.brp_notes.user_id is
  'معرّف المستخدم من Supabase Auth؛ لا يمكن الوصول لصف مستخدم آخر بفضل RLS.';

-- فهارس تسريع الجلب والترتيب
create index if not exists brp_notes_user_order_idx
  on public.brp_notes (user_id, pinned desc, updated_at desc);

create index if not exists brp_notes_user_created_idx
  on public.brp_notes (user_id, created_at desc);

-- ============================================================================
-- 3) تحديث updated_at تلقائيًا عند أي تعديل
-- ============================================================================
create or replace function public.brp_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists brp_profiles_touch_updated_at on public.brp_profiles;
create trigger brp_profiles_touch_updated_at
  before update on public.brp_profiles
  for each row execute function public.brp_touch_updated_at();

drop trigger if exists brp_notes_touch_updated_at on public.brp_notes;
create trigger brp_notes_touch_updated_at
  before update on public.brp_notes
  for each row execute function public.brp_touch_updated_at();

-- ============================================================================
-- 4) إنشاء ملف شخصي تلقائيًا عند تسجيل مستخدم جديد
--    (لو رفض مشروعك إنشاء trigger على auth.users، تجاهلي هذا القسم؛
--     التطبيق ينشئ الملف الشخصي تلقائيًا عند أول تسجيل دخول)
-- ============================================================================
create or replace function public.brp_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.brp_profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists brp_on_auth_user_created on auth.users;
create trigger brp_on_auth_user_created
  after insert on auth.users
  for each row execute function public.brp_handle_new_user();

-- ============================================================================
-- 5) تفعيل الحماية على مستوى الصفوف (RLS)
-- ============================================================================
alter table public.brp_profiles enable row level security;
alter table public.brp_notes    enable row level security;

-- ============================================================================
-- 6) سياسات الملفات الشخصية: صف المستخدم فقط
-- ============================================================================
drop policy if exists "brp_profiles_select_own" on public.brp_profiles;
create policy "brp_profiles_select_own"
  on public.brp_profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "brp_profiles_insert_own" on public.brp_profiles;
create policy "brp_profiles_insert_own"
  on public.brp_profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "brp_profiles_update_own" on public.brp_profiles;
create policy "brp_profiles_update_own"
  on public.brp_profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "brp_profiles_delete_own" on public.brp_profiles;
create policy "brp_profiles_delete_own"
  on public.brp_profiles for delete
  to authenticated
  using ((select auth.uid()) = id);

-- ============================================================================
-- 7) سياسات الملاحظات: جلب / إضافة / تعديل / حذف — لصاحب الملاحظة فقط
-- ============================================================================
drop policy if exists "brp_notes_select_own" on public.brp_notes;
create policy "brp_notes_select_own"
  on public.brp_notes for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "brp_notes_insert_own" on public.brp_notes;
create policy "brp_notes_insert_own"
  on public.brp_notes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "brp_notes_update_own" on public.brp_notes;
create policy "brp_notes_update_own"
  on public.brp_notes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "brp_notes_delete_own" on public.brp_notes;
create policy "brp_notes_delete_own"
  on public.brp_notes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================================
-- 8) الصلاحيات: الزائر (anon) ممنوع تمامًا، والمستخدم المسجّل فقط
-- ============================================================================
revoke all on table public.brp_profiles from public;
revoke all on table public.brp_profiles from anon;
revoke all on table public.brp_notes    from public;
revoke all on table public.brp_notes    from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.brp_profiles to authenticated;
grant select, insert, update, delete on table public.brp_notes    to authenticated;

-- إعادة تحميل مخطط PostgREST ليظهر الجدولان فورًا
notify pgrst, 'reload schema';

-- ============================================================================
-- 9) تحقق سريع (اختياري) — بعد تسجيل الدخول من المنصة
-- ----------------------------------------------------------------------------
-- select * from public.brp_notes order by updated_at desc;
-- insert into public.brp_notes (title, body) values ('اختبار', 'ملاحظة تجريبية');
-- update public.brp_notes set body = 'تعديل' where id = '<NOTE_ID>';
-- delete from public.brp_notes where id = '<NOTE_ID>';
--
-- محاولة قراءة ملاحظات مستخدم آخر يجب أن تعيد صفرًا:
-- select * from public.brp_notes where user_id <> auth.uid();
-- ============================================================================

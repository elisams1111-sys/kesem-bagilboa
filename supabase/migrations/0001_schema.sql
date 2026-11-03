-- =====================================================================
-- «קסם בגלבוע»: סכמת מסד הנתונים, הרשאות (RLS), טריגרים ופונקציות
-- להרצה פעם אחת ב-Supabase: SQL Editor → להדביק → Run.
-- פירוט הישויות והקשרים: docs/spec.md §4. פירוט ההרשאות: §5.
-- =====================================================================

-- ---------- סוגים (enums) ----------
create type public.user_role   as enum ('client', 'sales', 'event_manager', 'chef', 'admin');
create type public.event_type  as enum ('wedding', 'bar_mitzvah', 'bat_mitzvah', 'brit', 'birthday', 'business', 'other');
create type public.time_slot   as enum ('morning', 'evening');
create type public.event_status as enum ('booked', 'tasting_scheduled', 'menu_final', 'completed', 'cancelled');
create type public.course      as enum ('reception', 'first', 'intermediate', 'main', 'dessert');
create type public.menu_diet   as enum ('regular', 'celiac');
create type public.guest_group as enum ('regular', 'celiac', 'vegan');

-- ---------- טבלאות ----------

-- פרופיל לכל משתמש. נוצר אוטומטית בהרשמה (טריגר handle_new_user למטה)
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  role       public.user_role not null default 'client',
  phones     text[] not null default '{}' check (cardinality(phones) <= 3),
  emails     text[] not null default '{}' check (cardinality(emails) <= 3),
  address    text,
  created_at timestamptz not null default now()
);

-- תיק האירוע: מקור האמת היחיד לכל פרטי האירוע
create table public.events (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.profiles (id) on delete cascade,
  sales_rep_id         uuid references public.profiles (id) on delete set null,
  title                text not null default '',
  event_type           public.event_type not null,
  event_type_other     text,
  event_date           date not null,
  time_slot            public.time_slot not null,
  guest_count          int not null check (guest_count between 1 and 500),
  vegan_count          int not null default 0 check (vegan_count >= 0),
  celiac_count         int not null default 0 check (celiac_count >= 0),
  table_design         text,
  chuppah_song_url     text,
  slideshow_time       text,
  slideshow_folder_url text,
  special_requests     text,
  payment_method       text,              -- אמצעי תשלום בלבד. לעולם לא מספר כרטיס
  deposit_confirmed    boolean not null default false,
  status               public.event_status not null default 'booked',
  -- מי ביצע את העדכון האחרון: 'app' (טופס) או 'agent' (סוכן AI). הטריגר מעתיק את זה ליומן השינויים
  last_change_source   text not null default 'app' check (last_change_source in ('app', 'agent', 'system')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint diet_counts_fit check (vegan_count + celiac_count <= guest_count),
  constraint other_needs_text check (event_type <> 'other' or coalesce(event_type_other, '') <> '')
);

-- אי אפשר להזמין פעמיים את אותה משבצת (תאריך + בוקר/ערב), כל עוד האירוע לא בוטל
create unique index events_one_per_slot on public.events (event_date, time_slot) where status <> 'cancelled';
create index events_client_idx on public.events (client_id);
create index events_date_idx on public.events (event_date);

-- מנות. נטענות מתיקיית «תפריטים» במיגרציה 0002
create table public.menu_items (
  id          int primary key,
  course      public.course not null,
  diet        public.menu_diet not null,
  option_no   int not null,
  title       text not null,
  description text not null default '',
  is_vegan    boolean not null default false,
  -- גרמים לסועד, לפי סוג חומר גלם. מזה השף מקבל חישוב הזמנה
  beef_g      int not null default 0,
  poultry_g   int not null default 0,
  fish_g      int not null default 0,
  veg_g       int not null default 0,
  unique (course, diet, option_no)
);

-- הבחירה של אירוע: אפשרות אחת לכל שלב בתפריט ולכל קבוצת סועדים (N:M בין אירועים למנות)
create table public.event_menu_selections (
  event_id     uuid not null references public.events (id) on delete cascade,
  course       public.course not null,
  guest_group  public.guest_group not null,
  menu_item_id int not null references public.menu_items (id),
  primary key (event_id, course, guest_group)
);

-- שעות טעימה. event_id ריק = השעה פנויה
create table public.tasting_slots (
  id         bigint generated always as identity primary key,
  starts_at  timestamptz not null unique,
  event_id   uuid unique references public.events (id) on delete set null,
  created_at timestamptz not null default now()
);

-- יומן שינויים: כל שינוי בתיק אירוע, ובקשות שדורשות טיפול של מנהלת האירועים
create table public.change_log (
  id              bigint generated always as identity primary key,
  event_id        uuid not null references public.events (id) on delete cascade,
  changed_by      uuid references public.profiles (id) on delete set null,
  source          text not null default 'app' check (source in ('app', 'agent', 'system')),
  field           text,
  old_value       text,
  new_value       text,
  summary         text not null,
  needs_attention boolean not null default false,
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index change_log_event_idx on public.change_log (event_id, created_at desc);
create index change_log_open_idx on public.change_log (needs_attention) where resolved_at is null;

-- דואר יוצא. נכתב רק מהשרת עם המפתח הסודי
create table public.notifications (
  id              bigint generated always as identity primary key,
  event_id        uuid references public.events (id) on delete set null,
  kind            text not null,
  recipient_email text not null,
  subject         text not null,
  body            text not null,
  status          text not null default 'logged' check (status in ('sent', 'logged', 'failed')),
  error           text,
  dedupe_key      text unique,  -- מונע כפילות של התראה מתוזמנת (למשל «5 ימים לפני» לאותו אירוע)
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index notifications_created_idx on public.notifications (created_at desc);

-- היסטוריית השיחה עם עוזר האירוע (סוכן AI)
create table public.agent_messages (
  id         bigint generated always as identity primary key,
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index agent_messages_event_idx on public.agent_messages (event_id, created_at);

-- ---------- פונקציות עזר להרשאות ----------

-- התפקיד של המשתמש המחובר. security definer כדי לקרוא את profiles בלי להיתקע ב-RLS של עצמה
create or replace function public.app_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.app_role() in ('sales', 'event_manager', 'chef', 'admin'), false) $$;

-- צוות שמותר לו לערוך אירועים (השף קורא בלבד)
create or replace function public.can_edit_events()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.app_role() in ('sales', 'event_manager', 'admin'), false) $$;

-- שם ידידותי בעברית לשדה, לשימוש ביומן השינויים
create or replace function public.field_label(k text)
returns text language sql immutable as $$
  select case k
    when 'title' then 'שם האירוע'
    when 'event_type' then 'סוג האירוע'
    when 'event_type_other' then 'תיאור האירוע'
    when 'event_date' then 'תאריך'
    when 'time_slot' then 'בוקר/ערב'
    when 'guest_count' then 'מספר מוזמנים'
    when 'vegan_count' then 'טבעונים/צמחונים'
    when 'celiac_count' then 'ללא גלוטן'
    when 'table_design' then 'עיצוב שולחנות'
    when 'chuppah_song_url' then 'שיר כניסה לחופה'
    when 'slideshow_time' then 'שעת המצגת'
    when 'slideshow_folder_url' then 'תיקיית המצגת'
    when 'special_requests' then 'בקשות מיוחדות'
    when 'payment_method' then 'אמצעי תשלום'
    when 'deposit_confirmed' then 'אישור מקדמה'
    when 'status' then 'סטטוס'
    when 'sales_rep_id' then 'איש מכירות'
    else k end
$$;

-- שם בעברית לשלב בתפריט ולקבוצת סועדים, ליומן השינויים
create or replace function public.course_label(c text)
returns text language sql immutable as $$
  select case c when 'reception' then 'קבלת פנים' when 'first' then 'מנה ראשונה'
    when 'intermediate' then 'מנת ביניים' when 'main' then 'מנה עיקרית' when 'dessert' then 'קינוחים'
    when 'regular' then 'רגיל' when 'celiac' then 'ללא גלוטן' when 'vegan' then 'טבעוני' else c end
$$;

-- ---------- טריגרים ----------

-- הרשמה חדשה → שורה ב-profiles. הטלפונים והשם מגיעים מ-metadata של ההרשמה
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phones, emails)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'phones')), '{}'),
    array[new.email]
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- רק מנהל כללי משנה תפקיד. (auth.uid() ריק = המפתח הסודי בשרת, למשל סקריפט נתוני הדמו)
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null
     and coalesce(public.app_role()::text, '') <> 'admin' then
    raise exception 'רק מנהל כללי יכול לשנות תפקיד';
  end if;
  return new;
end $$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- חוקים ללקוח שמעדכן את האירוע של עצמו:
-- 1. לא משנה סטטוס, בעלות, איש מכירות, מקדמה, תאריך או משבצת (אלה דרך הצוות)
-- 2. פחות מ-5 ימים לפני האירוע לא משנה מספרי סועדים, כי השף כבר הזמין חומרי גלם
-- פונקציות של המערכת (book_tasting) מדלגות על הבדיקה דרך app.bypass_guard
create or replace function public.guard_event_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  if coalesce(current_setting('app.bypass_guard', true), '') = 'on' or auth.uid() is null then
    return new;
  end if;
  if public.app_role() = 'client' then
    if new.status is distinct from old.status
       or new.client_id is distinct from old.client_id
       or new.sales_rep_id is distinct from old.sales_rep_id
       or new.deposit_confirmed is distinct from old.deposit_confirmed
       or new.event_date is distinct from old.event_date
       or new.time_slot is distinct from old.time_slot then
      raise exception 'שינוי תאריך, סטטוס או תשלום נעשה דרך מנהלת האירוע';
    end if;
    if old.event_date - current_date < 5 and (
         new.guest_count is distinct from old.guest_count
      or new.vegan_count is distinct from old.vegan_count
      or new.celiac_count is distinct from old.celiac_count) then
      raise exception 'פחות מ-5 ימים לפני האירוע, שינוי במספר הסועדים דורש אישור של מנהלת האירוע';
    end if;
  end if;
  return new;
end $$;

create trigger events_guard
  before update on public.events
  for each row execute function public.guard_event_update();

-- יומן שינויים: לכל עמודה שהשתנתה נרשמת שורה עם הערך הישן והחדש
create or replace function public.log_event_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  k text;
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(n) loop
    continue when k in ('updated_at', 'created_at', 'last_change_source');
    if (o -> k) is distinct from (n -> k) then
      insert into public.change_log (event_id, changed_by, source, field, old_value, new_value, summary)
      values (new.id, auth.uid(), new.last_change_source, k, o ->> k, n ->> k,
              public.field_label(k) || ': «' || coalesce(o ->> k, '—') || '» ← «' || coalesce(n ->> k, '—') || '»');
    end if;
  end loop;
  return new;
end $$;

create trigger events_log_changes
  after update on public.events
  for each row execute function public.log_event_changes();

create or replace function public.log_event_created()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.change_log (event_id, changed_by, source, summary)
  values (new.id, auth.uid(), 'system', 'האירוע נפתח: ' || new.event_date || ', ' || new.guest_count || ' מוזמנים');
  return new;
end $$;

create trigger events_log_created
  after insert on public.events
  for each row execute function public.log_event_created();

-- יומן שינויים לתפריט. בדקות הראשונות אחרי פתיחת האירוע (האשף שומר את כל הבחירות) לא נרשם, כדי לא להציף
create or replace function public.log_menu_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  ev record;
  old_title text;
  new_title text;
  ev_id uuid := coalesce(new.event_id, old.event_id);
begin
  select id, created_at, event_date, last_change_source into ev from public.events where id = ev_id;
  if ev.id is null or now() - ev.created_at < interval '3 minutes' then
    return coalesce(new, old);
  end if;
  -- גם בתפריט: פחות מ-5 ימים לפני האירוע לקוח לא משנה לבד
  if public.app_role() = 'client' and ev.event_date - current_date < 5 then
    raise exception 'פחות מ-5 ימים לפני האירוע, שינוי בתפריט דורש אישור של מנהלת האירוע';
  end if;
  if tg_op <> 'INSERT' then select title into old_title from public.menu_items where id = old.menu_item_id; end if;
  if tg_op <> 'DELETE' then select title into new_title from public.menu_items where id = new.menu_item_id; end if;
  if old_title is distinct from new_title then
    insert into public.change_log (event_id, changed_by, source, field, old_value, new_value, summary)
    values (ev_id, auth.uid(), ev.last_change_source,
            'menu:' || coalesce(new.course, old.course) || ':' || coalesce(new.guest_group, old.guest_group),
            old_title, new_title,
            'תפריט (' || public.course_label(coalesce(new.course, old.course)::text) || ', '
              || public.course_label(coalesce(new.guest_group, old.guest_group)::text) || '): «'
              || coalesce(old_title, '—') || '» ← «' || coalesce(new_title, '—') || '»');
  end if;
  return coalesce(new, old);
end $$;

create trigger menu_log_changes
  after insert or update or delete on public.event_menu_selections
  for each row execute function public.log_menu_changes();

-- ---------- פונקציות שהאפליקציה קוראת להן (RPC) ----------

-- משבצות תפוסות בטווח תאריכים. מחזיר רק תאריך ומשבצת, בלי פרטי לקוחות
create or replace function public.booked_slots(from_date date, to_date date)
returns table (event_date date, time_slot public.time_slot)
language sql stable security definer set search_path = public
as $$
  select e.event_date, e.time_slot from public.events e
  where e.status <> 'cancelled' and e.event_date between from_date and to_date
$$;

-- קביעת טעימה. משחררת טעימה קודמת של אותו אירוע, ותופסת שעה רק אם היא עדיין פנויה
create or replace function public.book_tasting(p_slot bigint, p_event uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare ev record;
begin
  select * into ev from public.events where id = p_event;
  if ev.id is null then raise exception 'האירוע לא נמצא'; end if;
  if ev.client_id <> auth.uid() and not public.is_staff() then raise exception 'אין הרשאה לאירוע הזה'; end if;

  update public.tasting_slots set event_id = null where event_id = p_event;
  update public.tasting_slots set event_id = p_event
    where id = p_slot and event_id is null and starts_at > now();
  if not found then raise exception 'שעת הטעימה כבר נתפסה, נא לבחור שעה אחרת'; end if;

  if ev.status = 'booked' then
    perform set_config('app.bypass_guard', 'on', true);
    update public.events set status = 'tasting_scheduled', last_change_source = 'system' where id = p_event;
    perform set_config('app.bypass_guard', 'off', true);
  end if;
end $$;

grant execute on function public.booked_slots(date, date) to anon, authenticated;
grant execute on function public.book_tasting(bigint, uuid) to authenticated;

-- ---------- הרשאות לטבלאות ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.menu_items to anon;
grant all on all tables in schema public to service_role;

alter table public.profiles              enable row level security;
alter table public.events                enable row level security;
alter table public.menu_items            enable row level security;
alter table public.event_menu_selections enable row level security;
alter table public.tasting_slots         enable row level security;
alter table public.change_log            enable row level security;
alter table public.notifications         enable row level security;
alter table public.agent_messages        enable row level security;

-- profiles: כל אחד רואה את עצמו, הצוות רואה את כולם. עדכון: עצמו או מנהל כללי
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.app_role() = 'admin');

-- events: לקוח רואה ועורך רק את שלו. צוות רואה הכל. השף קורא בלבד. מחיקה רק למנהל כללי
create policy events_select on public.events for select to authenticated
  using (client_id = auth.uid() or public.is_staff());
create policy events_insert on public.events for insert to authenticated
  with check (
    (client_id = auth.uid() and public.app_role() = 'client' and status = 'booked')
    or public.can_edit_events());
create policy events_update on public.events for update to authenticated
  using (client_id = auth.uid() or public.can_edit_events());
create policy events_delete on public.events for delete to authenticated
  using (public.app_role() = 'admin');

-- menu_items: כולם קוראים (גם אורחים בדף הנחיתה). השף ומנהל כללי עורכים
create policy menu_select on public.menu_items for select to anon, authenticated using (true);
create policy menu_write on public.menu_items for all to authenticated
  using (public.app_role() in ('chef', 'admin')) with check (public.app_role() in ('chef', 'admin'));

-- event_menu_selections: לפי האירוע. הבדיקה events_select חלה גם בתוך תת-השאילתה
create policy selections_select on public.event_menu_selections for select to authenticated
  using (event_id in (select id from public.events));
create policy selections_write on public.event_menu_selections for all to authenticated
  using (event_id in (select id from public.events where client_id = auth.uid()) or public.can_edit_events())
  with check (event_id in (select id from public.events where client_id = auth.uid()) or public.can_edit_events());

-- tasting_slots: לקוח רואה שעות פנויות ואת הטעימה שלו. השף, רונית ורונן מנהלים
create policy slots_select on public.tasting_slots for select to authenticated
  using (public.is_staff() or event_id is null
         or event_id in (select id from public.events where client_id = auth.uid()));
create policy slots_write on public.tasting_slots for all to authenticated
  using (public.app_role() in ('chef', 'event_manager', 'admin'))
  with check (public.app_role() in ('chef', 'event_manager', 'admin'));

-- change_log: צוות רואה הכל, לקוח רואה את האירועים שלו. כתיבה: בקשת «דורש טיפול» מהאירוע של המשתמש
-- (רוב השורות נכתבות בטריגרים). סימון «טופל»: מנהלת אירועים ומנהל כללי
create policy log_select on public.change_log for select to authenticated
  using (public.is_staff() or event_id in (select id from public.events where client_id = auth.uid()));
create policy log_insert on public.change_log for insert to authenticated
  with check (changed_by = auth.uid() and event_id in (select id from public.events));
create policy log_resolve on public.change_log for update to authenticated
  using (public.app_role() in ('event_manager', 'admin'));

-- notifications: קריאה למנהלת אירועים ולמנהל כללי. כתיבה רק מהשרת (המפתח הסודי עוקף RLS)
create policy notifications_select on public.notifications for select to authenticated
  using (public.app_role() in ('event_manager', 'admin'));

-- agent_messages: כל משתמש רואה וכותב רק את השיחות שלו, ורק על אירוע שהוא רשאי לראות
create policy agent_select on public.agent_messages for select to authenticated
  using (user_id = auth.uid());
create policy agent_insert on public.agent_messages for insert to authenticated
  with check (user_id = auth.uid() and event_id in (select id from public.events));

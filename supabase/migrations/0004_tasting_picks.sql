-- =====================================================================
-- מנות לטעימה ומספר טועמים (progress/2026-11-08-0009-tasting-picks.md)
-- להריץ אחרי 0003_menu_ingredients.sql
--
-- עד עכשיו האשף שמר מנה אחת לכל שלב, והיא הייתה גם הטעימה וגם התפריט הסופי.
-- מעכשיו: באשף בוחרים כמה מנות לטעום (טבלה חדשה), והתפריט הסופי (event_menu_selections) נבחר אחרי הטעימה.
-- =====================================================================

-- כמה אנשים מגיעים לטעימה. מזה השף מחשב כמה להכין
alter table public.events
  add column tasters int not null default 2 check (tasters between 2 and 6);

-- שם בעברית לשדה החדש ביומן השינויים. create or replace מחליף את כל הפונקציה, ולכן כל השורות הקודמות כאן שוב
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
    when 'tasters' then 'מספר טועמים'
    else k end
$$;

-- המנות שנבחרו לטעימה: כמה מנות לכל שלב ולכל קבוצת סועדים
create table public.event_tasting_picks (
  event_id     uuid not null references public.events (id) on delete cascade,
  course       public.course not null,
  guest_group  public.guest_group not null,
  menu_item_id int not null references public.menu_items (id),
  primary key (event_id, course, guest_group, menu_item_id)
);

-- בדיקה לפני כל שמירה: המנה שייכת לשלב ומתאימה לקבוצה, ולא עוברים את המספר המותר לטעימה.
-- נאכף כאן ולא רק באשף, כדי שגם פנייה ישירה ל-API לא תעקוף את הכלל
create or replace function public.check_tasting_pick()
returns trigger language plpgsql set search_path = public
as $$
declare
  item record;
  max_picks int := case new.guest_group when 'regular' then 3 else 2 end;
  existing int;
begin
  select course, diet, is_vegan into item from public.menu_items where id = new.menu_item_id;
  if item.course is distinct from new.course then
    raise exception 'המנה לא שייכת לשלב הזה בתפריט';
  end if;
  if (new.guest_group = 'regular' and item.diet <> 'regular')
     or (new.guest_group = 'celiac' and item.diet <> 'celiac')
     or (new.guest_group = 'vegan' and not item.is_vegan) then
    raise exception 'המנה לא מתאימה לקבוצת הסועדים הזו';
  end if;
  select count(*) into existing from public.event_tasting_picks
   where event_id = new.event_id and course = new.course and guest_group = new.guest_group
     and menu_item_id <> new.menu_item_id;
  if existing >= max_picks then
    raise exception 'אפשר לבחור לטעימה עד % מנות לכל שלב בקבוצה הזו', max_picks;
  end if;
  return new;
end $$;

create trigger tasting_picks_check
  before insert or update on public.event_tasting_picks
  for each row execute function public.check_tasting_pick();

-- הרשאות: כמו התפריט הסופי. רואים לפי האירוע; כותבים הלקוח של האירוע או צוות שעורך אירועים
alter table public.event_tasting_picks enable row level security;
grant select, insert, update, delete on public.event_tasting_picks to authenticated;
grant all on public.event_tasting_picks to service_role;

create policy tasting_picks_select on public.event_tasting_picks for select to authenticated
  using (event_id in (select id from public.events));
create policy tasting_picks_write on public.event_tasting_picks for all to authenticated
  using (event_id in (select id from public.events where client_id = auth.uid()) or public.can_edit_events())
  with check (event_id in (select id from public.events where client_id = auth.uid()) or public.can_edit_events());

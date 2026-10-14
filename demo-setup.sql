-- =====================================================================
-- DEMO ACCOUNTS (run once in Supabase -> SQL Editor, AFTER database.sql)
-- Makes the "Demo" buttons on the login page work.
-- Demo accounts are REAL accounts: everything they do is saved.
--   Demo Admin   : demo.admin@fullbright.edu   / Demo@12345
--   Demo Student : demo.student@fullbright.edu / Demo@12345
-- =====================================================================

-- 1) Demo emails are confirmed automatically (no email needed)
create or replace function public.demo_autoconfirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email in ('demo.admin@fullbright.edu','demo.student@fullbright.edu') then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end $$;
drop trigger if exists on_demo_user_confirm on auth.users;
create trigger on_demo_user_confirm before insert on auth.users
for each row execute function public.demo_autoconfirm();

-- 2) Demo admin gets admin role; demo student gets starter fees + grades
create or replace function public.demo_setup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email = 'demo.admin@fullbright.edu' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  elsif new.email = 'demo.student@fullbright.edu' then
    insert into public.fees (student_id, term, description, amount, due_date) values
      (new.id, 'prelim',  'Tuition Fee - Prelim',  8500, current_date + 7),
      (new.id, 'midterm', 'Tuition Fee - Midterm', 8500, current_date + 45),
      (new.id, 'finals',  'Tuition Fee - Finals',  8500, current_date + 90);
    insert into public.grades (student_id, subject_code, subject_name, units, prelim, midterm, finals) values
      (new.id, 'IT101', 'Introduction to Computing', 3, 88, 90, null),
      (new.id, 'IT102', 'Computer Programming 1',   3, 85, 87, null),
      (new.id, 'GE101', 'Purposive Communication',  3, 90, null, null);
    insert into public.notifications (student_id, title, message, type) values
      (new.id, 'Welcome to Fullbright College', 'Your Prelim tuition fee is due in 7 days. Please settle your balance on time.', 'reminder');
  end if;
  return new;
end $$;
-- runs after on_auth_user_created (trigger names run in alphabetical order)
drop trigger if exists on_auth_user_demo_setup on auth.users;
create trigger on_auth_user_demo_setup after insert on auth.users
for each row execute function public.demo_setup();

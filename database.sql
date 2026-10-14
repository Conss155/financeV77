-- =====================================================================
-- FULLBRIGHT COLLEGE SMS - FINANCE & REPORTING MODULE
-- Run this whole file once in Supabase Dashboard -> SQL Editor -> New query
-- =====================================================================

create type public.app_role as enum ('admin', 'student');

-- ---------- PROFILES (student information) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  student_no text,
  course text,
  year_level text,
  email text,
  created_at timestamptz not null default now()
);

-- ---------- ROLES (separate table for security) ----------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

-- ---------- FEES (per term: prelim / midterm / finals) ----------
create table public.fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  term text not null check (term in ('prelim','midterm','finals')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  school_year text not null default '2026-2027',
  created_at timestamptz not null default now()
);

-- ---------- PAYMENTS ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  fee_id uuid not null references public.fees(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  reference text not null unique,
  status text not null default 'success' check (status in ('success','pending','failed')),
  created_at timestamptz not null default now()
);

-- ---------- GRADES (academic reports) ----------
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_code text not null,
  subject_name text not null,
  units int not null default 3,
  prelim numeric(5,2),
  midterm numeric(5,2),
  finals numeric(5,2),
  school_year text not null default '2026-2027',
  created_at timestamptz not null default now()
);

-- ---------- NOTIFICATIONS ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info','reminder','overdue','paid')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- GRANTS ----------
grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.fees, public.payments, public.grades, public.notifications to authenticated;
grant all on public.profiles, public.user_roles, public.fees, public.payments, public.grades, public.notifications to service_role;

-- ---------- ROLE CHECK FUNCTION ----------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ---------- AUTO-CREATE PROFILE + STUDENT ROLE ON SIGNUP ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, student_no, course, year_level, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          new.raw_user_meta_data->>'student_no',
          new.raw_user_meta_data->>'course',
          new.raw_user_meta_data->>'year_level',
          new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- AUTO NOTIFICATION WHEN A PAYMENT SUCCEEDS ----------
create or replace function public.notify_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare f record;
begin
  select * into f from public.fees where id = new.fee_id;
  if new.status = 'success' then
    insert into public.notifications (student_id, title, message, type)
    values (new.student_id, 'Payment received',
            'We received ₱' || to_char(new.amount,'FM999,999,990.00') || ' for ' || initcap(f.term) ||
            ' (' || f.description || '). Reference no. ' || new.reference, 'paid');
  end if;
  return new;
end $$;
create trigger on_payment_created after insert on public.payments
for each row execute function public.notify_payment();

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.fees enable row level security;
alter table public.payments enable row level security;
alter table public.grades enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
-- roles
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
-- fees: students read own, admin full
create policy "fees read" on public.fees for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "fees admin write" on public.fees for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
-- payments: students read + create own, admin full
create policy "payments read" on public.payments for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "payments student insert" on public.payments for insert to authenticated with check (student_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "payments admin update" on public.payments for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "payments admin delete" on public.payments for delete to authenticated using (public.has_role(auth.uid(),'admin'));
-- grades
create policy "grades read" on public.grades for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "grades admin write" on public.grades for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
-- notifications: students read + mark read own, admin full
create policy "notif read" on public.notifications for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "notif student mark read" on public.notifications for update to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "notif admin insert" on public.notifications for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "notif admin delete" on public.notifications for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- =====================================================================
-- MAKE YOURSELF ADMIN (run AFTER you sign up with your admin email):
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'your-admin@email.com';
-- =====================================================================

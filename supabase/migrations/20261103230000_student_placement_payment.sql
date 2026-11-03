-- Migration: Add student placement payment tracking (Admin-only)
-- Adds payment tracking columns to student_profiles, an index for fast filtering,
-- and a security trigger ensuring only admins can set or update payment columns.

alter table public.student_profiles
  add column if not exists is_paid boolean not null default false,
  add column if not exists payment_amount numeric(10, 2) check (payment_amount is null or payment_amount >= 0),
  add column if not exists payment_date date,
  add column if not exists placed_company text,
  add column if not exists payment_notes text,
  add column if not exists payment_updated_at timestamptz,
  add column if not exists payment_marked_by uuid references auth.users (id) on delete set null;

create index if not exists student_profiles_is_paid_idx
  on public.student_profiles (is_paid, payment_date desc);

-- Protect payment fields from non-admin modification
create or replace function public.protect_student_payment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  -- Check if caller is admin
  caller_is_admin := public.is_admin(auth.uid());

  if tg_op = 'INSERT' then
    if not caller_is_admin then
      new.is_paid := false;
      new.payment_amount := null;
      new.payment_date := null;
      new.placed_company := null;
      new.payment_notes := null;
      new.payment_updated_at := null;
      new.payment_marked_by := null;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if (new.is_paid is distinct from old.is_paid or
        new.payment_amount is distinct from old.payment_amount or
        new.payment_date is distinct from old.payment_date or
        new.placed_company is distinct from old.placed_company or
        new.payment_notes is distinct from old.payment_notes or
        new.payment_marked_by is distinct from old.payment_marked_by) then
      if not caller_is_admin then
        -- Restore old payment values if caller is not an admin
        new.is_paid := old.is_paid;
        new.payment_amount := old.payment_amount;
        new.payment_date := old.payment_date;
        new.placed_company := old.placed_company;
        new.payment_notes := old.payment_notes;
        new.payment_updated_at := old.payment_updated_at;
        new.payment_marked_by := old.payment_marked_by;
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_student_payment_fields on public.student_profiles;
create trigger trg_protect_student_payment_fields
before insert or update on public.student_profiles
for each row
execute function public.protect_student_payment_fields();

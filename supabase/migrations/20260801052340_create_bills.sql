-- Admin billing: invoices for company services (job posts, Instagram reels, etc.)

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text not null unique,
  company_name text not null,
  employer_user_id uuid references public.employer_profiles (user_id) on delete set null,
  contact_name text,
  contact_email text,
  contact_phone text,
  company_address text,
  company_gstin text,
  bill_date date not null default (timezone('asia/kolkata', now()))::date,
  due_date date,
  status text not null default 'issued'
    check (status in ('draft', 'issued', 'paid', 'cancelled')),
  notes text,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  tax_percent numeric(5, 2) not null default 0 check (tax_percent >= 0 and tax_percent <= 100),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid')),
  payment_notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint bills_company_name_check
    check (char_length(trim(company_name)) >= 2)
);

create trigger set_bills_updated_at
before update on public.bills
for each row
execute function public.set_updated_at();

create index if not exists bills_created_at_idx on public.bills (created_at desc);
create index if not exists bills_status_idx on public.bills (status);
create index if not exists bills_payment_status_idx on public.bills (payment_status);
create index if not exists bills_employer_user_id_idx on public.bills (employer_user_id);
create index if not exists bills_company_name_idx on public.bills (lower(company_name));

create table if not exists public.bill_line_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  service_key text not null default 'custom',
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint bill_line_items_description_check
    check (char_length(trim(description)) >= 2)
);

create index if not exists bill_line_items_bill_id_idx
  on public.bill_line_items (bill_id, sort_order);

create sequence if not exists public.bills_number_seq;

create or replace function public.next_bill_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq_val bigint;
  date_part text;
begin
  seq_val := nextval('public.bills_number_seq');
  date_part := to_char(timezone('asia/kolkata', now()), 'YYYYMMDD');
  return 'VJ-' || date_part || '-' || lpad(seq_val::text, 4, '0');
end;
$$;

revoke all on function public.next_bill_number() from public;
grant execute on function public.next_bill_number() to authenticated;

alter table public.bills enable row level security;
alter table public.bill_line_items enable row level security;

drop policy if exists "Admins can read bills" on public.bills;
create policy "Admins can read bills"
on public.bills
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can insert bills" on public.bills;
create policy "Admins can insert bills"
on public.bills
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins can update bills" on public.bills;
create policy "Admins can update bills"
on public.bills
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins can delete bills" on public.bills;
create policy "Admins can delete bills"
on public.bills
for delete
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can read bill line items" on public.bill_line_items;
create policy "Admins can read bill line items"
on public.bill_line_items
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can insert bill line items" on public.bill_line_items;
create policy "Admins can insert bill line items"
on public.bill_line_items
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins can update bill line items" on public.bill_line_items;
create policy "Admins can update bill line items"
on public.bill_line_items
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins can delete bill line items" on public.bill_line_items;
create policy "Admins can delete bill line items"
on public.bill_line_items
for delete
to authenticated
using (public.is_admin(auth.uid()));

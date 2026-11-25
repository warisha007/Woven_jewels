create table if not exists public.wj_products (
  id text primary key,
  name text not null,
  price integer not null check (price >= 0),
  active boolean not null default true
);

insert into public.wj_products (id, name, price) values
  ('ethereal-handchain', 'Ethereal Handchain', 700),
  ('beaded-bracelets', 'Beaded Bracelets (Set of 6)', 600),
  ('moonlace-bracelets', 'Moonlace bracelets', 400),
  ('starfall-earrings', 'Starfall Earrings', 300),
  ('joyful-bloom-bracelet', 'Joyful Bloom Bracelet', 700),
  ('rainbow-bracelets', 'Rainbow bracelets', 600),
  ('blossom-bracelet', 'Blossom Bracelet', 400),
  ('pearle-bracelet', 'Pearle Bracelet', 400),
  ('lilac-bracelet', 'Lilac Bracelet', 400)
on conflict (id) do update
set name = excluded.name, price = excluded.price, active = true;

create table if not exists public.wj_admin_users (
  email text primary key check (email = lower(email))
);

insert into public.wj_admin_users (email)
values ('wisha0007@gmail.com')
on conflict (email) do nothing;

create table if not exists public.wj_orders (
  id uuid primary key default gen_random_uuid(),
  customer jsonb not null,
  items jsonb not null,
  subtotal integer not null check (subtotal >= 0),
  shipping integer not null check (shipping >= 0),
  total integer not null check (total = subtotal + shipping),
  advance_amount numeric(12, 2) not null check (advance_amount >= 0),
  cod_balance numeric(12, 2) not null check (cod_balance >= 0),
  payment_status text not null default 'awaiting_proof'
    check (payment_status in ('awaiting_proof', 'pending_review', 'approved')),
  order_status text not null default 'pending'
    check (order_status in ('pending', 'accepted')),
  proof_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wj_orders_created_at_idx on public.wj_orders (created_at desc);
alter table public.wj_products enable row level security;
alter table public.wj_admin_users enable row level security;
alter table public.wj_orders enable row level security;

create or replace function public.wj_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.wj_admin_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.wj_can_upload_payment_proof(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.wj_orders
    where id::text = p_order_id
      and payment_status = 'awaiting_proof'
  );
$$;

create or replace function public.wj_create_order(p_customer jsonb, p_items jsonb)
returns table (
  order_id uuid,
  subtotal integer,
  shipping integer,
  total integer,
  advance_amount numeric,
  cod_balance numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_field text;
  v_customer jsonb;
  v_items jsonb;
  v_order_id uuid;
  v_subtotal integer;
  v_shipping integer := 200;
  v_total integer;
  v_advance numeric(12, 2);
begin
  if jsonb_typeof(p_customer) is distinct from 'object' then
    raise exception 'Customer details are required.';
  end if;

  foreach v_field in array array[
    'fullName', 'country', 'contactNumber', 'email', 'city',
    'region', 'fullAddress', 'streetAddress'
  ] loop
    if length(trim(coalesce(p_customer ->> v_field, ''))) = 0 then
      raise exception 'Missing required customer field: %', v_field;
    end if;
  end loop;

  if length(trim(p_customer ->> 'fullName')) > 150
    or length(trim(p_customer ->> 'contactNumber')) > 30
    or trim(p_customer ->> 'contactNumber') !~ '^\+?[0-9]{7,19}$'
    or length(trim(p_customer ->> 'email')) > 254
    or position('@' in (p_customer ->> 'email')) = 0
    or length(trim(p_customer ->> 'city')) > 100
    or length(trim(p_customer ->> 'region')) > 100
    or length(trim(p_customer ->> 'fullAddress')) > 500
    or length(trim(p_customer ->> 'streetAddress')) > 250
    or length(trim(coalesce(p_customer ->> 'apartment', ''))) > 120 then
    raise exception 'One or more customer fields have an invalid length or format.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'The order items must be a list.';
  end if;

  if jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 50 then
    raise exception 'The order must contain between 1 and 50 items.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry(item)
    left join public.wj_products as product
      on product.id = entry.item ->> 'id'
      and product.active
    where product.id is null
  ) then
    raise exception 'The order contains an unavailable product.';
  end if;

  select
    jsonb_agg(jsonb_build_object(
      'id', product.id,
      'name', product.name,
      'unitPrice', product.price,
      'quantity', 1
    )),
    sum(product.price)
  into v_items, v_subtotal
  from jsonb_array_elements(p_items) as entry(item)
  join public.wj_products as product
    on product.id = entry.item ->> 'id'
    and product.active;

  v_total := v_subtotal + v_shipping;
  v_advance := round(v_total / 2.0, 2);
  v_customer := jsonb_build_object(
    'fullName', trim(p_customer ->> 'fullName'),
    'country', trim(p_customer ->> 'country'),
    'contactNumber', trim(p_customer ->> 'contactNumber'),
    'email', lower(trim(p_customer ->> 'email')),
    'city', trim(p_customer ->> 'city'),
    'region', trim(p_customer ->> 'region'),
    'fullAddress', trim(p_customer ->> 'fullAddress'),
    'streetAddress', trim(p_customer ->> 'streetAddress'),
    'apartment', trim(coalesce(p_customer ->> 'apartment', ''))
  );

  insert into public.wj_orders (
    customer, items, subtotal, shipping, total, advance_amount, cod_balance
  )
  values (
    v_customer, v_items, v_subtotal, v_shipping, v_total, v_advance, v_advance
  )
  returning id into v_order_id;

  return query
  select v_order_id, v_subtotal, v_shipping, v_total, v_advance, v_advance;
end;
$$;

create or replace function public.wj_submit_payment_proof(
  p_order_id uuid,
  p_proof_path text
)
returns void
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  if p_proof_path !~ ('^' || p_order_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Invalid payment-proof file path.';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'wj-payment-proofs'
      and name = p_proof_path
  ) then
    raise exception 'The uploaded payment proof could not be found.';
  end if;

  update public.wj_orders
  set proof_path = p_proof_path,
      payment_status = 'pending_review',
      updated_at = now()
  where id = p_order_id
    and payment_status = 'awaiting_proof';

  if not found then
    raise exception 'This order is not waiting for a payment proof.';
  end if;
end;
$$;

create or replace function public.wj_approve_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.wj_is_admin() then
    raise exception 'Admin access is required.';
  end if;

  update public.wj_orders
  set payment_status = 'approved', updated_at = now()
  where id = p_order_id
    and payment_status = 'pending_review'
    and proof_path is not null;

  if not found then
    raise exception 'This order has no payment proof waiting for review.';
  end if;
end;
$$;

create or replace function public.wj_accept_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.wj_is_admin() then
    raise exception 'Admin access is required.';
  end if;

  update public.wj_orders
  set order_status = 'accepted', updated_at = now()
  where id = p_order_id
    and payment_status = 'approved'
    and order_status = 'pending';

  if not found then
    raise exception 'Approve the advance payment before accepting this order.';
  end if;
end;
$$;

drop policy if exists "Admins can view Woven Jewels orders" on public.wj_orders;
create policy "Admins can view Woven Jewels orders"
  on public.wj_orders for select to authenticated
  using (public.wj_is_admin());

revoke all on public.wj_products, public.wj_admin_users, public.wj_orders from anon, authenticated;
grant select on public.wj_orders to authenticated;
grant execute on function public.wj_is_admin() to authenticated;
grant execute on function public.wj_can_upload_payment_proof(text) to anon, authenticated;
grant execute on function public.wj_create_order(jsonb, jsonb) to anon, authenticated;
grant execute on function public.wj_submit_payment_proof(uuid, text) to anon, authenticated;
grant execute on function public.wj_approve_payment(uuid) to authenticated;
grant execute on function public.wj_accept_order(uuid) to authenticated;
revoke all on function public.wj_is_admin() from public;
revoke all on function public.wj_can_upload_payment_proof(text) from public;
revoke all on function public.wj_create_order(jsonb, jsonb) from public;
revoke all on function public.wj_submit_payment_proof(uuid, text) from public;
revoke all on function public.wj_approve_payment(uuid) from public;
revoke all on function public.wj_accept_order(uuid) from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wj-payment-proofs',
  'wj-payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Customers can upload Woven Jewels proof" on storage.objects;
create policy "Customers can upload Woven Jewels proof"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'wj-payment-proofs'
    and array_length(storage.foldername(name), 1) = 1
    and public.wj_can_upload_payment_proof((storage.foldername(name))[1])
  );

drop policy if exists "Admins can read Woven Jewels proofs" on storage.objects;
create policy "Admins can read Woven Jewels proofs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'wj-payment-proofs'
    and public.wj_is_admin()
  );

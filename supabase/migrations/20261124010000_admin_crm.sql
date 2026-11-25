alter table public.wj_orders
  add column if not exists fulfillment_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wj_orders_fulfillment_status_check'
      and conrelid = 'public.wj_orders'::regclass
  ) then
    alter table public.wj_orders
      add constraint wj_orders_fulfillment_status_check
      check (fulfillment_status in (
        'pending', 'processing', 'ready_to_ship', 'shipped', 'delivered'
      ));
  end if;
end;
$$;

create table if not exists public.wj_order_activity (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.wj_orders(id) on delete cascade,
  activity_type text not null check (activity_type in ('note', 'fulfillment_status')),
  content text not null check (length(trim(content)) between 1 and 2000),
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists wj_order_activity_order_created_idx
  on public.wj_order_activity (order_id, created_at desc);

alter table public.wj_order_activity enable row level security;

drop policy if exists "Admins can view Woven Jewels order activity"
  on public.wj_order_activity;
create policy "Admins can view Woven Jewels order activity"
  on public.wj_order_activity for select to authenticated
  using (public.wj_is_admin());

revoke all on public.wj_order_activity from anon, authenticated;
grant select on public.wj_order_activity to authenticated;

create or replace function public.wj_update_fulfillment_status(
  p_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_status text;
begin
  if not public.wj_is_admin() then
    raise exception 'Admin access is required.';
  end if;

  if p_status is null
    or p_status not in ('processing', 'ready_to_ship', 'shipped', 'delivered') then
    raise exception 'Choose a valid fulfillment status.';
  end if;

  select fulfillment_status
  into v_previous_status
  from public.wj_orders
  where id = p_order_id
    and order_status = 'accepted'
    and payment_status = 'approved'
  for update;

  if not found then
    raise exception 'Approve payment and accept the order before updating fulfillment.';
  end if;

  if v_previous_status = p_status then
    return;
  end if;

  update public.wj_orders
  set fulfillment_status = p_status,
      updated_at = now()
  where id = p_order_id;

  insert into public.wj_order_activity (order_id, activity_type, content, created_by)
  values (
    p_order_id,
    'fulfillment_status',
    p_status,
    lower(coalesce(auth.jwt() ->> 'email', ''))
  );
end;
$$;

create or replace function public.wj_add_order_note(
  p_order_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.wj_is_admin() then
    raise exception 'Admin access is required.';
  end if;

  if length(trim(coalesce(p_note, ''))) not between 1 and 2000 then
    raise exception 'Notes must contain between 1 and 2000 characters.';
  end if;

  if not exists (
    select 1 from public.wj_orders where id = p_order_id
  ) then
    raise exception 'The order could not be found.';
  end if;

  insert into public.wj_order_activity (order_id, activity_type, content, created_by)
  values (
    p_order_id,
    'note',
    trim(p_note),
    lower(coalesce(auth.jwt() ->> 'email', ''))
  );
end;
$$;

grant execute on function public.wj_update_fulfillment_status(uuid, text) to authenticated;
grant execute on function public.wj_add_order_note(uuid, text) to authenticated;
revoke all on function public.wj_update_fulfillment_status(uuid, text) from public, anon;
revoke all on function public.wj_add_order_note(uuid, text) from public, anon;

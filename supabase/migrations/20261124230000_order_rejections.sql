alter table public.wj_orders
  drop constraint if exists wj_orders_order_status_check;

alter table public.wj_orders
  add constraint wj_orders_order_status_check
  check (order_status in ('pending', 'accepted', 'rejected'));

alter table public.wj_order_activity
  drop constraint if exists wj_order_activity_activity_type_check;

alter table public.wj_order_activity
  add constraint wj_order_activity_activity_type_check
  check (activity_type in ('note', 'fulfillment_status', 'order_rejected'));

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
      and order_status = 'pending'
  );
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
    and payment_status = 'awaiting_proof'
    and order_status = 'pending';

  if not found then
    raise exception 'This order is not waiting for a payment proof or has already been rejected.';
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
    and order_status = 'pending'
    and proof_path is not null;

  if not found then
    raise exception 'This order has no payment proof waiting for review or has already been rejected.';
  end if;
end;
$$;

create or replace function public.wj_reject_order(
  p_order_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_status text;
begin
  if not public.wj_is_admin() then
    raise exception 'Admin access is required.';
  end if;

  if length(trim(coalesce(p_reason, ''))) not between 1 and 2000 then
    raise exception 'Enter a rejection reason between 1 and 2000 characters.';
  end if;

  select order_status
  into v_order_status
  from public.wj_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'The order could not be found.';
  end if;

  if v_order_status <> 'pending' then
    raise exception 'Only orders that have not yet been accepted can be rejected.';
  end if;

  update public.wj_orders
  set order_status = 'rejected',
      updated_at = now()
  where id = p_order_id;

  insert into public.wj_order_activity (order_id, activity_type, content, created_by)
  values (
    p_order_id,
    'order_rejected',
    trim(p_reason),
    lower(coalesce(auth.jwt() ->> 'email', ''))
  );
end;
$$;

grant execute on function public.wj_can_upload_payment_proof(text) to anon, authenticated;
grant execute on function public.wj_submit_payment_proof(uuid, text) to anon, authenticated;
grant execute on function public.wj_approve_payment(uuid) to authenticated;
grant execute on function public.wj_reject_order(uuid, text) to authenticated;

revoke all on function public.wj_can_upload_payment_proof(text) from public;
revoke all on function public.wj_submit_payment_proof(uuid, text) from public;
revoke all on function public.wj_approve_payment(uuid) from public;
revoke all on function public.wj_reject_order(uuid, text) from public, anon;

notify pgrst, 'reload schema';

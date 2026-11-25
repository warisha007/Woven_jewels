-- One-time destructive cleanup. Run only after verifying the selected Supabase
-- project and confirming every order is disposable demo data.
begin;

do $$
declare
  v_order_count integer;
begin
  select count(*) into v_order_count
  from public.wj_orders;

  if v_order_count <> 5 then
    raise exception 'Expected exactly 5 demo orders; found %. No orders were deleted.', v_order_count;
  end if;

  delete from public.wj_orders;
end;
$$;

select count(*) as remaining_orders
from public.wj_orders;

commit;

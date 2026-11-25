-- One-time destructive cleanup. Run only after verifying the selected Supabase
-- project and confirming every order is disposable demo data.
begin;

delete from public.wj_orders;

select count(*) as remaining_orders
from public.wj_orders;

commit;

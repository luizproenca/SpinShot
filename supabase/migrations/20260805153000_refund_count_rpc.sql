-- ===========================================================
-- SpinShot 360 — Refund counter RPC (item 5/7 of the fraud-hardening plan)
-- ===========================================================
-- rc-webhook needs to bump user_profiles.refund_count from a CANCELLATION
-- event whose cancel_reason is CUSTOMER_SUPPORT (an actual refund, not a
-- voluntary unsubscribe). A plain `.update()` read-then-write from the edge
-- function would race with itself under concurrent webhook deliveries; this
-- RPC does the increment atomically in one statement.
--
-- Restricted to service_role only — refund_count feeds the anti-abuse
-- escalation in validate-purchase (item 7), so it must not be callable by
-- an authenticated client for their own or anyone else's account.

create or replace function public.increment_refund_count(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.user_profiles
  set refund_count = refund_count + 1
  where id = p_user_id
  returning refund_count into v_count;

  return v_count;
end;
$$;

revoke all on function public.increment_refund_count(uuid) from public;
grant execute on function public.increment_refund_count(uuid) to service_role;

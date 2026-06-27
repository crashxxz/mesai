-- Fix: financial_entries RLS was owner-only, blocking manager/cashier/waiter
-- from seeing financial data in dashboard/financeiro.
-- Also allow insert by roles that can register payments (close_paid_order uses security definer,
-- but explicit insert policy is needed for consistency).

drop policy if exists "financial owner" on public.financial_entries;

-- Read: owner, manager, cashier (need to see dashboard/financeiro)
create policy "financial_entries_read" on public.financial_entries
  for select to authenticated
  using (
    restaurant_id = public.current_restaurant_id()
    and public.current_role() in ('owner', 'manager', 'cashier')
  );

-- Insert: owner, manager (expenses), security definer RPCs handle sale entries
create policy "financial_entries_insert" on public.financial_entries
  for insert to authenticated
  with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_role() in ('owner', 'manager')
  );

-- Update/Delete: owner, manager only
create policy "financial_entries_modify" on public.financial_entries
  for update to authenticated
  using (
    restaurant_id = public.current_restaurant_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_role() in ('owner', 'manager')
  );

-- Also fix payments insert: currently only owner/waiter can insert.
-- But register_order_payment uses security definer so RLS is bypassed for the RPC.
-- However, cashier and manager should also be able to insert via direct path.
drop policy if exists "payments operational insert" on public.payments;

create policy "payments_insert" on public.payments
  for insert to authenticated
  with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_role() in ('owner', 'manager', 'cashier', 'waiter')
  );

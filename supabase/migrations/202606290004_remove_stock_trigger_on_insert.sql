-- Remove the auto-deduct stock trigger on order_items INSERT.
-- Stock deduction now happens ONLY at order close via deduct_stock_on_close().
-- This prevents duplicate stock movements.

drop trigger if exists trg_deduct_stock_on_order_item_insert on public.order_items;
drop function if exists public.deduct_stock_on_order_item_insert();

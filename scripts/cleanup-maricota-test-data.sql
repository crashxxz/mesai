-- Script de conferência e limpeza de dados de teste do Boteco da Maricota.
-- Rodar manualmente no Supabase SQL Editor.
-- NUNCA rodar UPDATE sem conferir SELECT primeiro.

-- ============================================================
-- A) CONFERÊNCIA (apenas SELECT)
-- ============================================================

-- 1. Pagamentos pagos que não estão vinculados a nenhum caixa (fora do caixa)
SELECT 'Pagamento fora do caixa' as tipo,
       p.id, p.method, p.amount, p.payment_status, p.created_at,
       o.status as order_status, o.total as order_total
FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
LEFT JOIN public.cash_movements cm ON cm.description LIKE '%' || p.order_id::text || '%' AND cm.type = 'sale'
WHERE p.restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'boteco-da-maricota')
  AND coalesce(p.payment_status, 'paid') = 'paid'
  AND cm.id IS NULL
ORDER BY p.created_at;

-- 2. Orders fechadas sem financial_entry income ativa
SELECT 'Order sem financial_entry' as tipo,
       o.id, o.status, o.total, o.closed_at
FROM public.orders o
LEFT JOIN public.financial_entries fe
  ON fe.order_id = o.id AND fe.type = 'income' AND fe.paid = true AND fe.cancelled_at IS NULL
WHERE o.restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'boteco-da-maricota')
  AND o.status = 'closed'
  AND o.total > 0
  AND fe.id IS NULL
ORDER BY o.closed_at;

-- 3. Financial_entries canceladas que ainda tem payments pagos
SELECT 'Financial cancelada com payment pago' as tipo,
       fe.id as fe_id, fe.order_id, fe.amount, fe.cancelled_at,
       p.id as payment_id, p.amount as payment_amount, p.payment_status
FROM public.financial_entries fe
JOIN public.payments p ON p.order_id = fe.order_id AND coalesce(p.payment_status, 'paid') = 'paid'
WHERE fe.restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'boteco-da-maricota')
  AND fe.type = 'income'
  AND (fe.paid = false OR fe.cancelled_at IS NOT NULL);

-- ============================================================
-- B) LIMPEZA (descomente SOMENTE após conferir)
-- ============================================================

-- Cancelar payments de orders sem financial_entry ativa (dados de teste)
-- UPDATE public.payments
-- SET payment_status = 'cancelled'
-- WHERE order_id IN (
--   SELECT o.id FROM public.orders o
--   LEFT JOIN public.financial_entries fe
--     ON fe.order_id = o.id AND fe.type = 'income' AND fe.paid = true AND fe.cancelled_at IS NULL
--   WHERE o.restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'boteco-da-maricota')
--     AND o.status = 'closed'
--     AND o.total > 0
--     AND fe.id IS NULL
-- )
-- AND coalesce(payment_status, 'paid') = 'paid';

-- Marcar orders sem financial_entry como canceladas
-- UPDATE public.orders
-- SET status = 'cancelled',
--     cancel_reason = 'Dado de teste sem lançamento financeiro',
--     updated_at = now()
-- WHERE id IN (
--   SELECT o.id FROM public.orders o
--   LEFT JOIN public.financial_entries fe
--     ON fe.order_id = o.id AND fe.type = 'income' AND fe.paid = true AND fe.cancelled_at IS NULL
--   WHERE o.restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'boteco-da-maricota')
--     AND o.status = 'closed'
--     AND o.total > 0
--     AND fe.id IS NULL
-- );

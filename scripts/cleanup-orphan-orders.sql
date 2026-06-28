-- Script de conferência e limpeza de orders/pagamentos órfãos.
-- Rodar manualmente no Supabase SQL Editor. NÃO executar UPDATE sem conferir SELECT primeiro.

-- ============================================================
-- A) CONFERÊNCIA (apenas SELECT)
-- ============================================================

-- 1. Orders fechadas SEM financial_entry income ativa
SELECT 'Order sem entrada financeira' as tipo,
       o.id, o.status, o.total, o.closed_at,
       t.name as mesa
FROM public.orders o
LEFT JOIN public.financial_entries fe
  ON fe.order_id = o.id AND fe.type = 'income' AND fe.paid = true AND fe.cancelled_at IS NULL
LEFT JOIN public.tables t ON t.id = o.table_id
WHERE o.status = 'closed'
  AND o.total > 0
  AND fe.id IS NULL
ORDER BY o.closed_at DESC;

-- 2. Payments pagos de orders com financial_entry cancelada
SELECT 'Pagamento de venda cancelada' as tipo,
       p.id as payment_id, p.order_id, p.method, p.amount, p.payment_status,
       fe.cancelled_at
FROM public.payments p
JOIN public.financial_entries fe ON fe.order_id = p.order_id AND fe.type = 'income'
WHERE coalesce(p.payment_status, 'paid') = 'paid'
  AND (fe.paid = false OR fe.cancelled_at IS NOT NULL)
ORDER BY p.created_at DESC;

-- 3. Cash_movements de vendas canceladas
SELECT 'Movimento de venda cancelada' as tipo,
       cm.id, cm.description, cm.amount, cm.type,
       o.status as order_status
FROM public.cash_movements cm
JOIN public.orders o ON cm.description LIKE '%' || o.id::text || '%'
WHERE cm.type = 'sale'
  AND o.status = 'cancelled'
ORDER BY cm.created_at DESC;

-- ============================================================
-- B) LIMPEZA (UPDATE - descomente SOMENTE após conferir acima)
-- ============================================================

-- Marcar orders órfãs como canceladas
-- UPDATE public.orders
-- SET status = 'cancelled',
--     cancel_reason = 'Fechamento de teste sem lançamento financeiro',
--     updated_at = now()
-- WHERE id IN (
--   SELECT o.id FROM public.orders o
--   LEFT JOIN public.financial_entries fe
--     ON fe.order_id = o.id AND fe.type = 'income' AND fe.paid = true AND fe.cancelled_at IS NULL
--   WHERE o.status = 'closed' AND o.total > 0 AND fe.id IS NULL
-- );

-- Cancelar payments de vendas já canceladas
-- UPDATE public.payments
-- SET payment_status = 'cancelled'
-- WHERE order_id IN (SELECT id FROM public.orders WHERE status = 'cancelled')
--   AND coalesce(payment_status, 'paid') = 'paid';

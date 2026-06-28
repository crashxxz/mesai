-- Script de conferência e limpeza de orders fechadas sem financial_entry ativa.
-- Rodar manualmente no Supabase SQL Editor.
-- PASSO 1: conferir quais orders seriam afetadas (SELECT apenas)

-- Orders fechadas SEM financial_entry income ativa
SELECT o.id, o.table_id, o.total, o.closed_at, o.status,
       fe.id as fe_id, fe.paid, fe.cancelled_at
FROM public.orders o
LEFT JOIN public.financial_entries fe
  ON fe.order_id = o.id AND fe.type = 'income' AND fe.category = 'sale'
WHERE o.status = 'closed'
  AND o.total > 0
  AND (fe.id IS NULL OR fe.paid = false OR fe.cancelled_at IS NOT NULL)
ORDER BY o.closed_at DESC;

-- PASSO 2: Se os resultados acima são mesas de teste/canceladas, rodar UPDATE:
-- (Descomente para executar - CUIDADO)

-- UPDATE public.orders
-- SET status = 'cancelled',
--     cancel_reason = 'Fechamento de teste/sem lançamento financeiro válido',
--     updated_at = now()
-- WHERE id IN (
--   SELECT o.id
--   FROM public.orders o
--   LEFT JOIN public.financial_entries fe
--     ON fe.order_id = o.id AND fe.type = 'income' AND fe.category = 'sale' AND fe.paid = true AND fe.cancelled_at IS NULL
--   WHERE o.status = 'closed'
--     AND o.total > 0
--     AND fe.id IS NULL
-- );

-- Bebidas simples (cerveja, refrigerante, água, energético, dose pronta)
-- não precisam ir para fila de Bar/Cozinha.
-- O garçom pega e entrega direto.
-- Setar preparation_sector = 'none' e preparation_required = false.

-- CONFERÊNCIA primeiro:
SELECT p.name, p.preparation_sector, c.name as category
FROM public.products p
JOIN public.categories c ON c.id = p.category_id
WHERE p.restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'boteco-da-maricota')
  AND c.name IN ('Água', 'Refrigerantes 1 litro', 'Refrigerantes lata', 'Refrigerantes 600ml',
                  'Long neck', 'Long neck zero', 'Energético', 'Cervejas', 'Bebidas quentes')
ORDER BY c.name, p.name;

-- APLICAR (descomente após conferir):
-- UPDATE public.products
-- SET preparation_sector = 'none', preparation_required = false, updated_at = now()
-- WHERE restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'boteco-da-maricota')
--   AND category_id IN (
--     SELECT id FROM public.categories
--     WHERE restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'boteco-da-maricota')
--       AND name IN ('Água', 'Refrigerantes 1 litro', 'Refrigerantes lata', 'Refrigerantes 600ml',
--                    'Long neck', 'Long neck zero', 'Energético', 'Cervejas', 'Bebidas quentes')
--   );

-- Sucos precisam preparo, então MANTER preparation_sector = 'bar' e preparation_required = true.

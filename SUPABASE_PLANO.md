# Plano Supabase - Mesaí

> Estado local: migrações, gateway, segurança do QR, RPCs transacionais, seed e testes de contrato foram preparados. A aplicação no banco real depende da criação e das credenciais do projeto Supabase. Ver `supabase/README.md` e `PRODUCTION_READY.md`.

## Objetivo

Migrar o Mesaí sem remover o modo demo e sem fazer a interface depender diretamente do Supabase.

Arquitetura desejada:

```text
Interface -> Store/comandos -> contrato de dados -> LocalStorageAdapter ou SupabaseAdapter
```

O `StorageAdapter` atual isola carga e gravação do demo. A próxima etapa deve separar também consultas e comandos de domínio.

## Tabelas necessárias

### Organização

- `restaurants`: nome, nome do link, contato, cidade, endereço, WhatsApp e mapa
- `restaurant_settings`: QR, aprovação, taxa e opções operacionais
- `business_profiles`: preset ativo e versão
- `profiles`: usuário, estabelecimento, nome, cargo e ativo

### Operação

- `tables`: estabelecimento, número, nome, estado e ativo
- `table_qr_tokens`: mesa, token, ativo, validade e rotação
- `tabs`: comanda, mesa, cliente, abertura e fechamento
- `orders`: origem, estado, valores, criador e datas
- `order_items`: snapshot, quantidade, setor, estado, motivo e tempos
- `order_item_addons`: snapshot do adicional e valor
- `table_alerts`: chamar garçom e pedir conta

### Cardápio e estoque

- `categories`
- `products`
- `product_variations`
- `product_addons`
- `product_allowed_addons`
- `stock_movements`: produto, tipo, quantidade, motivo, custo e operador
- `recipes` e `recipe_items`: ficha técnica futura
- `suppliers`: fornecedor e contato

### Caixa e financeiro

- `payments`
- `cash_sessions`
- `cash_movements`
- `financial_entries`
- despesas podem ser uma especialização de `financial_entries`

### Clientes e controle

- `customers`
- `customer_debts`
- `customer_actions`: ação do QR, mesa, sessão e data
- `audit_logs`

### SaaS

- `plans`
- `subscriptions`
- `subscription_limits`
- `restaurant_memberships` para múltiplas unidades

## Ajustes no schema existente

- adicionar cargos `manager` e `cashier` em migração segura
- adicionar cidade, WhatsApp e mapa em `restaurants`
- adicionar preset ativo e versionado
- adicionar unidade de estoque ao produto
- criar `stock_movements`
- adicionar observação em lançamentos financeiros
- criar tokens seguros de QR por mesa
- substituir o seed SQL antigo pelos dados Mesaí/Boteco da Maricota
- revisar políticas anônimas do QR, hoje amplas demais para produção
- decidir se IDs locais serão convertidos para UUID ou mapeados na importação

Não alterar enums existentes sem migração ordenada e testada.

## Relacionamentos

- todo dado comercial carrega `restaurant_id`
- perfil pertence a usuário e estabelecimento
- mesa pertence a estabelecimento
- comanda pode apontar para mesa
- pedido pertence a estabelecimento e comanda
- item pertence a pedido e produto, mantendo snapshot
- pagamento pertence a pedido
- movimento de estoque pertence a produto
- lançamento financeiro pode apontar para pedido, caixa ou despesa
- auditoria aponta para entidade e guarda antes/depois

## RLS por estabelecimento

Regra base para usuários autenticados:

```sql
restaurant_id = public.current_restaurant_id()
```

Permissões planejadas:

- dono: todos os dados do próprio estabelecimento
- gerente: operação, produtos, estoque e financeiro limitado
- garçom: mesas, comandas, pedidos e fechamento permitido
- cozinha: pedidos da cozinha e atualização de preparo
- bar: pedidos do bar e atualização de preparo
- caixa: caixa, pagamentos e fechamento

Operações sensíveis usam `with check`, não apenas `using`.

## QR anônimo

Não liberar leitura ampla apenas por `source = 'qr_code'` em produção.

Modelo recomendado:

1. QR contém token aleatório da mesa.
2. Edge Function valida token e estabelecimento.
3. Função cria sessão curta do cliente.
4. RPC cria pedido e itens em uma transação.
5. Cliente lê somente pedidos da própria sessão.
6. Chamados têm limite de frequência.

IDs previsíveis não servem como autorização.

## Realtime

Ativar somente onde existe ganho operacional:

- `order_items`: cozinha, bar e pronto para entregar
- `orders`: fechamento e estado
- `table_alerts`: chamou garçom e pediu conta
- `tables`: ocupação e liberação

Realtime informa uma mudança confirmada; não substitui transação.

## Auth real

Perfis:

- dono
- gerente
- garçom
- cozinha
- bar
- caixa

Fluxo:

1. dono convida usuário
2. Auth cria `auth.users`
3. função controlada cria vínculo em `profiles`
4. RLS usa o vínculo ativo
5. troca de estabelecimento exige vínculo explícito

Não armazenar senha demo em produção.

## Comandos que precisam de transação ou RPC

- abrir mesa e comanda
- criar pedido com itens
- enviar para preparo
- registrar pagamento
- fechar conta e liberar mesa
- cancelar item com motivo
- transferir ou juntar comandas
- abrir e fechar caixa
- registrar entrada de estoque
- baixar estoque por venda

Esses comandos não devem depender de várias gravações soltas do navegador.

## Ordem de migração

1. congelar versão do modelo local e criar testes de fluxo
2. criar migrações incrementais
3. alinhar enums e campos com `lib/types.ts`
4. criar Auth e perfis
5. aplicar RLS e testes por cargo
6. migrar estabelecimento, mesas, categorias e produtos
7. criar comandos transacionais de pedido e caixa
8. migrar operação e pagamentos
9. ativar Realtime
10. migrar financeiro, estoque e auditoria
11. executar piloto e plano de retorno

## Riscos

- IDs demo em texto não entram diretamente em UUID
- camelCase local e snake_case SQL exigem mapeamento
- pagamentos e fechamento precisam de idempotência
- dois aparelhos podem editar a mesma mesa ao mesmo tempo
- políticas de QR atuais permitem leitura anônima excessiva
- regras no cliente podem ser ignoradas por chamada direta
- seed de `auth.users` não deve ser processo de produção
- alteração de enum pode bloquear migração
- Realtime pode duplicar atualização visual

## SQL sugerido para futura migração

Não executado nesta rodada:

```sql
alter table public.products add column stock_unit text;
alter table public.financial_entries add column notes text;

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('entry', 'exit', 'adjustment')),
  quantity numeric(12,3) not null check (quantity > 0),
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
```

Transformar os exemplos em migrações versionadas, com RLS, índices e testes.

## Fiscal futuro

NFC-e não entra nesta migração inicial. Manter como integração separada, com provedor homologado, contingência, certificado seguro e auditoria própria.

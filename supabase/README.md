# Supabase — preparação local

## Ordem de aplicação

1. Criar o projeto Supabase.
2. Executar `schema.sql` uma única vez em projeto vazio.
3. Executar os arquivos de `migrations/` em ordem crescente.
4. Executar `seed.sql` para cadastrar o Boteco da Maricota, 15 mesas e o cardápio real.
5. Criar os usuários em Authentication.
6. Vincular cada usuário à tabela `profiles`.

O seed não grava senhas nem cria usuários diretamente em `auth.users`.

## Vincular o primeiro dono

Após criar o usuário no painel Authentication, execute substituindo o e-mail:

```sql
insert into public.profiles (user_id, restaurant_id, name, email, role)
select
  u.id,
  r.id,
  'Dono Maricota',
  u.email,
  'owner'::public.profile_role
from auth.users u
join public.restaurants r on r.slug = 'boteco-da-maricota'
where u.email = 'EMAIL_REAL_DO_DONO'
on conflict (user_id) do update set
  restaurant_id = excluded.restaurant_id,
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  active = true;
```

## Variáveis locais

```env
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Não colocar `service_role` em variável `NEXT_PUBLIC_*`.

## Segurança incluída

- RLS por estabelecimento.
- QR com token armazenado como hash.
- Sessão curta para cliente do QR.
- Limite de repetição para chamados.
- Leitura anônima ampla removida.
- Pedidos, pagamentos, fechamento, estoque e caixa via RPC transacional.
- Seed sem criação direta de senha.

## Comandos locais

```bash
npm run seed:generate
npm run check
npm audit
```

As migrações só podem ser validadas contra o banco real depois que o projeto Supabase existir.

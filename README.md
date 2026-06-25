# MesaY

Pedido, mesa e caixa no jeito.

PWA web para botecos, bares, restaurantes e atendimento no balcão. MVP mobile-first com mesas, comandas, pedidos, cozinha, bar, fechamento, financeiro, caixa, QR Code público e schema Supabase.

## Marca

- Nome oficial: **MesaY**
- Slogan oficial: **Pedido, mesa e caixa no jeito.**
- Conceito do símbolo: cloche/atendimento dentro de uma moldura de scan/QR, em azul marinho com laranja/dourado.
- Paleta: carvão `#111827`, laranja `#F59E0B`, verde `#10B981` e fundo `#FFF7ED`.
- Guia e arquivos de aplicação: [`BRAND_GUIDE.md`](BRAND_GUIDE.md) e `public/brand/`.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth/PostgreSQL/Realtime pronto via schema
- PWA com manifest e service worker
- Vercel-ready

## Rodar local

```bash
npm install
npm run dev
npm run dev:lan
npm run build
npm run lint
```

Abrir:

```text
http://localhost:3000/app/login
```

Para testar no celular, use `npm run dev:lan` e abra `http://SEU-IP:3000/app/login` na mesma rede.

## Usuários demo

Senha para todos:

```text
demo123
```

```text
dono@mesai.demo
garcom@mesai.demo
cozinha@mesai.demo
bar@mesai.demo
```

## Variáveis

Copiar `.env.example` para `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Sem Supabase configurado, o app roda em modo demo com `localStorage`.

## Demo

O laboratório inicial usa o preset `boteco_popular` com o estabelecimento demo Boteco da Maricota, Iguatu-CE.

## Supabase

1. Criar projeto Supabase.
2. Seguir [`supabase/README.md`](supabase/README.md).
3. Preencher `.env.local` somente depois de aplicar schema, migrações e seed.
4. Rodar `npm run check`.
5. Rodar `npm run dev`.

## Rotas principais

```text
/app/login
/app/dashboard
/app/tables
/app/tables/[id]
/app/orders/[id]
/app/kitchen
/app/bar
/app/checkout/[orderId]
/app/products
/app/finance
/app/cash
/app/settings
/app/settings/users
/app/settings/tables
/r/[restaurantSlug]/mesa/[tableId]
```

## Status

Planos de evolução:

- `ROADMAP_PRODUTO.md`
- `SUPABASE_PLANO.md`

Implementado:

- Login demo por cargo.
- Tela Agora para o dono.
- Mesas e comandas.
- Cardápio e categorias.
- Pedido com snapshot de nome/preço.
- Fila cozinha/bar.
- Status recebido, em preparo, pronto, entregue.
- Cancelamento de item com motivo.
- Transferência e junção de comandas.
- Fechamento com pagamento misto.
- Troco em dinheiro.
- Divisão por valor, item e igual.
- Financeiro com entradas, despesas, resultado e CSV.
- Estoque simples com quantidade, mínimo, unidade e ajuste manual.
- Caixa com abertura, sangria, suprimento, ajuste e fechamento.
- QR Code público por mesa.
- Presets de nicho em `lib/business-presets.ts`.
- PWA.
- Schema Supabase multiempresa com `restaurant_id`, RLS, índices e seed.

Pendente técnico:

- Aplicar e validar o backend preparado em um projeto Supabase real.
- Ativar o gateway Supabase na store após validar Auth e migrações.
- Ampliar os testes automatizados com integração contra o Supabase real.
- Criar impressão ESC/POS futura.
- Criar ficha técnica, baixa automática de estoque e fiado avançado.

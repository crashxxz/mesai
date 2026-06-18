# Mesaí - uso local

Mesaí é um sistema simples para pedidos, mesas e caixa.

Produto: Mesaí  
Slogan: Pedido, mesa e caixa no jeito.  
Preset atual: `boteco_popular`  
Demo/laboratório: Boteco da Maricota, Iguatu-CE

## Identidade da marca

A marca deve ser escrita sempre como **Mesaí**, com acento no `í`. O símbolo combina uma mesa vista de cima, um `M` sutil e um check de confirmação. Logo horizontal, versão compacta, símbolos claro/escuro e regras de uso estão em [`BRAND_GUIDE.md`](BRAND_GUIDE.md) e `public/brand/`.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000/app/login`.

Sem variáveis do Supabase, o app usa dados demo no `localStorage`. O schema do Supabase está em `supabase/schema.sql`, mas a store atual ainda roda em modo demo local.

## Usuários demo

Senha para todos: `demo123`

- Dono: `dono@mesai.demo`
- Garçom: `garcom@mesai.demo`
- Cozinha: `cozinha@mesai.demo`
- Bar: `bar@mesai.demo`

## Presets de nicho

A camada de presets fica em `lib/business-presets.ts`.

Ela centraliza textos, menus, atalhos, QR Code, empty states, sugestões de produtos, tom e pistas visuais por tipo de estabelecimento.

Perfis preparados:

- `boteco_popular`
- `restaurante`
- `bar_noturno`
- `hamburgueria`
- `pizzaria`
- `cafeteria`
- `lanchonete`
- `espetaria`
- `balcao`

## Como trocar tipo de estabelecimento

1. Entrar como Dono.
2. Abrir `Ajustes`.
3. Alterar `Tipo de estabelecimento`.

Por enquanto a troca fica no `localStorage` demo. Ela altera textos principais, menus, ações rápidas e linguagem do QR/dashboard. Persistência em Supabase fica para etapa real.

## Dados demo

Estabelecimento demo:

- Nome: Boteco da Maricota
- Cidade: Iguatu-CE
- WhatsApp: `+55 88 9629-8276`
- Link: `https://wa.me/558896298276`

Esses dados são demo/laboratório do preset `boteco_popular`, não nome fixo do produto.

## Testar no celular

1. Rodar `npm run dev:lan`.
2. Descobrir o IP do computador com `ipconfig`.
3. Abrir `http://SEU-IP:3000/app/login` no celular pela mesma rede.
4. Usar o QR em `Ajustes > Mesas e QR Codes` ou acessar `/r/boteco-da-maricota/mesa/table_2`.
5. Testar o fluxo pelo QR: escolher item, enviar pedido, chamar garçom e pedir conta.

## Guia rápido para ensinar o uso

### Dono

1. Ver movimento do dia em `Agora`.
2. Ver mesas em atendimento.
3. Conferir caixa.
4. Ver financeiro.
5. Alterar cardápio.

### Garçom

1. Abrir mesa.
2. Adicionar pedido.
3. Mandar para preparo.
4. Entregar pedido pronto.
5. Fechar conta.

### Cozinha

1. Ver pedidos novos.
2. Marcar preparando.
3. Marcar pronto.

### Bar

1. Ver bebidas novas.
2. Marcar preparando.
3. Marcar pronto.

### Cliente QR

1. Escanear QR.
2. Escolher item.
3. Enviar pedido.
4. Chamar garçom.
5. Pedir conta.

## Fluxo principal

1. Garçom abre mesa.
2. Garçom adiciona bebida.
3. Garçom adiciona comida.
4. Garçom manda para preparo.
5. Bar recebe bebida.
6. Cozinha recebe comida.
7. Bar marca pronto.
8. Cozinha marca pronto.
9. Garçom vê pronto para entregar.
10. Garçom fecha conta.
11. Dono vê entrada no financeiro.

## Completo por trás, simples na frente

Continuam existindo:

- mesas
- comandas
- pedidos
- cozinha
- bar
- QR Code
- cardápio
- caixa
- financeiro
- despesas e resultado do período
- estoque simples em `Cardápio > Estoque simples`
- usuários
- ajustes
- presets de nicho

Complexidade fica em `Mais opções`, `Ajustes` ou administração:

- estoque avançado
- variações
- adicionais
- taxas
- configurações técnicas
- relatórios detalhados

## O que ainda é localStorage/demo

- autenticação demo por cargo
- store local
- presets selecionados
- pedidos QR multiaparelho
- alertas do cliente QR
- dados do Boteco da Maricota
- despesas e movimentos de estoque
- link `mapsUrl` para habilitar o botão "Como chegar" no QR

O acesso ao `localStorage` fica isolado por `lib/storage-adapter.ts`. A interface continua usando a store; a troca futura para Supabase está detalhada em `SUPABASE_PLANO.md`.

## Falta para Supabase real

- trocar store demo por serviços Supabase reais
- Auth real
- Realtime cozinha/bar
- QR Code com pedido real multiaparelho
- políticas anon seguras para QR por mesa
- deploy com variáveis reais

## Próximas etapas

- testar fluxo real no celular
- conectar Supabase real
- implementar Auth real
- ligar Realtime cozinha/bar
- validar QR Code multiaparelho
- preencher `mapsUrl` do estabelecimento quando houver link de rota
- preparar deploy

O mapa completo de evolução está em `ROADMAP_PRODUTO.md`.

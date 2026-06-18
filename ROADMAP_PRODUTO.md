# Roadmap de Produto - Mesaí

## Direção

Mesaí deve atingir a completude operacional de um PDV profissional sem copiar interfaces e sem virar um ERP pesado.

Princípios:

- completo por trás, simples na frente
- ação principal primeiro
- complexidade em Mais opções e Ajustes
- regras críticas centralizadas antes da migração para banco real
- um produto, com linguagem e prioridades por tipo de estabelecimento
- fiscal somente planejado até existir parceiro, certificado e homologação

## Auditoria do estado atual

### Já existe

- login demo por cargo
- mesas, comandas e pedidos
- adicionais, variações e observações
- cozinha e bar com etapas e tempo
- pagamentos mistos, desconto e fechamento
- caixa com abertura, sangria, suprimento e diferença
- financeiro com entradas e exportação
- produtos, categorias, disponibilidade e estoque por produto
- QR sem login, chamado de garçom e pedido de conta
- auditoria local de ações operacionais
- tipos centrais em `lib/types.ts`
- schema Supabase com base multiestabelecimento e RLS

### Entregue nesta evolução

- persistência local atrás de `StorageAdapter`
- despesas locais com categoria, data, forma e observação
- resumo Entrou, Saiu e Resultado do período
- estoque simples recolhido no Cardápio, com estado em dia, baixo ou zerado
- histórico local de movimentos de estoque
- motivos rápidos para cancelamento de item
- auditoria de despesa, estoque, abertura e movimento de caixa
- metadados de evolução próprios para cada preset

### Lacunas técnicas

- `lib/store.tsx` ainda concentra regras, persistência e comandos
- operações de pedido e pagamento ainda não são transações de banco
- IDs demo são strings; o schema atual espera UUID
- estado local não sincroniza entre aparelhos
- baixa de estoque por venda ainda não está ligada a uma ficha técnica
- permissões futuras de gerente e caixa ainda não existem no app local
- schema e seed SQL ainda carregam dados antigos que precisam de migração controlada
- não há testes automatizados dos fluxos críticos

## Estratégia de presets

### Principal nesta fase

`boteco_popular` é o preset completo e validado. Prioriza mesas, cerveja, cozinha, bar, caixa e QR simples.

### Estruturados para evolução

- `restaurante`: salão, reservas, pratos e fechamento detalhado
- `pizzaria`: sabores, bordas, delivery e retirada
- `hamburgueria`: adicionais, combos, produção e balcão
- `lanchonete`: lanches, pedidos rápidos e retirada
- `cafeteria`: balcão, cafés, doces e fidelidade
- `bar_noturno`: comandas, drinks e controle de doses
- `espetaria`: churrasqueira, ponto da carne e mesas
- `balcao`: senha, pré-pagamento e retirada

Cada preset declara prioridades, categorias iniciais, fluxo principal e capacidades futuras. Esses dados não misturam regras na interface do boteco.

## 1. Atendimento

Atual: mesas, comandas, pedidos, QR e balcão básico.

Próximo:

- pedido de balcão sem mesa
- retirada com nome ou senha
- transferência e junção com transação no servidor

Futuro: delivery, reservas para restaurante e taxas por área.

## 2. Produção

Atual: cozinha, bar, recebido, preparando, pronto, entregue, tempo e atraso.

Próximo:

- impressão ou tela por setor
- prioridade manual
- histórico de tempo por produto

Futuro: ficha técnica, estações e previsão baseada no movimento.

## 3. Caixa e PDV

Atual: abertura, sangria, suprimento, fechamento, diferença, pagamentos mistos, desconto, serviço, consumo interno e cancelamento com motivo.

Próximo:

- perfil de caixa
- autorização para desconto e cancelamento
- conferência por forma de pagamento

Futuro: turno por operador, terminal, impressora e integração fiscal homologada.

## 4. Financeiro

Atual: entradas, despesas, resultado, formas, ticket médio e CSV.

Próximo: contas a pagar, despesas recorrentes e fechamento diário consolidado.

Futuro: fluxo projetado, centros de custo e conciliação.

## 5. Cardápio e produtos

Atual: categorias, produtos, disponibilidade, destino, tempo, variações e adicionais.

Próximo: custo, margem, ficha técnica e preço por tamanho.

Futuro: tabela de preço, combos por preset e importação de cardápio.

## 6. Estoque

Atual: quantidade, unidade, mínimo, estado, ajuste manual e histórico local.

Próximo:

- entrada de mercadoria com custo
- fornecedor
- inventário e ajuste com motivo

Futuro: baixa por ficha técnica, lote, validade e sugestão de compra.

## 7. Usuários e permissões

Atual: dono, garçom, cozinha e bar.

Próximo: gerente, caixa e permissões para desconto, cancelamento e relatórios.

Futuro: convite, histórico por operador e múltiplas unidades.

## 8. Clientes e QR

Atual: pedido sem app, WhatsApp, chamar garçom e pedir conta.

Próximo: token seguro por mesa, sessão por aparelho e aprovação opcional.

Futuro: avaliação, fidelidade e cadastro opcional com consentimento.

## 9. Fiscal futuro

Planejar, sem implementar nesta fase:

- NFC-e
- certificado digital
- CSC, série e ambiente
- NCM, CFOP, CST/CSOSN e impostos
- contingência, cancelamento e inutilização
- integração com provedor fiscal homologado

## 10. SaaS e produto alugável

Próximo: multiestabelecimento real, isolamento, onboarding, teste gratuito, planos, assinatura e limites.

Futuro: múltiplas unidades, cobrança automática e suporte com acesso auditado.

## Fases recomendadas

1. Consolidar MVP local, despesas, estoque e documentação.
2. Criar repositórios de domínio e `SupabaseAdapter` sem trocar a UI.
3. Migrar Auth, cadastros e leitura para Supabase.
4. Migrar comandos críticos com transações/RPCs.
5. Ativar Realtime para operação.
6. Fazer piloto controlado no Boteco da Maricota.
7. Preparar planos, assinatura e onboarding.
8. Avaliar integração fiscal separadamente.

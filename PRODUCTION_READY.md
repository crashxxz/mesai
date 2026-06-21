# Preparação para produção

## Pronto localmente

- modo demo preservado;
- configuração explícita `demo` ou `supabase`;
- gateway de Auth e RPCs Supabase;
- cargos dono, gerente, garçom, cozinha, bar e caixa;
- migrações incrementais com RLS;
- token e sessão segura para QR;
- RPCs de pedido, preparo, pagamento, fechamento, estoque e caixa;
- Realtime de pedidos, itens, mesas e alertas;
- seed real do Boteco da Maricota gerado a partir do catálogo local;
- testes automatizados do catálogo, domínio, permissões e contrato Supabase;
- auditoria npm sem vulnerabilidades conhecidas.

## Depende de acesso externo

- criar o projeto Supabase;
- aplicar schema, migrações e seed;
- criar usuários reais no Auth;
- informar URL e chave anônima;
- validar os RPCs no PostgreSQL real;
- testar Realtime e QR entre aparelhos;
- configurar domínio, backup e deploy.

## Limite atual

A interface continua usando o modo demo por padrão. O gateway Supabase e o backend estão preparados, mas a ativação definitiva deve ocorrer somente depois da aplicação e validação das migrações no projeto real.

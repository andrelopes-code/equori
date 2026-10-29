# Curadoria de clareza: transações

Tabela de curadoria (`2026-10-29-ui-clarity-design.md`, seção 5) das telas de transações em `21fadbc8`: lista (`/transactions`), detalhe (`/transactions/$id` e painel lateral) e nova transação (`/transactions/new`) nos tipos Despesa, Receita, Transferência e Avançado. Os formulários de Negociação, Rendimento, Compra no exterior e Câmbio entram na curadoria de investimentos.

Só constam os elementos que geram dúvida. Os textos em en são escritos na implementação a partir do texto pt-BR aprovado e revisados no diff.

## 1. Termo transversal: "lançamento"

Hoje "lançamento" nomeia duas coisas: a linha contábil de uma transação (partida) e a própria transação ("Novo lançamento", "Todos os lançamentos das suas contas", "Lançada à mão"). Proposta: "transação" é a unidade para quem usa o app; "lançamento" só aparece no tipo Avançado, que já define o termo (`detail.postingsHelp`).

| Chave | Hoje | Proposta |
|---|---|---|
| `nav.entry.long` (menu lateral, paleta) | Novo lançamento | Nova transação |
| `transactions.subtitle` | Todos os lançamentos das suas contas, dos mais recentes aos mais antigos. | Todas as transações das suas contas, das mais recentes às mais antigas. |
| `origin.manual` | Lançada à mão | Registrada à mão |
| `origin.system` | Lançada pelo sistema | Criada automaticamente |
| `facts.tagsHelp` | … Um lançamento pode ter vários. | … Uma transação pode ter várias. |

## 2. Lista

| Elemento | Remédio | Critério | Proposta |
|---|---|---|---|
| Busca: "Buscar descrição, favorecido ou memo" | Renomear | "memo" é termo técnico | Buscar descrição, favorecido ou observação |

"Resultado" no resumo do período fica: o vizinho "Entradas" e "Saídas" já o explica, e o termo é o mesmo dos relatórios.

## 3. Detalhe

### 3.1 Seção "Lançamentos"

Hoje a tabela mostra todas as partidas, inclusive a da categoria. Uma compra de 230 no cartão aparece como duas linhas: o cartão com −230 e "Alimentação" com +230. O sinal positivo na categoria se lê como dinheiro recebido. A categoria e a divisão entre categorias já aparecem na seção "Categoria".

| Elemento | Remédio | Critério | Proposta |
|---|---|---|---|
| Linhas de categoria na tabela | Remover | repetem a seção "Categoria" com sinal que confunde | a tabela mostra só contas (bancos, cartões, reservas, dívidas) |
| Título da seção `detail.postings` | Renomear | termo técnico | Contas movimentadas |
| Legenda `postings.caption` | Renomear | idem | Contas movimentadas pela transação |
| Coluna "Liquidado em" | Renomear | termo técnico | Efetivado em |
| Coluna "Memo" | Renomear | termo técnico | Observação |
| Situação "Compensado" | Renomear | sentido técnico diferente do comum | Efetivado |
| Situação "Conciliado" | Renomear | termo técnico | Conferido com o extrato |

"Pendente" fica. Com os três nomes acima, os estados se explicam sem legenda.

### 3.2 Fatos

| Elemento | Remédio | Critério | Proposta |
|---|---|---|---|
| "Versão" | Remover | repete a seção "Histórico" ("Versão atual (n)") | sem o fato |
| "Categorizada por: O histórico do favorecido" (`method.history`) | Renomear | o sentido não se deduz | Transações anteriores do mesmo favorecido |

### 3.3 Categoria

| Elemento | Remédio | Critério | Proposta |
|---|---|---|---|
| `detail.category.none`: "Esta transação não tem lado de categoria." | Renomear | "lado de categoria" é termo do modelo | Esta transação só move dinheiro entre suas contas, por isso não tem categoria. |

### 3.4 Reembolso: um conceito, um nome

Hoje o mesmo vínculo tem dois nomes. Numa despesa: "Registrar reposição". Numa receita: "Marcar como reembolso". Proposta: "reembolso" nos dois lados; "reposição", "repor" e "alocar" saem.

| Chave | Hoje | Proposta |
|---|---|---|
| `detail.repay`, `repayment.title`, `repayment.submit` | Registrar reposição | Registrar reembolso recebido |
| `repayment.description` | Escolha a transação de entrada que repôs esta despesa e o valor. Os outros reembolsos dela continuam como estão. | Escolha o recebimento que reembolsou esta despesa e o valor. Os outros reembolsos desse recebimento continuam como estão. |
| `repayment.sources` | Transações de entrada | Recebimentos |
| `repayment.empty` | Nenhuma transação de entrada dos próximos 90 dias tem valor livre. | Nenhum recebimento dos próximos 90 dias tem valor livre. |
| `repayment.amount` | Valor reposto | Valor reembolsado |
| `repayment.done` | Reposição registrada | Reembolso registrado |
| `reimbursement.description` | Marque as despesas que esta transação repõe e o valor de cada uma. O que não for alocado continua como receita. | Marque as despesas que esta transação reembolsa e o valor de cada uma. O que não for distribuído continua como receita. |
| `reimbursement.totals` | Alocado {allocated} de {total} · Sobra {leftover} | Distribuído {allocated} de {total} · Sobra {leftover} |
| `reimbursement.prompt` | Isto repõe despesas recentes? | Isto reembolsa despesas recentes? |
| `reimbursement.categoryHint` | Vazio mantém as categorias. Uma categoria move cada despesa marcada e o seu reembolso para ela. | Vazio mantém as categorias atuais. Com uma categoria escolhida, as despesas marcadas e o reembolso passam para ela. |

"Distribuído" é o termo da divisão entre categorias (`detail.category.balanced`, `detail.category.remaining`).

### 3.5 Transferência

| Elemento | Remédio | Critério | Proposta |
|---|---|---|---|
| `transfer.description`: "O lado de categoria vira um lançamento na conta abaixo. Quando essa conta tem o outro lado importado, os dois são pareados." | Renomear | três termos do modelo | Esta transação deixa de ser despesa ou receita e passa a mover dinheiro para a conta abaixo. Se essa conta já tem a transação correspondente importada, as duas viram uma só. |

A última frase segue `docs/domain/03-domain-flows.md` (`TransactionTransferred`): no pareamento, uma transação fica com as duas partidas e a outra é anulada.

## 4. Nova transação

| Elemento | Remédio | Critério | Proposta |
|---|---|---|---|
| Tipo "Avançado", dica "Vários lançamentos" | Renomear a dica | termo técnico | Várias contas e categorias na mesma transação |
| Tipo "Negociação", dica "Compra ou venda de ativo" | Renomear | "negociação" e "ativo" são termos de mercado | rótulo: Compra ou venda de investimento; dica: Ações, fundos, títulos |
| Tipo "Rendimento", dica "Pago por um ativo" | Renomear a dica | "ativo" é termo de mercado | Dividendos ou juros de um investimento |
| `facts.payeeHelp`, segunda frase: "Agrupa o que você gasta ou recebe por com quem foi." | Renomear | frase truncada | Serve para encontrar tudo o que foi gasto ou recebido com a mesma loja ou pessoa. |
| Avançado: "Memo" (`entry.row.memo`, `entry.row.memoPlaceholder`) | Renomear | termo técnico; mesmo termo do detalhe | Observação |

"Lançamentos" e "Patrimônio" no editor do tipo Avançado ficam: o tipo é para quem conhece partidas dobradas, e `detail.postingsHelp` define o termo.

## 5. Mudanças de comportamento

Duas propostas mudam o que a tela desenha, não só o texto; cada uma começa por um teste que falha sem ela:

1. A tabela de contas movimentadas omite as partidas de categoria (3.1).
2. Os fatos omitem "Versão" (3.2).

## 6. Slotted

Nenhuma proposta usa ajuda em cabeçalho de `Table` ou em `StatCard`. Nenhuma issue é aberta.

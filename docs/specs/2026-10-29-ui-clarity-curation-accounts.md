# Curadoria de clareza: contas

Tabela de curadoria (`2026-10-29-ui-clarity-design.md`, seção 5) das telas de contas em `90c14dcf`: lista (`/accounts`), página da conta (extrato, conferência, importações), importação de extrato, resultado da importação, vínculos e sincronização. Só constam os elementos que geram dúvida. Os textos em en são decididos na implementação (design, seção 6, item 5) e ficam no diff.

## 1. Termos transversais

| Conceito | Hoje (pt-BR) | Proposta (pt-BR) | Critério |
|---|---|---|---|
| O conjunto dos registros do app | "o livro" | "seus registros" | termo de contabilidade |
| Comparar o saldo do app com o da instituição | "reconciliação", "reconciliar", "reconciliada" | "conferência", "conferir", "conferida" | termo de contabilidade; "conferir" é palavra do dia a dia |
| Linha importada que corresponde a uma transação existente | "conciliar", "conciliada" | "associar", "associada" | termo de contabilidade; "conciliar" se confundia com a conferência de saldo |
| Valor já confirmado pela instituição | "liquidado" | "efetivado" | mesmo termo da situação da transação (curadoria de transações, 3.1) |
| Registro de uma transação | "lançamento", "lançar" | "transação", "registrar" | curadoria de transações, seção 1 |
| Ativos e passivos | "Ativos", "Passivos" | "Você tem", "Você deve" | termo de contabilidade; o subtítulo da página já diz "O que você tem e o que deve" |

A situação de transação "Conferido com o extrato" passa a "Conferido": a conferência também usa saldo digitado, não só extrato, e o nome agora é o da aba.

Em en, "reconcile" e "match" ficam: são os termos de uso comum em apps de finanças em inglês. Saem "ledger", "settled" (vira "cleared", como a situação da transação), "Assets"/"Liabilities" e "entry".

## 2. Regiões

| Elemento | Problema | Proposta |
|---|---|---|
| "Open Finance" em 7 textos (`balanceSheet.emptyHint`, `links.subtitle`, `links.empty`, `reconciliation.source.aggregator`, `imports.source.aggregator`, `problem.integration_unavailable`) | nome do sistema de dados abertos do Brasil, mostrado a usuários de qualquer país | "conexão bancária", "sincronização bancária" |
| `sync.notSynced`, `sync.provider.LOGIN_ERROR`, `OUTDATED`, `WAITING_USER_INPUT` citam "Meu Pluggy" | nome do portal de um agregador, fixo no catálogo | fica nesta rodada. O nome do portal pertence à implementação do agregador (ponto de extensão Aggregator); a correção é o agregador informar o nome e o catálogo usar `{portal}`. Registrado como pendência |
| "10 MiB" | unidade técnica | "10 MB" (10 MiB são 10,49 MB; o texto fica mais restrito que o limite real) |

## 3. Lista de contas

| Elemento | Remédio | Proposta |
|---|---|---|
| Indicadores "Ativos", "Passivos" | Renomear | Você tem, Você deve |
| Rótulo acessível `balanceSheet.figures` "Indicadores do balanço" | Renomear | Resumo das contas |
| Controle "Base do saldo": "Saldo" / "Liquidado" | Renomear | rótulo: Saldo considerado; opções: Com pendentes / Só efetivado |
| Coluna "Reconciliação" e etiquetas "Nunca reconciliada", "Reconciliada em {date}" | Renomear | Conferência; Nunca conferida; Conferida em {date} |
| "{count} contas externas aguardam vínculo" | Renomear | {count} contas da conexão aguardam vínculo |

## 4. Página da conta

| Elemento | Remédio | Proposta |
|---|---|---|
| Nota do saldo "Lançado até hoje" | Renomear | Tudo o que foi registrado até hoje |
| "{amount} liquidado" | Renomear | {amount} efetivado |
| "{count} lançamentos agendados até {date}" | Renomear | {count} transações agendadas até {date} |
| "Última reconciliação"; "O saldo da instituição bateu com o livro" | Renomear | Última conferência; O saldo da instituição bateu com seus registros |
| Ações "Registrar saldo", "Reabrir reconciliação", "Registrar negociação" | Renomear | Conferir saldo; Reabrir conferência; Registrar compra ou venda |
| Extrato: colunas "Contrapartida", "Variação" | Renomear | Categoria ou conta; Valor |
| `ledger.balanceNote` (27 palavras, uma frase) | Reescrever | O saldo após cada movimento parte do saldo no fim do período e volta um movimento por vez. Um movimento anulado não muda o saldo. |
| `ledger.parentNote` | Reescrever | Esta conta soma as contas dentro dela. O saldo após cada movimento aparece na página de cada uma. |

### 4.1 Aba e diálogos de conferência

| Chave | Proposta |
|---|---|
| `account.tab.reconciliation`, `reconciliation.title` | Conferência de saldo |
| `reconciliation.never` | Nunca conferida: registre o saldo que a instituição mostra para comparar. |
| `reconciliation.lastOn` | Conferida até {date} |
| `reconciliation.record` | Registrar saldo da instituição |
| `reconciliation.formTitle` | Saldo da instituição |
| `reconciliation.formHint` | O saldo que a instituição mostra para esta conta numa data. Se for diferente do seu, a diferença vira rendimento, ajuste ou uma pendência a resolver. |
| `reconciliation.amountHint` | A comparação usa o saldo efetivado no fim da data. |
| `reconciliation.submit` | Comparar saldos |
| `reconciliation.result.*` | "A conta está reconciliada." → "A conta está conferida." |
| `reconciliation.openHint` | Registre as transações que faltam e confirme, ou registre a diferença como rendimento ou ajuste. |
| `reconciliation.resolve.adjustment`, `.yield`, `.added` | Registrar ajuste de {amount}; Registrar rendimento de {amount}; Já registrei o que faltava |
| `reconciliation.remains` | O saldo ainda difere em {amount}. (a segunda frase, "Situação lida de novo.", não informa nada) |
| `reconciliation.history`, `reconciliation.reported`, `reconciliation.historyEmpty` | Saldos da instituição; Saldo da instituição; Nenhum saldo da instituição registrado ainda. |
| `reconciliation.unconfirmed`, `.unconfirmedEmpty`, `.unconfirmedNote` | Transações sem confirmação; Toda transação do período aparece no extrato da instituição.; Estas transações não aparecem no extrato da instituição. Uma transação duplicada ou digitada errada se resolve anulando ou corrigindo. Uma transação correta se confirma quando o saldo da instituição bate. |
| `unlock.title`, `unlock.hint`, `unlock.consequence`, `unlock.done` | Reabrir a conferência de {name}; Reabrir permite corrigir de novo transações já conferidas.; Transações efetivadas a partir de {date} deixam de estar conferidas, e as conferências desde essa data são apagadas.; Conferência reaberta |
| `problem.already_reconciled` | Esta fatura já está conferida. |
| `reconcileStatement.hint` | O total nos seus registros é {amount}. Digite o total que a fatura da instituição mostra. |

## 5. Importação

| Elemento | Remédio | Proposta |
|---|---|---|
| `importFile.subtitle`, `importFile.subtitleOf` | Renomear | Um arquivo OFX ou CSV do banco, comparado com o que você já registrou.; Em {name}: cada linha é comparada com o que você já registrou. |
| Estado de linha "Conciliada"; ação "Conciliar com esta transação" | Renomear | Associada; É esta transação |
| "Candidatas ({count})" | Renomear | Transações parecidas ({count}) |
| `batch.bands` | Reescrever | Com {link} pontos ou mais, a linha é associada sozinha. A partir de {review} pontos, ela espera sua revisão. |
| `batch.note.matched`, `batch.note.discarded`, `batch.reviewDoneHint` | Renomear | Associadas a uma transação que você já tinha; Ficaram fora dos seus registros; Cada linha desta importação encontrou seu lugar. |
| `batch.balance.recorded` | Renomear | O saldo do arquivo, {amount} em {date}, foi registrado como saldo da instituição. |
| `sync.result` | Renomear | {created} criadas e {matched} associadas nesta conta. |
| `sync.stopHint`, `links.deleteHint` | Renomear | "continua no livro" → "continua nos seus registros" |

O perfil de leitura do CSV (separador, linhas de cabeçalho, formato da data) fica: quem chega a ele já tem o arquivo e o controle mostra as primeiras linhas como serão lidas.

## 6. Vínculos

| Elemento | Remédio | Proposta |
|---|---|---|
| `links.chooseAccount` "Conta do livro que ela alimenta" | Renomear | Sua conta que recebe as transações dela |
| `links.subtitle` | Renomear | Contas que suas conexões bancárias trazem e as suas contas que recebem as transações delas. |

## 7. Formulário de conta

| Elemento | Remédio | Proposta |
|---|---|---|
| `accountForm.openedOnHint` | Renomear | O primeiro dia que o equori acompanha esta conta. O saldo inicial fica nessa data. |
| `accountForm.openingHint` | Renomear | Registrado contra Saldos iniciais, para seus registros partirem do que a instituição mostra. |
| `accountForm.openingHelp` | Renomear | O saldo da conta, ou o valor devido nela, no dia em que o equori começa a acompanhá-la. |

## 8. Fora desta rodada

Posições de investimento, agendamentos da conta, instituições e configuração do cartão entram nas curadorias de investimentos, planejamento e cartões.

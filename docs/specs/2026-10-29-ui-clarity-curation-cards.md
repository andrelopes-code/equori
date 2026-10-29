# Curadoria de clareza: cartões

Tabela de curadoria (`2026-10-29-ui-clarity-design.md`, seção 5) das telas de cartões em `15f3ddbe`: lista (`/cards`), página do cartão (faturas, parcelamentos, cartões, configuração) e fatura (`/cards/$accountId/statements/$statementId`). Os termos transversais das curadorias de transações (seção 1) e de contas (seção 1) se aplicam.

As telas de cartões já usam o vocabulário do dia a dia: fatura, fechamento, vencimento, parcela, estorno, contestação, limite livre, faturado, a faturar. Esses termos ficam.

| Elemento | Remédio | Critério | Proposta |
|---|---|---|---|
| "Reconciliar a fatura", "Reconciliar", "Reconciliada", "Fatura reconciliada" | Renomear | termo transversal (contas, 1) | Conferir a fatura; Conferir; Conferida; Fatura conferida |
| "Lançamentos da fatura", "Nenhum lançamento nesta fatura." | Renomear | termo transversal (transações, 1) | Transações da fatura; Nenhuma transação nesta fatura. |
| `statement.proposal.description`, `statement.rounding`, `reconcileStatement.differs`, `statement.unconfirmedMatches`, `statement.unconfirmedHelp`, `card.committedNote` | Renomear | "lançamento" e "lançar" | "transação" e "registrar" |
| `pay.hint`: "O pagamento sai de uma conta de saldo e entra na próxima fatura." | Reescrever | "conta de saldo" é termo do modelo; "entra" não diz que abate | O pagamento sai de uma das suas contas e aparece como crédito na próxima fatura. |
| `facts.moveHint`: "…sobre os do provedor." | Renomear | "provedor" é termo de integração | …sobre os da conexão bancária. |

Em en, "Reconcile" fica (contas, 1); "entry" vira "transaction"; "balance account" e "provider" saem pelos mesmos motivos.

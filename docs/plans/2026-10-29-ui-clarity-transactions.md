# Clareza das telas de transações: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a tabela de curadoria das telas de transações.

**Architecture:** Textos mudam nos catálogos pt-BR e en. Duas mudanças de desenho: o detalhe omite as partidas de categoria da tabela de contas e omite o fato "Versão".

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Slotted.

**Spec:** `docs/specs/2026-10-29-ui-clarity-curation-transactions.md`, sob `docs/specs/2026-10-29-ui-clarity-design.md`.

## Global Constraints

- Textos só em `web/src/i18n/catalog.pt-BR.ts` e `catalog.en.ts` (O6).
- `detail.postings` continua sendo o rótulo do editor do tipo Avançado e de `correction-conflict.tsx`; o detalhe passa a usar uma chave nova.
- Um teste muda só quando a curadoria muda o comportamento; o corpo do commit cita a seção da curadoria.
- Commits por caminho, sem `git add -A`.

## Review Focus

- Transação cujas partidas são todas de categoria: a seção de contas não aparece (Task 2).
- Contagem da seção: igual ao número de linhas mostradas, não ao total de partidas (Task 2).
- `posting.status.*` também aparece no extrato de conta (`accounts/account-ledger*.tsx`): os testes de `accounts` passam com os nomes novos (Task 1).

---

### Task 1: Textos

**Files:**
- Modify: `web/src/i18n/catalog.pt-BR.ts`, `web/src/i18n/catalog.en.ts`
- Test: `web/src/features/transactions/reimbursement-dialog.test.tsx:80`

- [ ] **Step 1:** Aplicar em pt-BR os textos das seções 1, 2, 3.2 (`method.history`), 3.3, 3.4, 3.5 e 4 da curadoria, e `postings.settled`, `postings.memo`, `posting.status.cleared`, `posting.status.reconciled` da seção 3.1.
- [ ] **Step 2:** Aplicar em en os equivalentes:

| Chave | en |
|---|---|
| `transactions.subtitle` | Every transaction of your accounts, newest first. |
| `origin.system` | Created automatically |
| `transactions.search` | Search description, payee or note |
| `postings.settled` | Cleared on |
| `postings.memo` | Note |
| `posting.status.reconciled` | Checked against statement |
| `method.history` | Earlier transactions with the same payee |
| `detail.category.none` | This transaction only moves money between your accounts, so it has no category. |
| `detail.repay`, `repayment.title`, `repayment.submit` | Record reimbursement received |
| `repayment.description` | Choose the payment received that reimbursed this expense and the amount. Its other reimbursements stay as they are. |
| `repayment.sources` | Payments received |
| `repayment.empty` | No payment received in the next 90 days has an amount free. |
| `repayment.amount` | Amount reimbursed |
| `repayment.done` | Reimbursement recorded |
| `reimbursement.description` | Check the expenses this transaction reimburses and the amount of each. What is not distributed stays as income. |
| `reimbursement.totals` | Distributed {allocated} of {total} · Left {leftover} |
| `reimbursement.prompt` | Does this reimburse recent expenses? |
| `reimbursement.categoryHint` | Empty keeps their current categories. With a category chosen, the checked expenses and the reimbursement move to it. |
| `transfer.description` | This transaction stops being an expense or income and moves money to the account below. If that account already holds the matching imported transaction, the two become one. |
| `entry.kindHint.advanced` | Several accounts and categories in one transaction |
| `entry.kind.trade` | Buy or sell an investment |
| `entry.kindHint.trade` | Stocks, funds, bonds |
| `entry.kindHint.investment_income` | Dividends or interest from an investment |
| `facts.payeeHelp` | The shop, company or person the money went to or came from. It finds everything spent or received with the same shop or person. |
| `entry.row.memo` | Note of posting {index} |
| `entry.row.memoPlaceholder` | Note |

`nav.entry.long`, `origin.manual`, `facts.tagsHelp` e `posting.status.cleared` já dizem o mesmo em en e ficam.

- [ ] **Step 3:** Atualizar `reimbursement-dialog.test.tsx:80` para `"Distributed R$100.00 of R$100.00 · Left R$0.00"`.
- [ ] **Step 4:** `cd web && pnpm vitest run src/features/transactions src/features/accounts` — todos passam. Um teste que falhar por texto antigo em en é atualizado só se a chave consta da tabela acima.
- [ ] **Step 5:** Commit `fix(web): use plain words on the transaction screens`, corpo citando as seções 1 a 4 da curadoria.

### Task 2: Contas movimentadas sem as partidas de categoria

**Files:**
- Modify: `web/src/features/transactions/transaction-detail.tsx:274-285`, catálogos (`detail.accounts`)
- Test: `web/src/features/transactions/transaction-detail.test.tsx:159`

**Interfaces:**
- Produces: chave `detail.accounts` = "Contas movimentadas" / "Accounts involved"; `postings.caption` = "Contas movimentadas pela transação" / "Accounts involved in the transaction".

- [ ] **Step 1:** No teste "shows the transaction as a page…", trocar `expect(within(postings).getByText("Mercado"))` por `expect(within(postings).queryByText("Mercado")).not.toBeInTheDocument()` e conferir a região pelo nome `catalogEn["detail.accounts"]` com contagem 1.
- [ ] **Step 2:** Rodar o teste; falha porque "Mercado" aparece.
- [ ] **Step 3:** Em `transaction-detail.tsx`, derivar `accountPostings = tx.postings.filter((p) => !categories.has(p.account_id))`; a seção usa `detail.accounts`, conta `accountPostings.length` e só é desenhada quando `accountPostings.length > 0`.
- [ ] **Step 4:** Rodar os testes de `src/features/transactions`; passam.
- [ ] **Step 5:** Commit `fix(web): list only accounts in a transaction's moved accounts`, corpo citando a seção 3.1.

### Task 3: Fatos sem "Versão"

**Files:**
- Modify: `web/src/features/transactions/transaction-facts.tsx:80-85`, catálogos (remover `facts.version`)
- Test: `web/src/features/transactions/transaction-facts.test.tsx`

- [ ] **Step 1:** Teste `it("leaves the version to the history section")`: renderiza os fatos de uma transação simples e espera `queryByText(catalogEn["facts.version"])` ausente — escrito antes de remover a chave, com o texto literal `"Version"` como termo da lista de descrição.
- [ ] **Step 2:** Rodar; falha.
- [ ] **Step 3:** Remover o item e a chave `facts.version` dos dois catálogos.
- [ ] **Step 4:** Rodar os testes de `src/features/transactions`; passam. Rodar `make web-check`; passa.
- [ ] **Step 5:** Commit `fix(web): leave a transaction's version to its history`, corpo citando a seção 3.2.

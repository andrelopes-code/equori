import type { Catalog } from "@/i18n/catalog.en";

export const catalogPtBR: Catalog = {
  "nav.home": "Início",
  "common.selected": "{count} selecionados",
  "problem.invalid_credentials": "E-mail ou senha incorretos.",
  "problem.too_many_attempts": "Muitas tentativas. Tente novamente mais tarde.",
  "problem.unauthenticated": "A sessão terminou. Entre novamente.",
  "problem.not_found": "O item solicitado não existe.",
  "problem.validation_failed": "Os dados não passaram na validação.",
  "problem.internal_error": "Ocorreu um erro interno. Tente novamente.",
  "problem.server_busy":
    "O servidor está ocupado. Tente novamente em instantes.",
  "problem.invalid_account": "A conta não é válida para esta operação.",
  "problem.version_conflict":
    "O registro foi alterado em outro lugar. Recarregue e tente novamente.",
  "problem.transaction_voided":
    "A transação está anulada e não pode ser alterada.",
  "problem.posting_reconciled":
    "A transação tem lançamentos conciliados e não pode ser alterada.",
  "problem.account_not_empty":
    "A conta tem saldo ou lançamentos após a data de encerramento e não pode ser encerrada.",
  "problem.settings_locked":
    "As configurações não podem ser alteradas após a primeira transação.",
  "problem.mixed_instruments":
    "A conta e suas subcontas contêm mais de um instrumento.",
  "problem.invalid_request": "A requisição não é válida.",
};

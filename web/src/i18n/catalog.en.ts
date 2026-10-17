export const catalogEn = {
  "nav.home": "Home",
  "nav.label": "Main navigation",
  "nav.transactions": "Transactions",
  "nav.new": "New transaction",
  "nav.accounts": "Accounts",
  "nav.more": "More",
  "more.title": "More",
  "more.settings": "Settings",
  "more.scheme": "Colour scheme",
  "more.language": "Language",
  "more.logout": "Log out",
  "login.title": "Sign in",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Sign in",
  "scheme.dark": "Dark",
  "scheme.light": "Light",
  "scheme.system": "System",
  "locale.en": "English",
  "locale.pt-BR": "Português (Brasil)",
  "common.selected": "{count} selected",
  "problem.invalid_credentials": "The email or password is incorrect.",
  "problem.too_many_attempts": "Too many attempts. Try again later.",
  "problem.unauthenticated": "The session has ended. Sign in again.",
  "problem.not_found": "The requested item does not exist.",
  "problem.validation_failed": "The data failed validation.",
  "problem.internal_error": "An internal error occurred. Try again.",
  "problem.server_busy": "The server is busy. Try again shortly.",
  "problem.invalid_account": "The account is not valid for this operation.",
  "problem.version_conflict":
    "The record was changed elsewhere. Reload and try again.",
  "problem.transaction_voided":
    "The transaction is voided and cannot be changed.",
  "problem.posting_reconciled":
    "The transaction has reconciled postings and cannot be changed.",
  "problem.account_not_empty":
    "The account has a balance or postings after the closing date and cannot be closed.",
  "problem.settings_locked":
    "The settings cannot be changed after the first transaction.",
  "problem.mixed_instruments":
    "The account and its sub-accounts hold more than one instrument.",
  "problem.invalid_request": "The request is not valid.",
} as const;

export type Catalog = { [K in keyof typeof catalogEn]: string };
export type MessageKey = keyof Catalog;

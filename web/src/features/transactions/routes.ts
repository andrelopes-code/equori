import { lazyRouteComponent } from "@tanstack/react-router";

export {
  validateNewTransactionSearch,
  validateTransactionsPageSearch,
  validateCaptureSearch,
} from "@/features/transactions/model/search";
export { isBuiltKind } from "@/features/transactions/entry-model/entry-kind";
export { CapturePage } from "@/features/transactions/pages/capture-page";
export { OfflinePage } from "@/features/transactions/pages/offline-page";
export { CaptureQueuePage } from "@/features/transactions/pages/capture-queue-page";
export type { BuiltKind } from "@/features/transactions/entry-model/entry-kind";

export const NewTransactionPage = lazyRouteComponent(
  () => import("@/features/transactions/pages/new-transaction-page"),
  "NewTransactionPage",
);

export const TransactionsPage = lazyRouteComponent(
  () => import("@/features/transactions/pages/transactions-page"),
  "TransactionsPage",
);

export const CorrectTransactionPage = lazyRouteComponent(
  () => import("@/features/transactions/pages/correct-transaction-page"),
  "CorrectTransactionPage",
);

export const TransactionPage = lazyRouteComponent(
  () => import("@/features/transactions/pages/transaction-page"),
  "TransactionPage",
);

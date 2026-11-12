import type { components } from "@/api/schema.gen";
import { AccountDetailsSection } from "@/features/accounts/account-form/account-details-section";
import type { AccountDraft } from "@/features/accounts/model/account-draft";
import { AccountIdentitySection } from "@/features/accounts/account-form/account-identity-section";
import { classOf } from "@/features/accounts/model/account-kinds";
import { CashModeField } from "@/features/accounts/account-form/cash-mode-field";
import { defaultCashMode } from "@/features/accounts/model/cash-mode";
import { AccountOpeningSection } from "@/features/accounts/account-form/account-opening-section";
import { CardSetupSection } from "@/features/accounts/card-setup/card-setup-section";
import { parentCandidates } from "@/features/accounts/account-form/parent-candidates";

type Account = components["schemas"]["Account"];

interface AccountFormProps {
  mode: "create" | "edit";
  draft: AccountDraft;
  onChange: (next: AccountDraft) => void;
  onChangeKind?: () => void;
  accounts: readonly Account[];
  // The base currency, which an account of the institution must hold to pay for a brokerage;
  // only the create form reads it.
  base?: string;
  editingId?: string;
  currencies: readonly string[];
  scale: (code: string) => number;
  errors: Record<string, string>;
}

// The fields of an account, keyed by the request's field names (FM-02). Create adds the opening
// balance and, for a card, its setup; edit shows kind and currency read only (FM-04).
export function AccountForm({
  mode,
  draft,
  onChange,
  onChangeKind,
  accounts,
  base,
  editingId,
  currencies,
  scale,
  errors,
}: AccountFormProps) {
  const kind = draft.kind ?? "checking";
  const parents = parentCandidates(accounts, classOf(kind), editingId);

  const showOpening =
    mode === "create" &&
    (kind !== "brokerage" || draft.cashMode !== "institution");

  // BC16: the choice follows the institution's accounts until the reader makes one.
  const patch = (next: Partial<AccountDraft>) => {
    const institutionChanged =
      base !== undefined &&
      ("institutionId" in next || "pendingInstitution" in next);
    const institutionId =
      "institutionId" in next ? next.institutionId : draft.institutionId;
    onChange({
      ...draft,
      ...next,
      ...(institutionChanged && {
        cashMode: defaultCashMode(accounts, institutionId, base),
      }),
    });
  };

  return (
    <>
      <AccountIdentitySection
        mode={mode}
        kind={kind}
        draft={draft}
        onPatch={patch}
        onChangeKind={onChangeKind}
        errors={errors}
      />

      <AccountDetailsSection
        mode={mode}
        kind={kind}
        draft={draft}
        onPatch={patch}
        parents={parents}
        accounts={accounts}
        currencies={currencies}
        errors={errors}
      />

      {mode === "create" && base !== undefined && (
        <CashModeField
          draft={draft}
          accounts={accounts}
          base={base}
          onChange={(cashMode) => {
            patch({ cashMode });
          }}
        />
      )}

      {showOpening && (
        <AccountOpeningSection
          kind={kind}
          value={draft.opening}
          onChange={(opening) => {
            patch({ opening });
          }}
          currency={draft.currency}
          scale={scale(draft.currency)}
        />
      )}

      {mode === "create" && kind === "credit_card" && (
        <CardSetupSection
          value={draft.card}
          onChange={(card) => {
            patch({ card });
          }}
          errors={errors}
          currency={draft.currency}
          scale={scale(draft.currency)}
        />
      )}
    </>
  );
}

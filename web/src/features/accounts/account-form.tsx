import type { components } from "@/api/schema.gen";
import { AccountDetailsSection } from "@/features/accounts/account-details-section";
import type { AccountDraft } from "@/features/accounts/account-draft";
import { AccountIdentitySection } from "@/features/accounts/account-identity-section";
import { classOf } from "@/features/accounts/account-kinds";
import { AccountOpeningSection } from "@/features/accounts/account-opening-section";
import { CardSetupSection } from "@/features/accounts/card-setup-section";
import { parentCandidates } from "@/features/accounts/parent-candidates";

type Account = components["schemas"]["Account"];

interface AccountFormProps {
  mode: "create" | "edit";
  draft: AccountDraft;
  onChange: (next: AccountDraft) => void;
  onChangeKind?: () => void;
  accounts: readonly Account[];
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
  editingId,
  currencies,
  scale,
  errors,
}: AccountFormProps) {
  const kind = draft.kind ?? "checking";
  const parents = parentCandidates(accounts, classOf(kind), editingId);

  const patch = (next: Partial<AccountDraft>) => {
    onChange({ ...draft, ...next });
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

      {mode === "create" && (
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

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Stack } from "@slotted/react/stack";
import { Switch } from "@slotted/react/switch";
import { TextField } from "@slotted/react/text-field";

import type { components } from "@/api/schema.gen";
import type { AccountDraft } from "@/features/accounts/account-draft";
import {
  classOf,
  liquidCapable,
  yieldCapable,
} from "@/features/accounts/account-kinds";
import { CardSetupSection } from "@/features/accounts/card-setup-section";
import { InstitutionField } from "@/features/accounts/institution-field";
import { KindSummary } from "@/features/accounts/kind-summary";
import { ParentField } from "@/features/accounts/parent-field";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { ColorSwatches } from "@/ui/color-swatches";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { MoneyInput } from "@/ui/money-input";

type Account = components["schemas"]["Account"];

function descendantsOf(id: string, accounts: readonly Account[]): Set<string> {
  const found = new Set<string>([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const account of accounts) {
      if (
        account.parent_id !== undefined &&
        found.has(account.parent_id) &&
        !found.has(account.id)
      ) {
        found.add(account.id);
        grew = true;
      }
    }
  }
  return found;
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
}: {
  mode: "create" | "edit";
  draft: AccountDraft;
  onChange: (next: AccountDraft) => void;
  onChangeKind?: () => void;
  accounts: readonly Account[];
  editingId?: string;
  currencies: readonly string[];
  scale: (code: string) => number;
  errors: Record<string, string>;
}) {
  const t = useT();
  const kind = draft.kind ?? "checking";
  const cls = classOf(kind);
  const set = (patch: Partial<AccountDraft>) => {
    onChange({ ...draft, ...patch });
  };
  const excluded =
    editingId === undefined
      ? new Set<string>()
      : descendantsOf(editingId, accounts);
  const parents = accounts
    .filter(
      (a) =>
        a.class === cls &&
        a.system_role === undefined &&
        a.closed_on === undefined &&
        !excluded.has(a.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const error = (name: string) => errors[name];
  const parentName = parents.find((a) => a.id === draft.parentId)?.name;

  return (
    <Stack gap={8}>
      <FieldGroup>
        <FieldGroupLegend>{t("accountForm.identity")}</FieldGroupLegend>
        <FieldGroupContent>
          <Stack gap={4}>
            <Field>
              <FieldLabel>{t("accountForm.kind")}</FieldLabel>
              <KindSummary
                kind={kind}
                onChange={mode === "create" ? onChangeKind : undefined}
              />
              {mode === "edit" && (
                <FieldDescription>
                  {t("accountForm.kindFixed")}
                </FieldDescription>
              )}
            </Field>
            <Field invalid={error("name") !== undefined} required>
              <FieldLabel>{t("accountForm.name")}</FieldLabel>
              <TextField
                name="name"
                value={draft.name}
                maxLength={120}
                onChange={(event) => {
                  set({ name: event.target.value });
                }}
              />
              {error("name") !== undefined && (
                <FieldError>{error("name")}</FieldError>
              )}
            </Field>
            <Field invalid={error("institution_id") !== undefined}>
              <FieldLabel>{t("accountForm.institution")}</FieldLabel>
              <InstitutionField
                value={draft.institutionId}
                onChange={(institutionId) => {
                  set({ institutionId });
                }}
              />
              <FieldDescription>
                {t("accountForm.institutionHint")}
              </FieldDescription>
              {error("institution_id") !== undefined && (
                <FieldError>{error("institution_id")}</FieldError>
              )}
            </Field>
          </Stack>
        </FieldGroupContent>
      </FieldGroup>

      <FieldGroup>
        <FieldGroupLegend>{t("accountForm.details")}</FieldGroupLegend>
        <FieldGroupContent>
          <Stack gap={4}>
            <Field invalid={error("currency") !== undefined}>
              <FieldLabel>{t("accountForm.currency")}</FieldLabel>
              {mode === "create" ? (
                <ChoiceSelect
                  label={t("accountForm.currency")}
                  choices={currencies.map((c) => ({ value: c, label: c }))}
                  value={draft.currency}
                  multiple={false}
                  onChange={(next) => {
                    if (typeof next === "string") set({ currency: next });
                  }}
                />
              ) : (
                <TextField
                  value={draft.currency}
                  readOnly
                  className={widths.short}
                />
              )}
              {mode === "edit" && (
                <FieldDescription>
                  {t("accountForm.currencyFixed")}
                </FieldDescription>
              )}
              {error("currency") !== undefined && (
                <FieldError>{error("currency")}</FieldError>
              )}
            </Field>
            {mode === "create" && (
              <Field invalid={error("opened_on") !== undefined}>
                <FieldLabel>{t("accountForm.openedOn")}</FieldLabel>
                <DateInput
                  name="opened_on"
                  value={draft.openedOn}
                  onChange={(openedOn) => {
                    set({ openedOn });
                  }}
                />
                <FieldDescription>
                  {t("accountForm.openedOnHint")}
                </FieldDescription>
                {error("opened_on") !== undefined && (
                  <FieldError>{error("opened_on")}</FieldError>
                )}
              </Field>
            )}
            <Field invalid={error("parent_id") !== undefined}>
              <FieldLabel>{t("accountForm.parent")}</FieldLabel>
              <ParentField
                candidates={parents}
                accounts={accounts}
                value={draft.parentId}
                invalid={error("parent_id") !== undefined}
                onChange={(parentId) => {
                  set({ parentId });
                }}
              />
              <FieldDescription>
                {parentName === undefined
                  ? t("accountForm.parentNone")
                  : t("accountForm.parentInside", { name: parentName })}
              </FieldDescription>
              {error("parent_id") !== undefined && (
                <FieldError>{error("parent_id")}</FieldError>
              )}
            </Field>
            {yieldCapable(kind) && (
              <Field>
                <Switch
                  checked={draft.yieldAuto}
                  onCheckedChange={(yieldAuto) => {
                    set({ yieldAuto });
                  }}
                >
                  {t("accountForm.yield")}
                </Switch>
                <FieldDescription>
                  {t("accountForm.yieldHint")}
                </FieldDescription>
              </Field>
            )}
            {mode === "edit" && liquidCapable(kind) && (
              <Field>
                <Switch
                  checked={draft.excludedFromLiquidity}
                  onCheckedChange={(excludedFromLiquidity) => {
                    set({ excludedFromLiquidity });
                  }}
                >
                  {t("accountForm.excludeFromLiquidity")}
                </Switch>
                <FieldDescription>
                  {t("accountForm.excludeFromLiquidityHint")}
                </FieldDescription>
              </Field>
            )}
            <Field invalid={error("color") !== undefined}>
              <FieldLabel>{t("accountForm.color")}</FieldLabel>
              <ColorSwatches
                name="color"
                label={t("accountForm.color")}
                value={draft.color}
                onChange={(color) => {
                  set({ color });
                }}
              />
              <FieldDescription>{t("accountForm.colorHint")}</FieldDescription>
            </Field>
          </Stack>
        </FieldGroupContent>
      </FieldGroup>

      {mode === "create" && (
        <FieldGroup>
          <FieldGroupLegend>{t("accountForm.openingGroup")}</FieldGroupLegend>
          <FieldGroupContent>
            <Field>
              <FieldLabel>
                {t(
                  kind === "credit_card"
                    ? "accountForm.openingCard"
                    : cls === "liability"
                      ? "accountForm.openingOwed"
                      : "accountForm.opening",
                )}
              </FieldLabel>
              <MoneyInput
                value={draft.opening}
                onChange={(opening) => {
                  set({ opening });
                }}
                currency={draft.currency}
                scale={scale(draft.currency)}
                sign="neutral"
              />
              <FieldDescription>
                {t("accountForm.openingHint")}
              </FieldDescription>
            </Field>
          </FieldGroupContent>
        </FieldGroup>
      )}

      {mode === "create" && kind === "credit_card" && (
        <CardSetupSection
          value={draft.card}
          onChange={(card) => {
            set({ card });
          }}
          errors={errors}
          currency={draft.currency}
          scale={scale(draft.currency)}
        />
      )}
    </Stack>
  );
}

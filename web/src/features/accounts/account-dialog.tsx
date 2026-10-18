import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { EntityPicker } from "@slotted/react/entity-picker";
import type { Entity } from "@slotted/react/entity-picker";
import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { ProblemError, problemMessage } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useCreateAccount, useUpdateAccount } from "@/features/accounts/api";
import { AccountSelect } from "@/features/accounts/account-select";
import { useT } from "@/i18n/i18n-provider";
import type { MessageKey } from "@/i18n/catalog.en";

type Account = components["schemas"]["Account"];
type AccountClass = Account["class"];
type Kind = NonNullable<Account["kind"]>;

const classes: AccountClass[] = [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
];

// Mirrors the class/kind matrix of the ledger domain; the API rejects a kind outside it.
const kindsByClass: Record<AccountClass, Kind[]> = {
  asset: [
    "checking",
    "savings",
    "cash",
    "wallet",
    "benefit",
    "reserve",
    "brokerage",
    "receivable",
    "loan",
  ],
  liability: ["credit_card", "loan", "payable"],
  equity: [],
  income: [],
  expense: [],
};

export type DialogTarget =
  | { mode: "create"; baseCurrency: string; currencies: string[] }
  | { mode: "edit"; account: Account };

function descendantIds(accounts: Account[], rootID: string): Set<string> {
  const ids = new Set([rootID]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of accounts) {
      if (a.parent_id !== undefined && ids.has(a.parent_id) && !ids.has(a.id)) {
        ids.add(a.id);
        grew = true;
      }
    }
  }
  return ids;
}

// Mounted only while open, so every opening starts from the account being edited or from a blank form.
export function AccountDialog({
  target,
  accounts,
  onClose,
}: {
  target: DialogTarget;
  accounts: Account[];
  onClose: () => void;
}) {
  const t = useT();
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const editing = target.mode === "edit" ? target.account : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [accountClass, setAccountClass] = useState<AccountClass>(
    editing?.class ?? "asset",
  );
  const [kind, setKind] = useState<Kind | "">(
    editing === null ? "checking" : (editing.kind ?? ""),
  );
  const [currency, setCurrency] = useState(
    target.mode === "create" ? target.baseCurrency : "",
  );
  const [parentID, setParentID] = useState(editing?.parent_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const excluded =
    editing === null ? new Set<string>() : descendantIds(accounts, editing.id);
  const parents: Entity[] = accounts
    .filter(
      (a) =>
        a.class === accountClass &&
        a.closed_on === undefined &&
        !excluded.has(a.id),
    )
    .map((a) => ({ id: a.id, label: a.name }));
  const kinds = kindsByClass[accountClass];

  const chooseClass = (next: string) => {
    const nextClass = classes.find((c) => c === next);
    if (nextClass === undefined) return;
    setAccountClass(nextClass);
    setKind(kindsByClass[nextClass][0] ?? "");
    setParentID("");
  };

  const submit = async () => {
    setError(null);
    try {
      if (editing === null) {
        await create.mutateAsync({
          name: trimmed,
          class: accountClass,
          ...(kind === "" ? {} : { kind }),
          currency,
          ...(parentID === "" ? {} : { parent_id: parentID }),
        });
      } else {
        await update.mutateAsync({
          id: editing.id,
          patch: {
            ...(trimmed === editing.name ? {} : { name: trimmed }),
            ...(parentID === "" || parentID === editing.parent_id
              ? {}
              : { parent_id: parentID }),
          },
        });
      }
    } catch (failure) {
      setError(
        failure instanceof ProblemError
          ? problemMessage(failure.problem, t)
          : t("accounts.failed"),
      );
      return;
    }
    toast.show({
      title: t(
        editing === null ? "accounts.create.done" : "accounts.edit.done",
      ),
    });
    onClose();
  };

  const originalParent = editing?.parent_id ?? "";
  const changed =
    trimmed !== editing?.name ||
    (parentID !== "" && parentID !== originalParent);
  const pending = create.isPending || update.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(
              editing === null
                ? "accounts.create.title"
                : "accounts.edit.title",
            )}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel>{t("accounts.field.name")}</FieldLabel>
            <TextField value={name} onValueChange={setName} />
          </Field>
          {editing === null && (
            <AccountSelect
              label={t("accounts.field.class")}
              value={accountClass}
              options={classes.map((c) => ({
                value: c,
                label: t(`accounts.class.${c}` satisfies MessageKey),
              }))}
              onChange={chooseClass}
            />
          )}
          {editing === null && kinds.length > 0 && (
            <AccountSelect
              label={t("accounts.field.kind")}
              value={kind}
              options={kinds.map((k) => ({
                value: k,
                label: t(`accounts.kind.${k}` satisfies MessageKey),
              }))}
              onChange={(next) => {
                setKind(kinds.find((k) => k === next) ?? kind);
              }}
            />
          )}
          {target.mode === "create" && (
            <AccountSelect
              label={t("accounts.field.currency")}
              value={currency}
              options={target.currencies.map((code) => ({
                value: code,
                label: code,
              }))}
              onChange={setCurrency}
            />
          )}
          <Field>
            <FieldLabel>{t("accounts.field.parent")}</FieldLabel>
            <EntityPicker
              aria-label={t("accounts.field.parent")}
              items={parents}
              entities={parents}
              value={parentID === "" ? null : parentID}
              onValueChange={(next) => {
                setParentID(typeof next === "string" ? next : "");
              }}
            />
          </Field>
          {error !== null && (
            <Alert tone="danger" role="alert">
              <AlertContent>
                <AlertDescription>{error}</AlertDescription>
              </AlertContent>
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button tone="secondary" variant="outline" onClick={onClose}>
            {t("accounts.cancel")}
          </Button>
          <Button
            disabled={trimmed === "" || !changed || pending}
            onClick={() => void submit()}
          >
            {t(
              editing === null
                ? "accounts.create.submit"
                : "accounts.edit.submit",
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

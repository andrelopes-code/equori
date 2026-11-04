import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { meQuery } from "@/features/session";
import { AccountInvitationLink } from "@/features/setup/account-invitation-link";
import { useCreateAccountInvitation } from "@/features/setup/api";
import type { AccountInvitation } from "@/features/setup/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { regionChoicesFor } from "@/i18n/regions";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormNotice } from "@/ui/form-notice";
import { useStableCallback } from "@/ui/use-stable-callback";

interface AccountInvitationDialogProps {
  onClose: () => void;
}

// Families read: dialog, field, text-field, inline-message. Creates an account invitation; once
// created, the dialog shows its link once.
export function AccountInvitationDialog({
  onClose,
}: AccountInvitationDialogProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const { tag } = useAppLocaleState();
  const formId = useId();
  const me = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  const create = useCreateAccountInvitation();
  const [email, setEmail] = useState("");
  const [chosenRegion, setChosenRegion] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<AccountInvitation | null>(null);

  const regionChoices = useMemo(() => regionChoicesFor(tag), [tag]);
  const region = chosenRegion ?? me.data?.region ?? null;

  // Closing while the invitation is created would hide a link the server never shows again.
  const change = useStableCallback((open: boolean) => {
    if (!open && !create.isPending) onClose();
  });

  const handleSubmit = () => {
    if (create.isPending || region === null) return;
    setSummary(null);
    setErrors({});
    create
      .mutateAsync({ email: email.trim(), region })
      .then(setCreated)
      .catch((caught: unknown) => {
        setSummary(errorText(caught, t));
        setErrors(
          caught instanceof ProblemError ? fieldErrors(caught.problem) : {},
        );
      });
  };

  return (
    <Dialog open size="md" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {created === null
              ? t("accounts.invite.dialogTitle")
              : t("accounts.invite.linkTitle", { email: created.email })}
          </DialogTitle>
          <DialogDescription>
            {created === null
              ? t("accounts.invite.hint")
              : t("accounts.invite.linkHint", {
                  email: created.email,
                  date: formatDate(created.expires_at.slice(0, 10), locale),
                })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {created !== null ? (
            <AccountInvitationLink invitation={created} />
          ) : (
            // Workaround for Slotted issue #8.
            <form
              id={formId}
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <Stack gap={4}>
                {summary !== null && <FormNotice>{summary}</FormNotice>}

                <Field invalid={errors.email !== undefined} required>
                  <FieldLabel>{t("invitations.email")}</FieldLabel>
                  <TextField
                    name="email"
                    type="email"
                    value={email}
                    maxLength={254}
                    onChange={(event) => {
                      setEmail(event.target.value);
                    }}
                  />
                  {errors.email !== undefined && (
                    <FieldError>{errors.email}</FieldError>
                  )}
                </Field>

                <Field invalid={errors.region !== undefined} required>
                  <FieldLabel>{t("settings.region")}</FieldLabel>
                  <ChoiceSelect
                    label={t("settings.region")}
                    choices={regionChoices}
                    value={region}
                    multiple={false}
                    invalid={errors.region !== undefined}
                    onChange={(next) => {
                      if (typeof next === "string") setChosenRegion(next);
                    }}
                  />
                  <FieldDescription>{t("books.region.help")}</FieldDescription>
                  {errors.region !== undefined && (
                    <FieldError>{errors.region}</FieldError>
                  )}
                </Field>
              </Stack>
            </form>
          )}
        </DialogBody>
        <DialogFooter>
          {created === null ? (
            <>
              <Button
                variant="ghost"
                tone="secondary"
                disabled={create.isPending}
                onClick={onClose}
              >
                {t("detail.cancel")}
              </Button>
              <Button
                type="submit"
                form={formId}
                loading={create.isPending}
                disabled={email.trim() === "" || region === null}
              >
                {t("accounts.invite.create")}
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>{t("invitations.done")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

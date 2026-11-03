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
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { InlineMessage } from "@slotted/react/inline-message";
import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { useCreateInvitation } from "@/features/setup/api";
import type { BookRole, Invitation } from "@/features/setup/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

interface InvitationDialogProps {
  onClose: () => void;
}

const roles = ["read", "write", "owner"] as const;

// Families read: dialog, field, field-group, radio-group, text-field. Creates an
// invitation; after the creation the dialog shows its link once (HA25).
export function InvitationDialog({ onClose }: InvitationDialogProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const formId = useId();
  const create = useCreateInvitation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BookRole>("read");
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Invitation | null>(null);
  // Closing while the invitation is created would hide a link the server never shows again.
  const change = useStableCallback((open: boolean) => {
    if (!open && !create.isPending) onClose();
  });

  const submit = () => {
    if (create.isPending) return;
    setSummary(null);
    setErrors({});
    create
      .mutateAsync({ email: email.trim(), role })
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
            {t(
              created === null ? "invitations.create" : "invitations.linkTitle",
            )}
          </DialogTitle>
          {created !== null && (
            <DialogDescription>
              {t("invitations.linkHint", {
                email: created.email,
                date: formatDate(created.expires_at.slice(0, 10), locale),
              })}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody>
          {created !== null ? (
            <TextField
              aria-label={t("invitations.linkTitle")}
              value={`${window.location.origin}/invite#token=${created.token ?? ""}`}
              readOnly
              copyable
              mono
              messages={{ copy: t("accounts.invite.copy") }}
            />
          ) : (
            // Workaround for Slotted issue #8.
            <form
              id={formId}
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <Stack gap={4}>
                {summary !== null && (
                  <InlineMessage tone="danger">{summary}</InlineMessage>
                )}
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
                <FieldGroup required>
                  <FieldGroupLegend>{t("members.role")}</FieldGroupLegend>
                  <FieldGroupContent>
                    <RadioGroup
                      name="role"
                      value={role}
                      onValueChange={(next) => {
                        setRole(roles.find((r) => r === next) ?? "read");
                      }}
                    >
                      {roles.map((r) => (
                        <Radio
                          key={r}
                          value={r}
                          description={t(`members.role.${r}.help`)}
                        >
                          {t(`members.role.${r}`)}
                        </Radio>
                      ))}
                    </RadioGroup>
                  </FieldGroupContent>
                </FieldGroup>
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
                disabled={email.trim() === ""}
              >
                {t("invitations.create")}
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

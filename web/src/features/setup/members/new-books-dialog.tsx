import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { meQuery, useSwitchBooks } from "@/features/session";
import { useCreateBooks } from "@/features/setup/api";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { regionChoicesFor } from "@/i18n/regions";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormNotice } from "@/ui/form-notice";
import { useStableCallback } from "@/ui/use-stable-callback";

interface NewBooksDialogProps {
  onClose: () => void;
}

// Families read: dialog, field, text-field, inline-message. Creates a book, switches the session
// to it and reloads (HA6, HA32).
export function NewBooksDialog({ onClose }: NewBooksDialogProps) {
  const t = useT();
  const { tag } = useAppLocaleState();
  const me = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  const create = useCreateBooks();
  const switchBooks = useSwitchBooks();

  const [name, setName] = useState("");
  const [chosenRegion, setChosenRegion] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const regionChoices = useMemo(() => regionChoicesFor(tag), [tag]);
  const region = chosenRegion ?? me.data?.region ?? null;
  const pending = create.isPending || switchBooks.isPending;

  // Closing mid-request would leave a created book the session never switches to.
  const change = useStableCallback((open: boolean) => {
    if (!open && !pending) onClose();
  });

  function handleSubmit() {
    if (pending || region === null) return;
    setSummary(null);
    setErrors({});
    create
      .mutateAsync({ name: name.trim(), region })
      .then((created) => switchBooks.mutateAsync(created.id))
      .catch((caught: unknown) => {
        setSummary(errorText(caught, t));
        setErrors(
          caught instanceof ProblemError ? fieldErrors(caught.problem) : {},
        );
      });
  }

  return (
    <Dialog open size="md" onOpenChange={change}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("books.new")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Stack gap={4}>
              {summary !== null && <FormNotice>{summary}</FormNotice>}

              <Field invalid={errors.name !== undefined} required>
                <FieldLabel>{t("books.name")}</FieldLabel>
                <TextField
                  name="name"
                  value={name}
                  maxLength={80}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
                <FieldDescription>{t("books.name.help")}</FieldDescription>
                {errors.name !== undefined && (
                  <FieldError>{errors.name}</FieldError>
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
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              tone="secondary"
              disabled={pending}
              onClick={onClose}
            >
              {t("detail.cancel")}
            </Button>
            <Button
              type="submit"
              loading={pending}
              disabled={name.trim() === "" || region === null}
            >
              {t("books.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

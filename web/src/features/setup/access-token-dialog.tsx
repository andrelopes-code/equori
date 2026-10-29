import type { CodeToken } from "@slotted/core/code";
import { Button } from "@slotted/react/button";
import { CodeBlock } from "@slotted/react/code-block";
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
import { useCreateAccessToken } from "@/features/setup/api";
import { clientSnippets } from "@/features/setup/client-snippets";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";
import { useStableCallback } from "@/ui/use-stable-callback";

const expiryDays = [30, 90, 365] as const;

// Families read: dialog, field, field-group, radio-group, text-field, code-block. Creates a token;
// after the creation the dialog shows its text once, with the setups of three clients (design 3.6).
export function AccessTokenDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const formId = useId();
  const create = useCreateAccessToken();
  const [name, setName] = useState("");
  const [scope, setScope] = useState("read");
  const [days, setDays] = useState("90");
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState<string | null>(null);
  // Closing while the token is created would hide a text the server never shows again.
  const change = useStableCallback((open: boolean) => {
    if (!open && !create.isPending) onClose();
  });
  const submit = () => {
    if (create.isPending) return;
    setSummary(null);
    setErrors({});
    create
      .mutateAsync({
        name: name.trim(),
        scope,
        expires_in_days: Number(days),
      })
      .then((created) => {
        setToken(created.token ?? null);
      })
      .catch((caught: unknown) => {
        setSummary(errorText(caught, t));
        setErrors(
          caught instanceof ProblemError ? fieldErrors(caught.problem) : {},
        );
      });
  };
  const snippets =
    token === null
      ? null
      : clientSnippets(`${window.location.origin}/mcp`, token);
  // The screen shows the token masked; the copy control copies the code, which holds it whole.
  const masked = (code: CodeToken) =>
    token === null
      ? code.text
      : code.text.replaceAll(token, `${token.slice(0, 8)}${"•".repeat(16)}`);

  return (
    <Dialog open size={token === null ? "md" : "lg"} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(
              snippets === null
                ? "settings.external_access.create"
                : "settings.external_access.tokenTitle",
            )}
          </DialogTitle>
          {snippets !== null && (
            <DialogDescription>
              {t("settings.external_access.tokenHint")}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody>
          {token !== null && snippets !== null ? (
            <FormLayout>
              <CodeBlock
                code={token}
                title={t("settings.external_access.token")}
                renderToken={masked}
              />
              <CodeBlock
                code={snippets.claudeCode}
                language="shell"
                title={t("settings.external_access.claudeCode")}
                renderToken={masked}
                defaultWrap
              />
              <CodeBlock
                code={snippets.codex}
                language="toml"
                title={t("settings.external_access.codex")}
              />
              <CodeBlock
                code={snippets.json}
                language="json"
                title={t("settings.external_access.json")}
                renderToken={masked}
              />
            </FormLayout>
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
                <Field invalid={errors.name !== undefined} required>
                  <FieldLabel>{t("settings.external_access.name")}</FieldLabel>
                  <TextField
                    name="name"
                    value={name}
                    maxLength={80}
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                  />
                  {errors.name !== undefined && (
                    <FieldError>{errors.name}</FieldError>
                  )}
                </Field>
                <FieldGroup required>
                  <FieldGroupLegend>
                    {t("settings.external_access.scope")}
                  </FieldGroupLegend>
                  <FieldGroupContent>
                    <RadioGroup
                      name="scope"
                      value={scope}
                      onValueChange={setScope}
                    >
                      <Radio value="read">
                        {t("settings.external_access.scope.read")}
                      </Radio>
                      <Radio
                        value="write"
                        description={t(
                          "settings.external_access.write_warning",
                        )}
                      >
                        {t("settings.external_access.scope.write")}
                      </Radio>
                    </RadioGroup>
                  </FieldGroupContent>
                </FieldGroup>
                <FieldGroup required>
                  <FieldGroupLegend>
                    {t("settings.external_access.expiry")}
                  </FieldGroupLegend>
                  <FieldGroupContent>
                    <RadioGroup
                      name="expires_in_days"
                      orientation="horizontal"
                      value={days}
                      onValueChange={setDays}
                    >
                      {expiryDays.map((d) => (
                        <Radio key={d} value={String(d)}>
                          {t("settings.external_access.days", {
                            count: String(d),
                          })}
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
          {token === null ? (
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
                disabled={name.trim() === ""}
              >
                {t("settings.external_access.create")}
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>
              {t("settings.external_access.done")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

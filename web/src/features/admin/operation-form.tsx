import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@slotted/react/button";
import { Grid } from "@slotted/react/grid";
import { Form, FormActions } from "@slotted/react/form";
import type { FormErrors } from "@slotted/react/form";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { callApi } from "@/features/admin/api";
import { fillPath } from "@/features/admin/cell-text";
import { toBody, toDraft } from "@/features/admin/draft";
import { LeafEditor } from "@/features/admin/leaf-editor";
import { ObjectEditor } from "@/features/admin/object-editor";
import type { Operation } from "@/features/admin/operations";
import { ResponseView } from "@/features/admin/response-view";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useT } from "@/i18n/i18n-provider";

export function operationTitle(op: Operation): string {
  return `${op.method} ${op.path} · ${op.id}`;
}

type Errors = FormErrors;

interface FieldError {
  field: string;
  message: string;
}

// A problem's field errors keyed by field name, which is each control's name (FM-02).
function fieldErrors(body: unknown): Errors {
  if (typeof body !== "object" || body === null) return {};
  const { errors = [] } = body as { errors?: FieldError[] };
  return Object.fromEntries(
    errors.map((error) => [error.field, [error.message]]),
  );
}

function pathParams(path: string): string[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "");
}

export function OperationForm({
  op,
  ctx,
  initial = {},
}: {
  op: Operation;
  ctx: AdminContext;
  initial?: Readonly<Record<string, string>>;
}) {
  const t = useT();
  const api = useApi();
  const queryClient = useQueryClient();
  const scaleOf = ctx.cells.scaleOf;
  const names = [...pathParams(op.path), ...(op.query ?? [])];
  const [params, setParams] = useState<Record<string, string>>(() =>
    Object.fromEntries(names.map((name) => [name, initial[name] ?? ""])),
  );
  const [template] = useState(() => op.body?.(ctx.refs));
  const [draft, setDraft] = useState(() => toDraft(template, scaleOf));
  const [errors, setErrors] = useState<Errors>({});
  const call = useMutation({
    mutationFn: () => {
      const query = Object.fromEntries(
        (op.query ?? []).map((name) => [name, params[name] ?? ""]),
      );
      const body =
        template === undefined ? undefined : toBody(draft, template, scaleOf);
      return callApi(api, op.method, fillPath(op.path, params), query, body);
    },
    onSuccess: async (result) => {
      setErrors(fieldErrors(result.body));
      if (op.method !== "GET" && result.status < 400) {
        await queryClient.invalidateQueries();
      }
    },
  });

  return (
    <Form
      aria-label={operationTitle(op)}
      errors={errors}
      onErrorsChange={setErrors}
      onSubmit={async () => {
        await call.mutateAsync();
      }}
    >
      <Stack gap={5}>
        {names.length > 0 && (
          <Grid gap={4} minItemWidth="sm">
            {names.map((name) => (
              <LeafEditor
                key={name}
                name={name}
                value={params[name] ?? ""}
                onChange={(value) => {
                  setParams((current) => ({
                    ...current,
                    [name]: String(value),
                  }));
                }}
                ctx={ctx}
              />
            ))}
          </Grid>
        )}
        {typeof draft === "object" && draft !== null && (
          <ObjectEditor
            value={draft as Record<string, unknown>}
            onChange={setDraft}
            ctx={ctx}
          />
        )}
      </Stack>
      <FormActions>
        <Button type="submit">{t("admin.op.send")}</Button>
      </FormActions>
      {call.data !== undefined && (
        <ResponseView result={call.data} caption={op.id} cells={ctx.cells} />
      )}
      {call.error !== null && (
        <ResponseView
          result={{ status: 0, body: String(call.error) }}
          caption={op.id}
          cells={ctx.cells}
        />
      )}
    </Form>
  );
}

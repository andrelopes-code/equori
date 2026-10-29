import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Divider } from "@slotted/react/divider";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Inline } from "@slotted/react/inline";
import { InlineMessage } from "@slotted/react/inline-message";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slotted/react/select";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { settingsQuery } from "@/features/setup";
import {
  useCategoryAppearance,
  useCreateCategory,
  useMoveCategory,
  useRenameCategory,
} from "@/features/categories/api";
import { AppearancePicker } from "@/features/categories/appearance-picker";
import { pathSeparator, subtreeOf } from "@/features/categories/category-paths";
import { CategoryPreview } from "@/features/categories/category-preview";
import type {
  CategoryClass,
  CategoryEntry,
  CategoryIconName,
} from "@/features/categories/category-paths";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";
import { useStableCallback } from "@/ui/use-stable-callback";

const topLevel = "__top__";

// One dialog creates a category or edits one: its name, its place in the tree and its look.
export function CategoryDialog({
  open,
  onOpenChange,
  entries,
  editing,
  defaultClass,
  defaultParent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: readonly CategoryEntry[];
  editing: CategoryEntry | null;
  defaultClass: CategoryClass;
  defaultParent?: string | null;
}) {
  const t = useT();
  const change = useStableCallback(onOpenChange);
  const formId = useId();
  const api = useApi();
  const settings = useQuery(settingsQuery(api));
  const create = useCreateCategory();
  const rename = useRenameCategory();
  const move = useMoveCategory();
  const appearance = useCategoryAppearance();

  const [name, setName] = useState(editing?.name ?? "");
  const [cls, setCls] = useState<CategoryClass>(editing?.class ?? defaultClass);
  const [parent, setParent] = useState<string | null>(
    editing?.parentId ?? defaultParent ?? null,
  );
  const [color, setColor] = useState<number | null>(editing?.color ?? null);
  const [icon, setIcon] = useState<CategoryIconName | null>(
    editing?.icon ?? null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const busy =
    create.isPending ||
    rename.isPending ||
    move.isPending ||
    appearance.isPending;

  const excluded =
    editing === null ? new Set<string>() : subtreeOf(entries, editing.id);
  const parents = entries.filter(
    (e) =>
      e.class === cls && !e.archived && !e.uncategorized && !excluded.has(e.id),
  );
  const parentPath = entries.find((e) => e.id === parent)?.path;

  const save = async () => {
    setErrors({});
    setSummary(null);
    const trimmed = name.trim();
    if (trimmed === "") {
      setErrors({ name: t("category.nameRequired") });
      return;
    }
    try {
      if (editing === null) {
        const currency = settings.data?.base_currency;
        if (currency === undefined) return;
        await create.mutateAsync({
          name: trimmed,
          class: cls,
          currency,
          ...(parent === null ? {} : { parent_id: parent }),
          ...(color === null ? {} : { color }),
          ...(icon === null ? {} : { icon }),
        });
      } else {
        if (trimmed !== editing.name) {
          await rename.mutateAsync({ id: editing.id, name: trimmed });
        }
        if (parent !== (editing.parentId ?? null)) {
          await move.mutateAsync({ id: editing.id, parentId: parent });
        }
        if (
          color !== (editing.color ?? null) ||
          icon !== (editing.icon ?? null)
        ) {
          await appearance.mutateAsync({ id: editing.id, color, icon });
        }
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ProblemError) {
        const byField = fieldErrors(error.problem);
        setErrors({
          ...(byField.name === undefined ? {} : { name: byField.name }),
          ...(byField.parent_id === undefined
            ? {}
            : { parent: byField.parent_id }),
        });
      }
      setSummary(errorText(error, t));
    }
  };

  return (
    <Dialog open={open} onOpenChange={change} size="lg">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing === null ? t("category.new") : t("category.edit")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8:
                the form wraps the body and the footer's submit names it. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <FormLayout>
              <CategoryPreview
                name={name}
                placeholder={t("category.new")}
                place={[t(`category.group.${cls}`), parentPath]
                  .filter((part) => part !== undefined)
                  .join(pathSeparator)}
                color={color}
                icon={icon}
              />
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}

              <Field invalid={errors.name !== undefined} required>
                <FieldLabel>{t("category.name")}</FieldLabel>
                <TextField
                  name="name"
                  value={name}
                  maxLength={120}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
                {errors.name !== undefined && (
                  <FieldError>{errors.name}</FieldError>
                )}
              </Field>

              {editing === null && (
                <FieldGroup>
                  <FieldGroupLegend>{t("category.class")}</FieldGroupLegend>
                  <FieldGroupContent>
                    <Inline>
                      <SegmentedControl
                        aria-label={t("category.class")}
                        value={cls}
                        onValueChange={(value) => {
                          if (value === "expense" || value === "income") {
                            setCls(value);
                            setParent(null);
                          }
                        }}
                      >
                        <Segment value="expense">
                          {t("category.group.expense")}
                        </Segment>
                        <Segment value="income">
                          {t("category.group.income")}
                        </Segment>
                      </SegmentedControl>
                    </Inline>
                  </FieldGroupContent>
                </FieldGroup>
              )}

              <Field invalid={errors.parent !== undefined}>
                <FieldLabel>{t("category.parent")}</FieldLabel>
                <Select
                  value={parent ?? topLevel}
                  onValueChange={(value) => {
                    setParent(
                      typeof value === "string" && value !== topLevel
                        ? value
                        : null,
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={topLevel}>
                      {t("category.topLevel")}
                    </SelectItem>
                    {parents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.parent !== undefined && (
                  <FieldError>{errors.parent}</FieldError>
                )}
              </Field>
              <Divider label={t("appearance.title")} align="start" />
              <AppearancePicker
                name={name}
                color={color}
                icon={icon}
                onChange={(next) => {
                  setColor(next.color);
                  setIcon(next.icon);
                }}
              />
            </FormLayout>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            tone="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {editing === null ? t("category.create.confirm") : t("detail.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

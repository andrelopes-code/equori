import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import { Inline } from "@slotted/react/inline";
import { InlineMessage } from "@slotted/react/inline-message";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { AppearancePicker } from "@/features/categories/appearance-picker";
import { subtreeOf } from "@/features/categories/category-paths";
import { CategoryPicker } from "@/features/categories/category-picker";
import type {
  CategoryClass,
  CategoryEntry,
  CategoryIconName,
} from "@/features/categories/category-paths";
import { useSaveCategory } from "@/features/categories/use-save-category";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";
import { useStableCallback } from "@/ui/use-stable-callback";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: readonly CategoryEntry[];
  editing: CategoryEntry | null;
  defaultClass: CategoryClass;
  defaultParent?: string | null;
}

// One dialog creates a category or edits one: its name, its place in the tree and its look.
export function CategoryDialog({
  open,
  onOpenChange,
  entries,
  editing,
  defaultClass,
  defaultParent,
}: CategoryDialogProps) {
  const t = useT();
  const change = useStableCallback(onOpenChange);
  const formId = useId();
  const { save, busy, errors, summary } = useSaveCategory(editing, () => {
    onOpenChange(false);
  });

  const [name, setName] = useState(editing?.name ?? "");
  const [cls, setCls] = useState<CategoryClass>(editing?.class ?? defaultClass);
  const [parent, setParent] = useState<string | null>(
    editing?.parentId ?? defaultParent ?? null,
  );
  const [color, setColor] = useState<number | null>(editing?.color ?? null);
  const [icon, setIcon] = useState<CategoryIconName | null>(
    editing?.icon ?? null,
  );

  const excluded = notParents(entries, editing, cls);

  return (
    <Dialog open={open} onOpenChange={change} size="md">
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
              void save({ name, cls, parent, color, icon });
            }}
          >
            <FormLayout>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}

              <Field invalid={errors.name !== undefined} required>
                <FieldLabel>{t("category.name")}</FieldLabel>
                <AppearancePicker
                  name={name.trim() || t("category.new")}
                  color={color}
                  icon={icon}
                  onChange={(next) => {
                    setColor(next.color);
                    setIcon(next.icon);
                  }}
                >
                  <TextField
                    name="name"
                    value={name}
                    maxLength={120}
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                  />
                </AppearancePicker>
                {errors.name !== undefined && (
                  <FieldError>{errors.name}</FieldError>
                )}
              </Field>

              {editing === null && (
                <FieldGroup required>
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
                <CategoryPicker
                  value={parent}
                  amount={cls === "income" ? 1 : -1}
                  exclude={excluded}
                  placeholder={t("category.topLevel")}
                  portal={false}
                  onChange={setParent}
                />
                {errors.parent !== undefined && (
                  <FieldError>{errors.parent}</FieldError>
                )}
              </Field>
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

// A parent is an open category of the same class outside the edited category's own subtree.
function notParents(
  entries: readonly CategoryEntry[],
  editing: CategoryEntry | null,
  cls: CategoryClass,
): ReadonlySet<string> {
  const subtree =
    editing === null ? new Set<string>() : subtreeOf(entries, editing.id);

  return new Set(
    entries
      .filter(
        (e) =>
          e.class !== cls || e.archived || e.uncategorized || subtree.has(e.id),
      )
      .map((e) => e.id),
  );
}

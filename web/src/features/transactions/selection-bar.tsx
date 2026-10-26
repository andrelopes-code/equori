import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
  ActionBarStatus,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverLayer,
  PopoverTitle,
  PopoverTrigger,
} from "@slotted/react/popover";
import { useState } from "react";

import { CategoryPicker } from "@/features/categories";
import { useT } from "@/i18n/i18n-provider";

export function SelectionBar({
  count,
  amount,
  busy,
  open,
  onOpenChange,
  onClear,
  onCategorize,
  onSuggest,
}: {
  count: number;
  // The sum of the selected rows; its sign puts expense or income first.
  amount: number;
  busy: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  onCategorize: (categoryId: string) => void;
  // Present in the uncategorized queue only (ADR 014 L1a).
  onSuggest?: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState<string | null>(null);
  return (
    <ActionBar aria-label={t("selection.label")} present={count > 0}>
      <ActionBarStatus>{t("selection.count", { count })}</ActionBarStatus>
      <ActionBarActions>
        <ActionBarAction>
          <Button variant="ghost" tone="secondary" onClick={onClear}>
            {t("selection.clear")}
          </Button>
        </ActionBarAction>
        {onSuggest !== undefined && (
          <ActionBarAction>
            <Button variant="outline" tone="secondary" onClick={onSuggest}>
              {t("selection.suggest")}
            </Button>
          </ActionBarAction>
        )}
        <ActionBarAction>
          <Popover
            open={open}
            onOpenChange={(next) => {
              setValue(null);
              onOpenChange(next);
            }}
            side="top"
            align="end"
            size="lg"
            initialFocus="input"
          >
            <PopoverTrigger
              render={(props) => (
                <Button {...props} loading={busy} aria-keyshortcuts="C">
                  {t("selection.categorize")}
                </Button>
              )}
            />
            <PopoverLayer>
              <PopoverContent>
                <PopoverHeader>
                  <PopoverTitle>
                    {t("selection.categorizeTitle", { count })}
                  </PopoverTitle>
                </PopoverHeader>
                <PopoverBody>
                  <CategoryPicker
                    aria-label={t("category.label")}
                    value={value}
                    amount={amount}
                    portal={false}
                    onChange={(id) => {
                      if (id === null) return;
                      setValue(id);
                      onOpenChange(false);
                      onCategorize(id);
                    }}
                  />
                </PopoverBody>
              </PopoverContent>
            </PopoverLayer>
          </Popover>
        </ActionBarAction>
      </ActionBarActions>
    </ActionBar>
  );
}

import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@slotted/react/menu";

import { FilterWord } from "@/features/transactions/filter-word";

export interface FilterChoice {
  value: string;
  label: string;
}

// Slotted families read: menu, select and filter-bar. menu draws the popup, its radio group and
// the keyboard; select and filter-bar draw a boxed or dashed trigger, so only the trigger
// word is the application's own.
export function FilterChoiceMenu({
  name,
  choices,
  value,
  onChange,
}: {
  name: string;
  choices: FilterChoice[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <FilterWord
      name={name}
      value={choices.find((choice) => choice.value === value)?.label}
      onRemove={() => {
        onChange(undefined);
      }}
      trigger={(word) => (
        <Menu>
          <MenuTrigger
            render={(props) => <button type="button" {...props} {...word} />}
          />
          <MenuContent>
            <MenuRadioGroup
              aria-label={name}
              value={value ?? ""}
              onValueChange={onChange}
            >
              {choices.map((choice) => (
                <MenuRadioItem
                  key={choice.value}
                  value={choice.value}
                  closeOnSelect
                >
                  {choice.label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
      )}
    />
  );
}

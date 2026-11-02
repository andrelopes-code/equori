import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@slotted/react/menu";

export interface AccountChoiceOption {
  value: string;
  label: string;
}

interface AccountChoiceProps {
  label: string;
  value: string;
  options: readonly AccountChoiceOption[];
  onChange: (value: string) => void;
}

// One quick setting of the account menu: its name opens a submenu with the options.
export function AccountChoice({
  label,
  value,
  options,
  onChange,
}: AccountChoiceProps) {
  return (
    <Menu>
      <MenuTrigger>{label}</MenuTrigger>
      <MenuContent>
        <MenuRadioGroup
          aria-label={label}
          value={value}
          onValueChange={onChange}
        >
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

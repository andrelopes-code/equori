import { Text } from "@slotted/react/typography";
import { useId } from "react";

import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/card-face/network/network-field.module.css";
import { CardFaceNetwork } from "@/ui/card-face/network/network-mark";
import { networkName } from "@/ui/card-face/network/network-name";
import { networkOptions } from "@/ui/card-face/network/network-options";
import { OptionTile } from "@/ui/card-face/studio/option-tile";

interface NetworkFieldProps {
  name: string;
  // "" is no network.
  value: string;
  region: string | undefined;
  stored: string | undefined;
  onChange: (network: string) => void;
}

// Families read: radio-group, toggle-group. None draws a choice as a mark with its name under
// it, so the group is the card face's OptionTile over native radios: the platform gives them
// their name, arrow keys and form value.
export function NetworkField({
  name,
  value,
  region,
  stored,
  onChange,
}: NetworkFieldProps) {
  const t = useT();
  const labelId = useId();
  const options = ["", ...networkOptions(region, stored)];

  return (
    <div className={styles.field}>
      <Text id={labelId} size="sm" weight="semibold">
        {t("card.network")}
      </Text>

      <div role="radiogroup" aria-labelledby={labelId} className={styles.tiles}>
        {options.map((network) => (
          <OptionTile
            key={network}
            variant="vis"
            group={name}
            label={networkName(network === "" ? undefined : network, t)}
            checked={value === network}
            onSelect={() => {
              onChange(network);
            }}
          >
            {network === "" && (
              <span className={styles.none} aria-hidden="true" />
            )}
            {network !== "" && (
              <span className={styles.mark}>
                <CardFaceNetwork network={network} />
              </span>
            )}
          </OptionTile>
        ))}
      </div>
    </div>
  );
}

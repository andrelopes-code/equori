import styles from "@/features/setup/status-colours.module.css";
import { StatusColour } from "@/features/setup/status-colour";
import { statusNames } from "@/theme/status";

// The four status seeds side by side.
export function StatusColours() {
  return (
    <div className={styles.grid}>
      {statusNames.map((name) => (
        <StatusColour key={name} name={name} />
      ))}
    </div>
  );
}

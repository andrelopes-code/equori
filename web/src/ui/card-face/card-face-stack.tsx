import { CardFace } from "@/ui/card-face/card-face";
import type { CardFaceProps } from "@/ui/card-face/card-face";
import styles from "@/ui/card-face/card-face-stack.module.css";

export interface CardFaceStackProps {
  faces: { id: string; face: CardFaceProps }[];
  selected: string;
  onSelect: (id: string) => void;
  label: string;
}

// The selected face is drawn last and whole; the others show their top edge, in the given order.
export function CardFaceStack(props: CardFaceStackProps) {
  if (props.faces.length === 0) {
    return null;
  }

  const ordered = [
    ...props.faces.filter(({ id }) => id !== props.selected),
    ...props.faces.filter(({ id }) => id === props.selected),
  ];

  return (
    <div className={styles.stack} role="group" aria-label={props.label}>
      {ordered.map(({ id, face }) => (
        <div key={id} className={styles.slot}>
          <CardFace
            {...face}
            peek={id !== props.selected}
            pressed={id === props.selected}
            onActivate={() => {
              props.onSelect(id);
            }}
          />
        </div>
      ))}
    </div>
  );
}
